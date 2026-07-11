"use client";

import { useState } from "react";
import type { ChatMessage } from "./types";

function renderInline(content: string) {
  const parts = content.split(/(`[^`]+`)/g);
  return parts.map((part, i) =>
    part.startsWith("`") && part.endsWith("`") && part.length > 1 ? (
      <code
        key={i}
        className="rounded bg-accent/10 px-1 py-0.5 text-[0.85em] font-medium text-accent"
      >
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
      className="mt-3 flex gap-2"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="your answer…"
        className="flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-dim"
      />
      <button
        type="submit"
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
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
  onRefinePlan?: (id: string) => void;
}

export default function MessageBubble({
  message,
  onAnswerQuestion,
  onApprovePlan,
  onRefinePlan,
}: MessageBubbleProps) {
  if (message.role === "tool-activity") {
    return (
      <div className="flex justify-center">
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-surface px-3 py-1 text-[11px] text-muted">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
          <span className="truncate font-mono">{message.content}</span>
        </div>
      </div>
    );
  }

  if (message.role === "system-note") {
    return (
      <div className="flex justify-center">
        <div className="max-w-full rounded-lg border border-accent-dim bg-accent/10 px-4 py-2 text-xs text-accent">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === "question") {
    const q = message.question ?? {};
    const canProceedToPlan = !q.answered;
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-dim">sketter</span>
        <div className="max-w-[95%] rounded-xl border border-accent-dim bg-surface p-4 text-sm text-foreground shadow-sm">
          <p className="text-base leading-relaxed">{message.content}</p>
          {q.answered ? (
            <p className="mt-3 text-sm text-accent">→ {q.answer}</p>
          ) : q.options && q.options.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onAnswerQuestion?.(message.id, opt)}
                  className="rounded-lg border border-border bg-background px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-accent hover:bg-accent/5"
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <QuestionTextAnswer onSubmit={(text) => onAnswerQuestion?.(message.id, text)} />
          )}

          {canProceedToPlan && (
            <div className="mt-3 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => onAnswerQuestion?.(message.id, "looks good — propose a plan")}
                className="text-xs text-dim transition-colors hover:text-accent"
              >
                looks good — propose a plan →
              </button>
            </div>
          )}
        </div>
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
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-dim">sketter</span>
        <div className="max-w-[95%] rounded-xl border border-accent-dim bg-surface p-4 text-sm text-foreground shadow-sm">
          <p className="text-[10px] uppercase tracking-wide text-dim">proposed plan</p>
          <p className="mt-1 text-base font-medium leading-relaxed text-foreground">
            {p.summary ?? message.content}
          </p>

          {(ungrouped.length > 0 || groups.size > 0) && (
            <div className="mt-3 space-y-2 text-sm text-muted">
              {ungrouped.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2"
                >
                  <span className="h-2 w-2 rounded-sm bg-accent/60" aria-hidden />
                  <span>{n.label}</span>
                  <span className="text-dim">({n.type})</span>
                </div>
              ))}
              {Array.from(groups.entries()).map(([group, members]) => (
                <div
                  key={group}
                  className="rounded-lg border border-border/60 bg-background px-3 py-2"
                >
                  <span className="font-medium text-foreground">{group}:</span>{" "}
                  <span className="text-muted">
                    {members.map((n) => n.label).join(", ")}
                  </span>
                </div>
              ))}
            </div>
          )}

          {edges.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-dim">
              {edges.map((e, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2.5 py-1"
                >
                  {labelById.get(e.from) ?? e.from}
                  <span className="text-accent">→</span>
                  {labelById.get(e.to) ?? e.to}
                  {e.label ? <span className="text-dim">({e.label})</span> : null}
                </span>
              ))}
            </div>
          )}

          {p.approved ? (
            <p className="mt-4 text-sm text-accent">✓ approved — building…</p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onApprovePlan?.(message.id)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                approve &amp; build
              </button>
              {onRefinePlan && (
                <button
                  type="button"
                  onClick={() => onRefinePlan(message.id)}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent-dim hover:text-foreground"
                >
                  keep refining
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="text-[10px] uppercase tracking-wide text-dim">you</span>
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-accent px-5 py-3 text-sm text-background shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-dim">sketter</span>
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-md border border-border bg-surface px-5 py-3 text-sm leading-relaxed text-foreground shadow-sm">
        {message.content ? renderInline(message.content) : "…"}
      </div>
    </div>
  );
}
