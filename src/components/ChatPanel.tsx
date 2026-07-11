"use client";

import { useEffect, useRef, useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { SceneStore } from "@/lib/canvas/sceneStore";
import { buildCanvasSummary, type CanvasSummary } from "@/lib/canvas/summary";
import { verifyAndFix } from "@/lib/canvas/verify";
import { executeToolCall, type ExecutionResult } from "@/lib/tools/executor";
import type { ToolName } from "@/lib/tools/schema";
import { sanitizePlanToolCall } from "@/lib/tools/sanitize";
import { getProvider, DEFAULT_PROVIDER_ID } from "@/lib/providers/registry";
import { DEFAULT_MODE, MODE_STORAGE_KEY, type ChatMode } from "@/lib/chat/mode";
import {
  formatDrawingName,
  listDrawings,
  loadMessages,
  pendingDrawingNameKey,
  saveMessages,
} from "@/lib/storage/drawings";
import type { SavedDrawing } from "@/lib/storage/drawings";
import type { ChatMessage, PlanData } from "@/components/chat/types";
import MessageBubble from "@/components/chat/MessageBubble";
import ChatInput from "@/components/chat/ChatInput";
import ChatSidebar from "@/components/chat/ChatSidebar";
import EmptyState from "./EmptyState";
import SettingsModal from "./SettingsModal";

interface StreamingToolCall {
  index: number;
  id: string;
  name: string;
  arguments: string;
  executed: boolean;
}

/** OpenAI-style message the client sends to `/api/chat`, mirroring the server's
 *  ApiMessage — assistant turns carry `tool_calls`, `tool` messages carry results. */
interface ApiMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
  tool_call_id?: string;
}

/** Max model round-trips in a single build request. Each step lets the model
 *  see the results of its previous tool calls (successes, rejections, and any
 *  geometry issues) and decide whether to continue, correct, or stop. */
const MAX_AGENT_STEPS = 6;

/** Stable id for a streamed tool call — some models omit ids in streaming deltas. */
function toolCallId(tc: StreamingToolCall, step: number): string {
  return tc.id || `call_${step}_${tc.index}`;
}

interface ChatPanelProps {
  excalidrawApi: ExcalidrawImperativeAPI | null;
  sceneStore: SceneStore;
  currentDrawingId: string;
  saveStatus: "idle" | "saving" | "saved";
  settingsOpen: boolean;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  sidebarOpen: boolean;
  onNewChat: () => void;
  onLoadDrawing: (id: string) => void;
}

