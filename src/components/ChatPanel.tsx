"use client";

import { useEffect, useRef, useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { SceneStore } from "@/lib/canvas/sceneStore";
import { buildCanvasSummary } from "@/lib/canvas/summary";
import { executeToolCall } from "@/lib/tools/executor";
import type { ToolName } from "@/lib/tools/schema";
import { getProvider, DEFAULT_PROVIDER_ID } from "@/lib/providers/registry";
import EmptyState from "./EmptyState";
import SettingsModal from "./SettingsModal";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system-note";
  content: string;
}

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
}

export default function ChatPanel({ excalidrawApi, sceneStore }: ChatPanelProps) {
  const [providerId, setProviderId] = useState(
    () => localStorage.getItem("sketter.providerId") ?? DEFAULT_PROVIDER_ID,
  );
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("sketter.apiKey") ?? "");
  const [model, setModel] = useState(
    () => localStorage.getItem("sketter.model") ?? getProvider(DEFAULT_PROVIDER_ID).defaultModel,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function addMessage(role: ChatMessage["role"], content: string) {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role, content }]);
  }

  async function runToolCall(api: ExcalidrawImperativeAPI, tc: StreamingToolCall) {
    let args: Record<string, unknown> = {};
    try {
      args = tc.arguments ? JSON.parse(tc.arguments) : {};
    } catch {
      addMessage("system-note", `Model produced malformed arguments for ${tc.name}, skipped.`);
      return;
    }
    const result = await executeToolCall(api, sceneStore, tc.name as ToolName, args);
    if (!result.ok) {
      addMessage("system-note", `Skipped ${tc.name}: ${result.reason}`);
    }
  }

  async function sendMessage(userText: string) {
    if (!userText.trim() || isStreaming) return;
    if (!excalidrawApi) return;

    if (!apiKey) {
      addMessage("system-note", "Add an API key in settings before chatting.");
      setSettingsOpen(true);
      return;
    }

    addMessage("user", userText);

    const history = [...messages, { id: "tmp", role: "user" as const, content: userText }]
      .filter((m) => m.role !== "system-note")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const canvasSummary = buildCanvasSummary(excalidrawApi.getSceneElements());

    setIsStreaming(true);
    let assistantText = "";
    const toolCalls = new Map<number, StreamingToolCall>();
    let lastIndex = -1;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, model, messages: history, canvasSummary }),
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
                await runToolCall(excalidrawApi, prevCall);
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
          await runToolCall(excalidrawApi, tc);
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    setInput("");
    void sendMessage(text);
  }

  const provider = getProvider(providerId);

  const settingsModal = (
    <SettingsModal
      open={settingsOpen}
      onClose={() => setSettingsOpen(false)}
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
          onOpenSettings={() => setSettingsOpen(true)}
          hasApiKey={!!apiKey}
        />
        {settingsModal}
      </>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs text-muted">
          {provider.label} · {model}
        </span>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="text-xs text-muted hover:text-foreground"
          aria-label="Open settings"
        >
          ⚙
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] rounded-lg bg-accent px-3 py-2 text-sm text-background"
                : m.role === "system-note"
                  ? "max-w-full rounded border border-accent-dim bg-accent/10 px-3 py-1.5 text-xs text-accent"
                  : "max-w-[85%] rounded-lg border border-border bg-white/[0.03] px-3 py-2 text-sm text-foreground"
            }
          >
            {m.content || (m.role === "assistant" ? "…" : "")}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe or edit the diagram…"
          disabled={isStreaming}
          className="flex-1 rounded border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-dim disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
        >
          {isStreaming ? "Drawing…" : "Send"}
        </button>
      </form>

      {settingsModal}
    </div>
  );
}
