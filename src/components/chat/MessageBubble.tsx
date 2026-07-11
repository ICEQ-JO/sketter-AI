"use client";

import { useState } from "react";
import type { ChatMessage } from "./types";

function renderInline(content: string) {
  const parts = content.split(/(`[^`]+`)/g);
  return parts.map((part, i) =>
    part.startsWith("`") && part.endsWith("`") && part.length > 1 ? (
      <code key={i} className="rounded bg-surface-strong px-1 py-0.5 text-[0.85em]">
        {part.slice(1, -1)}
      </code>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function QuestionTextAnswer({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
      }}
      className="mt-2 flex gap-1"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="your answer…"
        className="flex-1 rounded border border-border bg-transparent px-2 py-1 text-xs text-foreground outline-none placeholder:text-dim"
      />
      <button
        type="submit"
        className="rounded bg-accent px-2 py-1 text-xs font-medium text-background"
      >
        ok
      </button>
    </form>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  onAnswerQuestion?: (id: string, answer: string) => void;
  onApprovePlan?: (id: string) => void;
}

export default function MessageBubble({
  message,
  onAnswerQuestion,
  onApprovePlan,
}: MessageBubbleProps) {
  if (message.role === "tool-activity") {
    return (
      <div className="flex items-center gap-2 rounded border border-border/60 bg-surface px-2.5 py-1 text-[11px] text-muted">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
        <span className="truncate font-mono">{message.content}</span>
      </div>
    );
  }

  if (message.role === "system-note") {
    return (
      <div className="max-w-full rounded border border-accent-dim bg-accent/10 px-3 py-1.5 text-xs text-accent">
        {message.content}
      </div>
    );
  }

  if (message.role === "question") {
    const q = message.question ?? {};
    return (
      <div className="max-w-[95%] rounded-lg border border-accent-dim bg-surface px-3 py-2 text-sm text-foreground">
        <p className="text-[10px] uppercase tracking-wide text-dim">question</p>
        <p className="mt-1">{message.content}</p>
        {q.answered ? (
          <p className="mt-2 text-xs text-accent">→ {q.answer}</p>
        ) : q.options && q.options.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {q.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onAnswerQuestion?.(message.id, opt)}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted transition-colors hover:border-accent-dim hover:text-foreground"
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <QuestionTextAnswer onSubmit={(text) => onAnswerQuestion?.(message.id, text)} />
        )}
      </div>
    );
  }

  if (message.role === "plan") {
    const p = message.plan ?? {};
    const nodes = p.nodes ?? [];
    const edges = p.edges ?? [];
    const labelById = new Map(nodes.map((n) => [n.id, n.label]));
    const groups = new Map<string, typeof nodes>();
    const ungrouped: typeof nodes = [];
    for (const n of nodes) {
      if (n.group) {
        if (!groups.has(n.group)) groups.set(n.group, []);
        groups.get(n.group)!.push(n);
      } else {
        ungrouped.push(n);
      }
    }

    return (
      <div className="max-w-[95%] rounded-lg border border-accent-dim bg-surface px-3 py-2 text-sm text-foreground">
        <p className="text-[10px] uppercase tracking-wide text-dim">proposed plan</p>
        <p className="mt-1">{p.summary ?? message.content}</p>

        {(ungrouped.length > 0 || groups.size > 0) && (
          <div className="mt-2 space-y-1.5 text-xs text-muted">
            {ungrouped.map((n) => (
              <div key={n.id}>
                • {n.label} <span className="text-dim">({n.type})</span>
              </div>
            ))}
            {Array.from(groups.entries()).map(([group, members]) => (
              <div key={group}>
                <span className="text-foreground">{group}:</span>{" "}
                {members.map((n) => n.label).join(", ")}
              </div>
            ))}
          </div>
        )}

        {edges.length > 0 && (
          <div className="mt-2 space-y-1 text-xs text-dim">
            {edges.map((e, i) => (
              <div key={i}>
                {labelById.get(e.from) ?? e.from} → {labelById.get(e.to) ?? e.to}
                {e.label ? ` (${e.label})` : ""}
              </div>
            ))}
          </div>
        )}

        {p.approved ? (
          <p className="mt-3 text-xs text-accent">✓ approved — building…</p>
        ) : (
          <button
            type="button"
            onClick={() => onApprovePlan?.(message.id)}
            className="mt-3 rounded bg-accent px-3 py-1.5 text-xs font-medium text-background"
          >
            approve &amp; build
          </button>
        )}
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-lg bg-accent px-3 py-2 text-sm text-background">
        {message.content}
      </div>
    );
  }

  return (
    <div className="max-w-[85%] whitespace-pre-wrap rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
      {message.content ? renderInline(message.content) : "…"}
    </div>
  );
}
