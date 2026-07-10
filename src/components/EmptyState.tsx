"use client";

import { useState } from "react";
import { SKETTER_BANNER } from "@/lib/ascii/banner";

interface EmptyStateProps {
  onSubmit: (text: string) => void;
  isStreaming: boolean;
  onOpenSettings: () => void;
  hasApiKey: boolean;
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
}: EmptyStateProps) {
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue("");
  }

  return (
    <div className="grain fixed inset-0 z-40 flex flex-col items-center justify-center bg-background px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(700px 420px at 50% 38%, rgba(255,138,61,0.08), transparent 60%)",
        }}
      />

      <button
        type="button"
        onClick={onOpenSettings}
        className="absolute right-5 top-5 z-10 rounded border border-border px-2 py-1 text-xs text-muted transition-colors hover:text-foreground"
        aria-label="Open settings"
      >
        ⚙ settings
      </button>

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center">
        <pre
          className="select-none whitespace-pre text-center text-[6px] leading-[7px] text-accent sm:text-[9px] sm:leading-[10px]"
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

        <form
          onSubmit={handleSubmit}
          className="mt-8 w-full rounded-xl border border-border bg-white/[0.02] p-3 shadow-lg"
          style={{ animation: "fade-up 0.6s ease-out 0.2s both" }}
        >
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Describe the diagram you want to draw…"
            rows={2}
            disabled={isStreaming}
            className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-dim disabled:opacity-50"
          />
          <div className="mt-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={isStreaming || !value.trim()}
              className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-background disabled:opacity-40"
            >
              {isStreaming ? "drawing…" : "send"}
            </button>
          </div>
        </form>

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
