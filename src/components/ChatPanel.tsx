"use client";

import { useEffect, useRef, useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { SceneStore } from "@/lib/canvas/sceneStore";
import { buildCanvasSummary } from "@/lib/canvas/summary";
import { executeToolCall } from "@/lib/tools/executor";
import type { ToolName } from "@/lib/tools/schema";
import { getProvider, DEFAULT_PROVIDER_ID } from "@/lib/providers/registry";
import { DEFAULT_MODE, MODE_STORAGE_KEY, type ChatMode } from "@/lib/chat/mode";
import { pendingDrawingNameKey } from "@/lib/storage/drawings";
import type { ChatMessage } from "@/components/chat/types";
import MessageBubble from "@/components/chat/MessageBubble";
import ChatInput from "@/components/chat/ChatInput";
import EmptyState from "./EmptyState";
import SettingsModal from "./SettingsModal";

interface StreamingToolCall {
  index: number;
  id: string;
  name: string;
  arguments: string;
  executed: boolean;
}

interface ChatPanelProps {
  excalidrawApi: ExcalidrawImperativeAPI | null;
  sceneStore: SceneStore;
  currentDrawingId: string;
  saveStatus: "idle" | "saving" | "saved";
  settingsOpen: boolean;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
}

export default function ChatPanel({
  excalidrawApi,
  sceneStore,
  currentDrawingId,
  saveStatus,
  settingsOpen,
  onOpenSettings,
  onCloseSettings,
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
  const scrollRef = useRef<HTMLDivElement>(null);

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

  async function runBuildToolCall(api: ExcalidrawImperativeAPI, tc: StreamingToolCall) {
    let args: Record<string, unknown> = {};
    try {
      args = tc.arguments ? JSON.parse(tc.arguments) : {};
    } catch {
      addMessage("system-note", `Model produced malformed arguments for ${tc.name}, skipped.`);
      return;
    }
    const activityId = addMessage(
      "tool-activity",
      `${tc.name}(${Object.entries(args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ")})`,
    );
    const result = await executeToolCall(api, sceneStore, tc.name as ToolName, args);
    if (!result.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== activityId));
      addMessage("system-note", `Skipped ${tc.name}: ${result.reason}`);
    }
  }

  function runPlanToolCall(tc: StreamingToolCall) {
    let args: Record<string, unknown> = {};
    try {
      args = tc.arguments ? JSON.parse(tc.arguments) : {};
    } catch {
      addMessage("system-note", `Model produced malformed arguments for ${tc.name}, skipped.`);
      return;
    }
    if (tc.name === "ask_question") {
      const { question, options } = args as { question: string; options?: string[] };
      addMessage("question", question, { question: { options, answered: false } });
    } else if (tc.name === "propose_plan") {
      const { plan } = args as { plan: string };
      addMessage("plan", plan, { plan: { approved: false } });
    }
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
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, plan: { ...m.plan, approved: true } } : m)),
    );
    setMode("build");
    void sendMessage("Proceed and build the plan above exactly as described.", "build");
  }

  async function sendMessage(userText: string, modeOverride?: ChatMode) {
    if (!userText.trim() || isStreaming) return;
    if (!excalidrawApi) return;

    if (!apiKey) {
      addMessage("system-note", "Add an API key in settings before chatting.");
      onOpenSettings();
      return;
    }

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

    async function handleCompletedToolCall(tc: StreamingToolCall) {
      if (effectiveMode === "build") {
        if (!excalidrawApi) return;
        await runBuildToolCall(excalidrawApi, tc);
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

      setMessages((prev) =>
        prev.map((m) => (m.id === "streaming-assistant" ? { ...m, id: crypto.randomUUID() } : m)),
      );
    } catch (err) {
      addMessage("system-note", `Request failed: ${(err as Error).message}`);
    } finally {
      setIsStreaming(false);
    }
  }

  const provider = getProvider(providerId);

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

  if (messages.length === 0) {
    return (
      <>
        <EmptyState
          onSubmit={(text) => void sendMessage(text)}
          isStreaming={isStreaming}
          onOpenSettings={onOpenSettings}
          hasApiKey={!!apiKey}
          mode={mode}
          onModeChange={setMode}
        />
        {settingsModal}
      </>
    );
  }

  return (
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

      {settingsModal}
    </div>
  );
}