export default function ChatPanel({
  excalidrawApi,
  sceneStore,
  currentDrawingId,
  saveStatus,
  settingsOpen,
  onOpenSettings,
  onCloseSettings,
  sidebarOpen,
  onNewChat,
  onLoadDrawing,
}: ChatPanelProps) {
  const [providerId, setProviderId] = useState(
    () => localStorage.getItem("sketter.providerId") ?? DEFAULT_PROVIDER_ID,
  );
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("sketter.apiKey") ?? "");
  const [model, setModel] = useState(
    () => localStorage.getItem("sketter.model") ?? getProvider(DEFAULT_PROVIDER_ID).defaultModel,
  );
  const [mode, setMode] = useState<ChatMode>(
    () => (localStorage.getItem(MODE_STORAGE_KEY) as ChatMode) ?? DEFAULT_MODE,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [drawings, setDrawings] = useState<SavedDrawing[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void listDrawings().then(setDrawings);
  }, []);

  useEffect(() => {
    if (saveStatus === "saved") {
      void listDrawings().then(setDrawings);
    }
  }, [saveStatus]);

  useEffect(() => {
    if (!currentDrawingId) return;
    void loadMessages(currentDrawingId).then((saved) => {
      if (Array.isArray(saved) && saved.length > 0) {
        setMessages(saved as ChatMessage[]);
      }
    });
  }, [currentDrawingId]);

  useEffect(() => {
    if (!currentDrawingId) return;
    void saveMessages(currentDrawingId, messages);
  }, [currentDrawingId, messages]);

  useEffect(() => {
    localStorage.setItem("sketter.providerId", providerId);
  }, [providerId]);

  useEffect(() => {
    localStorage.setItem("sketter.apiKey", apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem("sketter.model", model);
  }, [model]);

  useEffect(() => {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function addMessage(role: ChatMessage["role"], content: string, extra?: Partial<ChatMessage>) {
    const id = crypto.randomUUID();
    setMessages((prev) => [...prev, { id, role, content, ...extra }]);
    return id;
  }

  /** Applies a single already-parsed build tool call — shared by streamed calls and the direct plan-approval path. Returns the execution result so the agentic loop can report it back to the model. */
  async function runBuildTool(
    api: ExcalidrawImperativeAPI,
    name: string,
    args: Record<string, unknown>,
    createdThisTurn: Set<string>,
  ): Promise<ExecutionResult> {
    const activityId = addMessage(
      "tool-activity",
      `${name}(${Object.entries(args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ")})`,
    );
    const result = await executeToolCall(api, sceneStore, name as ToolName, args);
    if (!result.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== activityId));
      addMessage("system-note", `Skipped ${name}: ${result.reason}`);
      return result;
    }
    if ((name === "add_node" || name === "add_freeform") && typeof args.id === "string") {
      createdThisTurn.add(args.id);
    }
    return result;
  }

  async function runBuildToolCall(
    api: ExcalidrawImperativeAPI,
    tc: StreamingToolCall,
    createdThisTurn: Set<string>,
  ): Promise<ExecutionResult> {
    let args: Record<string, unknown> = {};
    try {
      args = tc.arguments ? JSON.parse(tc.arguments) : {};
    } catch {
      addMessage("system-note", `Model produced malformed arguments for ${tc.name}, skipped.`);
      return { name: tc.name as ToolName, ok: false, reason: "malformed arguments (invalid JSON)" };
    }
    return runBuildTool(api, tc.name, args, createdThisTurn);
  }

  /** Returns true if it actually rendered a question/plan message, so callers can tell a real render apart from a skipped/malformed call. */
  function runPlanToolCall(tc: StreamingToolCall): boolean {
    let args: Record<string, unknown> = {};
    try {
      args = tc.arguments ? JSON.parse(tc.arguments) : {};
    } catch {
      addMessage("system-note", `Model produced malformed arguments for ${tc.name}, skipped.`);
      return false;
    }
    if (tc.name !== "ask_question" && tc.name !== "propose_plan") return false;

    const sanitized = sanitizePlanToolCall({ name: tc.name, arguments: args });
    if (!sanitized.ok) {
      addMessage("system-note", `Model produced an invalid ${tc.name} call: ${sanitized.reason}`);
      return false;
    }

    if (sanitized.name === "ask_question") {
      const { question, options } = sanitized.args as { question: string; options?: string[] };
      addMessage("question", question, { question: { options, answered: false } });
    } else {
      const { summary, nodes, edges } = sanitized.args as PlanData;
      if (summary) {
        localStorage.setItem(
          pendingDrawingNameKey(currentDrawingId),
          formatDrawingName(summary),
        );
      }
      addMessage("plan", summary ?? "", { plan: { approved: false, summary, nodes, edges } });
    }
    return true;
  }

  /** Builds an approved plan directly from its structure — no LLM round-trip to reinterpret prose. */
  async function executePlanDirectly(api: ExcalidrawImperativeAPI, plan: PlanData) {
    sceneStore.beginTurn(api);
    const createdThisTurn = new Set<string>();
    for (const node of plan.nodes ?? []) {
      const args: Record<string, unknown> = { id: node.id, type: node.type, text: node.label };
      if (node.group) args.group = node.group;
      await runBuildTool(api, "add_node", args, createdThisTurn);
    }
    for (const edge of plan.edges ?? []) {
      const args: Record<string, unknown> = { from: edge.from, to: edge.to };
      if (edge.label) args.label = edge.label;
      await runBuildTool(api, "connect", args, createdThisTurn);
    }

    const canvasSummary = buildCanvasSummary(api.getSceneElements());
    sceneStore.runAutoLayout(api, canvasSummary);

    const verifyResult = verifyAndFix(api, sceneStore, createdThisTurn);
    if (verifyResult.fixedCount > 0) {
      addMessage("tool-activity", `auto-adjusted ${verifyResult.fixedCount} geometry issue(s)`);
    }
    addMessage("system-note", "Plan built.");
  }

  function handleAnswerQuestion(id: string, answer: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, question: { ...m.question, answered: true, answer } } : m,
      ),
    );
    void sendMessage(answer);
  }

  function handleApprovePlan(id: string) {
    const planMsg = messages.find((m) => m.id === id);
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, plan: { ...m.plan, approved: true } } : m)),
    );
    setMode("build");
    if (!excalidrawApi || !planMsg?.plan?.nodes?.length) return;
    void executePlanDirectly(excalidrawApi, planMsg.plan);
  }

  function handleRefinePlan(id: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, plan: { ...m.plan, approved: false } } : m)),
    );
    void sendMessage("keep refining", "plan");
  }

  /**
   * Streams a single model turn: sends the running message array + current
   * canvas summary, renders assistant text live, and executes each tool call
   * the moment its arguments finish streaming (via `onToolComplete`, so drawing
   * stays incremental). Returns the turn's assistant text, the completed tool
   * calls, and the finish reason — the caller decides whether to loop again.
   */
  async function streamTurn(
    apiMessages: ApiMessage[],
    canvasSummary: CanvasSummary,
    effectiveMode: ChatMode,
    onToolComplete: (tc: StreamingToolCall) => Promise<void>,
  ): Promise<{ assistantText: string; toolCalls: StreamingToolCall[]; finishReason: string | null } | null> {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, model, messages: apiMessages, canvasSummary, mode: effectiveMode }),
    });

    if (!res.ok || !res.body) {
      const errBody = await res.json().catch(() => ({ error: res.statusText }));
      addMessage("system-note", `Error: ${errBody.error ?? res.statusText}`);
      return null;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantText = "";
    let finishReason: string | null = null;
    const toolCalls = new Map<number, StreamingToolCall>();
    let lastIndex = -1;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const evt of events) {
        const line = evt.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;

        let json: {
          choices?: {
            delta?: {
              content?: string;
              tool_calls?: {
                index: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }[];
            };
            finish_reason?: string | null;
          }[];
        };
        try {
          json = JSON.parse(payload);
        } catch {
          continue;
        }

        if (json.choices?.[0]?.finish_reason) {
          finishReason = json.choices[0].finish_reason ?? null;
        }

        const delta = json.choices?.[0]?.delta;
        if (delta?.content) {
          assistantText += delta.content;
          setMessages((prev) => {
            const withoutStreaming = prev.filter((m) => m.id !== "streaming-assistant");
            return [
              ...withoutStreaming,
              { id: "streaming-assistant", role: "assistant", content: assistantText },
            ];
          });
        }

        for (const tcDelta of delta?.tool_calls ?? []) {
          if (tcDelta.index !== lastIndex && toolCalls.has(lastIndex)) {
            const prevCall = toolCalls.get(lastIndex)!;
            if (!prevCall.executed) {
              prevCall.executed = true;
              await onToolComplete(prevCall);
            }
          }
          lastIndex = tcDelta.index;

          const existing = toolCalls.get(tcDelta.index);
          if (existing) {
            existing.arguments += tcDelta.function?.arguments ?? "";
          } else {
            toolCalls.set(tcDelta.index, {
              index: tcDelta.index,
              id: tcDelta.id ?? "",
              name: tcDelta.function?.name ?? "",
              arguments: tcDelta.function?.arguments ?? "",
              executed: false,
            });
          }
        }
      }
    }

    for (const tc of toolCalls.values()) {
      if (!tc.executed) {
        tc.executed = true;
        await onToolComplete(tc);
      }
    }

    // Promote the live-streaming bubble into a permanent message for this turn.
    setMessages((prev) =>
      prev.map((m) => (m.id === "streaming-assistant" ? { ...m, id: crypto.randomUUID() } : m)),
    );

    return {
      assistantText,
      toolCalls: [...toolCalls.values()].sort((a, b) => a.index - b.index),
      finishReason,
    };
  }

  /**
   * Agentic build loop: the model draws, then sees the concrete outcome of its
   * tool calls — which succeeded, which were rejected, and any geometry issues
   * the verifier couldn't auto-fix — and keeps going until it's satisfied or the
   * step budget is spent. This is what makes it an agent rather than a one-shot
   * text-to-tool translator.
   */
  async function runBuildLoop(api: ExcalidrawImperativeAPI, history: ApiMessage[]) {
    const apiMessages = [...history];

    for (let step = 0; step < MAX_AGENT_STEPS; step++) {
      const canvasSummary = buildCanvasSummary(api.getSceneElements());
      const stepCreated = new Set<string>();
      const results = new Map<StreamingToolCall, ExecutionResult>();

      const turn = await streamTurn(apiMessages, canvasSummary, "build", async (tc) => {
        results.set(tc, await runBuildToolCall(api, tc, stepCreated));
      });
      if (!turn) return;

      // No tool calls means the model chose to just talk — it's done.
      if (turn.toolCalls.length === 0) return;

      // Lay out this step's new nodes, then verify the resulting geometry.
      sceneStore.runAutoLayout(api, canvasSummary);
      let verifyNote = "";
      if (stepCreated.size > 0) {
        const verifyResult = verifyAndFix(api, sceneStore, stepCreated);
        if (verifyResult.fixedCount > 0) {
          addMessage("tool-activity", `auto-adjusted ${verifyResult.fixedCount} geometry issue(s)`);
        }
        const unresolved = verifyResult.issues.filter((i) => !i.autoFixed);
        if (unresolved.length > 0) {
          verifyNote = ["Geometry issues remain after auto-layout:", ...unresolved.map((i) => `- ${i.detail}`)].join("\n");
        }
      }

      // Feed the model its own assistant turn plus a result for every tool call,
      // so the next round is grounded in what actually happened on the canvas.
      apiMessages.push({
        role: "assistant",
        content: turn.assistantText,
        tool_calls: turn.toolCalls.map((tc) => ({
          id: toolCallId(tc, step),
          type: "function",
          function: { name: tc.name, arguments: tc.arguments || "{}" },
        })),
      });
      for (const tc of turn.toolCalls) {
        const result = results.get(tc);
        apiMessages.push({
          role: "tool",
          tool_call_id: toolCallId(tc, step),
          content: JSON.stringify(
            result && !result.ok ? { ok: false, reason: result.reason } : { ok: true },
          ),
        });
      }
      if (verifyNote) {
        apiMessages.push({
          role: "user",
          content: `${verifyNote}\nCall the tools needed to fix these, then stop. If everything looks correct, just say so without calling any tools.`,
        });
      } else {
        // Nudge toward termination so a satisfied model doesn't keep drawing.
        apiMessages.push({
          role: "user",
          content:
            "Your tool calls were applied. If the diagram now fully satisfies the request, reply with a brief confirmation and DO NOT call any more tools. Only call tools if something still needs to be added or corrected.",
        });
      }

      if (step === MAX_AGENT_STEPS - 1) {
        addMessage("system-note", "Reached the step limit for this request — send another message to continue.");
      }
    }
  }

  async function sendMessage(userText: string, modeOverride?: ChatMode) {
    if (!userText.trim() || isStreaming) return;
    if (!excalidrawApi) return;

    if (!apiKey) {
      addMessage("system-note", "Add an API key in settings before chatting.");
      onOpenSettings();
      return;
    }

    // Pull in any manual edits made since the last turn before mutating anything this turn.
    sceneStore.beginTurn(excalidrawApi);

    const effectiveMode = modeOverride ?? mode;
    const isFirstMessage = messages.length === 0;
    addMessage("user", userText);
    if (isFirstMessage) {
      localStorage.setItem(
        pendingDrawingNameKey(currentDrawingId),
        formatDrawingName(userText),
      );
    }

    const history: ApiMessage[] = [...messages, { id: "tmp", role: "user" as const, content: userText }]
      .filter(
        (m) =>
          m.role === "user" || m.role === "assistant" || m.role === "question" || m.role === "plan",
      )
      .map((m) => ({
        role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      }));

    setIsStreaming(true);
    try {
      if (effectiveMode === "build") {
        await runBuildLoop(excalidrawApi, history);
      } else {
        // Plan mode is a single shot: the model asks one question or proposes a
        // plan for the user to approve — there are no canvas results to feed back.
        // Some models emit ask_question/propose_plan more than once per turn;
        // only the first should reach the UI.
        let planToolCalledThisTurn = false;
        const canvasSummary = buildCanvasSummary(excalidrawApi.getSceneElements());
        await streamTurn(history, canvasSummary, "plan", async (tc) => {
          if (planToolCalledThisTurn) return;
          if (runPlanToolCall(tc)) planToolCalledThisTurn = true;
        });
      }
    } catch (err) {
      addMessage("system-note", `Request failed: ${(err as Error).message}`);
    } finally {
      setIsStreaming(false);
    }
  }

  const provider = getProvider(providerId);

  const isThinking = isStreaming && !messages.some((m) => m.id === "streaming-assistant");

  const settingsModal = (
    <SettingsModal
      open={settingsOpen}
      onClose={onCloseSettings}
      providerId={providerId}
      onProviderChange={(id) => {
        setProviderId(id);
        setModel(getProvider(id).defaultModel);
      }}
      apiKey={apiKey}
      onApiKeyChange={setApiKey}
      model={model}
      onModelChange={setModel}
    />
  );

  const mainContent =
    messages.length === 0 ? (
      <EmptyState
        onSubmit={(text) => void sendMessage(text)}
        isStreaming={isStreaming}
        onOpenSettings={onOpenSettings}
        hasApiKey={!!apiKey}
        mode={mode}
        onModeChange={setMode}
      />
    ) : (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
          <span className="truncate text-xs text-muted">
            {provider.label} · {model} · <span className="capitalize text-foreground">{mode}</span>
          </span>
          <span className="shrink-0 text-[10px] text-dim">
            {saveStatus === "saving" ? "saving…" : saveStatus === "saved" ? "saved" : ""}
          </span>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onAnswerQuestion={handleAnswerQuestion}
              onApprovePlan={handleApprovePlan}
              onRefinePlan={handleRefinePlan}
            />
          ))}
          {isThinking && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-dim">sketter</span>
              <div className="flex max-w-[85%] items-center gap-2 rounded-2xl rounded-tl-md border border-border bg-surface px-5 py-3 text-sm text-foreground animate-pulse">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <span>{mode === "plan" ? "thinking…" : "drawing…"}</span>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border p-3">
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={(text) => {
              setInput("");
              void sendMessage(text);
            }}
            isStreaming={isStreaming}
            mode={mode}
            onModeChange={setMode}
            rows={1}
          />
        </div>
      </div>
    );

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {sidebarOpen && (
        <ChatSidebar
          drawings={drawings}
          currentDrawingId={currentDrawingId}
          onNewChat={onNewChat}
          onLoadDrawing={onLoadDrawing}
        />
      )}
      <div className="relative min-h-0 flex-1">{mainContent}</div>
      {settingsModal}
    </div>
  );
}
