"use client";

import { useEffect, useRef, useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { SceneStore } from "@/lib/canvas/sceneStore";
import { buildCanvasSummary } from "@/lib/canvas/summary";
import { verifyAndFix } from "@/lib/canvas/verify";
import { executeToolCall } from "@/lib/tools/executor";
import type { ToolName } from "@/lib/tools/schema";
import { sanitizePlanToolCall } from "@/lib/tools/sanitize";
import { getProvider, DEFAULT_PROVIDER_ID } from "@/lib/providers/registry";
import { DEFAULT_MODE, MODE_STORAGE_KEY, type ChatMode } from "@/lib/chat/mode";
import { listDrawings, pendingDrawingNameKey } from "@/lib/storage/drawings";
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

/** Max corrective round-trips after a build turn if verification finds unresolved issues. */
const MAX_VERIFY_RETRIES = 2;

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

  /** Applies a single already-parsed build tool call — shared by streamed calls and the direct plan-approval path. */
  async function runBuildTool(
    api: ExcalidrawImperativeAPI,
    name: string,
    args: Record<string, unknown>,
    createdThisTurn: Set<string>,
  ) {
    const activityId = addMessage(
      "tool-activity",
      `${name}(${Object.entries(args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ")})`,
    );
    const result = await executeToolCall(api, sceneStore, name as ToolName, args);
    if (!result.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== activityId));
      addMessage("system-note", `Skipped ${name}: ${result.reason}`);
      return;
    }
    if ((name === "add_node" || name === "add_freeform") && typeof args.id === "string") {
      createdThisTurn.add(args.id);
    }
  }

  async function runBuildToolCall(
    api: ExcalidrawImperativeAPI,
    tc: StreamingToolCall,
    createdThisTurn: Set<string>,
  ) {
    let args: Record<string, unknown> = {};
    try {
      args = tc.arguments ? JSON.parse(tc.arguments) : {};
    } catch {
      addMessage("system-note", `Model produced malformed arguments for ${tc.name}, skipped.`);
      return;
    }
    await runBuildTool(api, tc.name, args, createdThisTurn);
  }

  function runPlanToolCall(tc: StreamingToolCall) {
    let args: Record<string, unknown> = {};
    try {
      args = tc.arguments ? JSON.parse(tc.arguments) : {};
    } catch {
      addMessage("system-note", `Model produced malformed arguments for ${tc.name}, skipped.`);
      return;
    }
    if (tc.name !== "ask_question" && tc.name !== "propose_plan") return;

    const sanitized = sanitizePlanToolCall({ name: tc.name, arguments: args });
    if (!sanitized.ok) {
      addMessage("system-note", `Model produced an invalid ${tc.name} call: ${sanitized.reason}`);
      return;
    }

    if (sanitized.name === "ask_question") {
      const { question, options } = sanitized.args as { question: string; options?: string[] };
      addMessage("question", question, { question: { options, answered: false } });
    } else {
      const { summary, nodes, edges } = sanitized.args as PlanData;
      addMessage("plan", summary ?? "", { plan: { approved: false, summary, nodes, edges } });
    }
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

  async function sendMessage(userText: string, modeOverride?: ChatMode, retryDepth = 0) {
    if (!userText.trim() || (isStreaming && retryDepth === 0)) return;
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
      localStorage.setItem(pendingDrawingNameKey(currentDrawingId), userText.slice(0, 40));
    }

    const history = [...messages, { id: "tmp", role: "user" as const, content: userText }]
      .filter(
        (m) =>
          m.role === "user" || m.role === "assistant" || m.role === "question" || m.role === "plan",
      )
      .map((m) => ({
        role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      }));

    const canvasSummary = buildCanvasSummary(excalidrawApi.getSceneElements());

    setIsStreaming(true);
    let assistantText = "";
    const toolCalls = new Map<number, StreamingToolCall>();
    let lastIndex = -1;
    const createdThisTurn = new Set<string>();

    async function handleCompletedToolCall(tc: StreamingToolCall) {
      if (effectiveMode === "build") {
        if (!excalidrawApi) return;
        await runBuildToolCall(excalidrawApi, tc, createdThisTurn);
      } else {
        runPlanToolCall(tc);
      }
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, model, messages: history, canvasSummary, mode: effectiveMode }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({ error: res.statusText }));
        addMessage("system-note", `Error: ${errBody.error ?? res.statusText}`);
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
                await handleCompletedToolCall(prevCall);
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
          await handleCompletedToolCall(tc);
        }
      }

      if (effectiveMode === "build" && excalidrawApi) {
        // No-ops if nothing is pending layout — safe to call unconditionally.
        sceneStore.runAutoLayout(excalidrawApi, canvasSummary);
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === "streaming-assistant" ? { ...m, id: crypto.randomUUID() } : m)),
      );

      if (effectiveMode === "build" && excalidrawApi && createdThisTurn.size > 0) {
        const verifyResult = verifyAndFix(excalidrawApi, sceneStore, createdThisTurn);
        const unresolved = verifyResult.issues.filter((i) => !i.autoFixed);
        if (verifyResult.fixedCount > 0) {
          addMessage(
            "tool-activity",
            `auto-adjusted ${verifyResult.fixedCount} geometry issue(s)`,
          );
        }
        if (unresolved.length > 0) {
          if (retryDepth < MAX_VERIFY_RETRIES) {
            const correctiveText = [
              "The diagram has issues you should fix:",
              ...unresolved.map((i) => `- ${i.detail}`),
              "Call the appropriate tools to correct these, then stop.",
            ].join("\n");
            await sendMessage(correctiveText, "build", retryDepth + 1);
          } else {
            addMessage(
              "system-note",
              `Diagram has ${unresolved.length} unresolved issue(s) after automatic correction attempts — you may want to describe what to fix.`,
            );
          }
        }
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

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onAnswerQuestion={handleAnswerQuestion}
              onApprovePlan={handleApprovePlan}
            />
          ))}
          {isThinking && (
            <div className="flex max-w-[85%] items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground animate-pulse">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>{mode === "plan" ? "sketter is thinking…" : "sketter is drawing…"}</span>
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
