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

export default function MessageBubble({ message }: { message: ChatMessage }) {
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
