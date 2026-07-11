"use client";

import { useState } from "react";
import { SKETTER_BANNER } from "@/lib/ascii/banner";
import AnimatedBackground from "@/components/AnimatedBackground";
import ChatInput from "@/components/chat/ChatInput";
import type { ChatMode } from "@/lib/chat/mode";

interface EmptyStateProps {
  onSubmit: (text: string) => void;
  isStreaming: boolean;
  onOpenSettings: () => void;
  hasApiKey: boolean;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
}

const QUICK_PROMPTS = [
  { label: "architecture", prompt: "Draw a simple web app architecture: client, API, database." },
  { label: "flowchart", prompt: "Draw a flowchart for a user sign-up flow with an email verification step." },
  { label: "mind map", prompt: "Draw a mind map for planning a small product launch." },
  { label: "er diagram", prompt: "Draw an entity-relationship diagram for a blog: users, posts, comments." },
];

export default function EmptyState({
  onSubmit,
  isStreaming,
  onOpenSettings,
  hasApiKey,
  mode,
  onModeChange,
}: EmptyStateProps) {
  const [value, setValue] = useState("");

  function handleSubmit(text: string) {
    onSubmit(text);
    setValue("");
  }

  return (
    <div className="grain absolute inset-0 z-10 flex flex-col items-center justify-center overflow-hidden bg-background px-6">
      <AnimatedBackground />

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center">
        <pre
          className="select-none whitespace-pre text-center text-[5px] leading-[6px] text-accent sm:text-[8px] sm:leading-[9px]"
          style={{ animation: "fade-up 0.6s ease-out both" }}
          aria-label="Sketter"
        >
          {SKETTER_BANNER}
        </pre>
        <p
          className="mt-4 text-sm text-muted"
          style={{ animation: "fade-up 0.6s ease-out 0.1s both" }}
        >
          chat to draw. iterate live.
        </p>

        <div className="mt-8 w-full" style={{ animation: "fade-up 0.6s ease-out 0.2s both" }}>
          <ChatInput
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            isStreaming={isStreaming}
            mode={mode}
            onModeChange={onModeChange}
            placeholder="Describe the diagram you want to draw…"
          />
        </div>

        <div
          className="mt-4 flex flex-wrap justify-center gap-2"
          style={{ animation: "fade-up 0.6s ease-out 0.3s both" }}
        >
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp.label}
              type="button"
              onClick={() => setValue(qp.prompt)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted transition-colors hover:border-accent-dim hover:text-foreground"
            >
              {qp.label}
            </button>
          ))}
        </div>

        {!hasApiKey && (
          <p className="mt-6 text-xs text-dim">
            add an OpenRouter API key in{" "}
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-accent underline underline-offset-2"
            >
              settings
            </button>{" "}
            to get started.
          </p>
        )}
      </div>
    </div>
  );
}
