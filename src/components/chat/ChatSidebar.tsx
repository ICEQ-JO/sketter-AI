"use client";

import type { SavedDrawing } from "@/lib/storage/drawings";

interface ChatSidebarProps {
  drawings: SavedDrawing[];
  currentDrawingId: string;
  onNewChat: () => void;
  onLoadDrawing: (id: string) => void;
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ChatSidebar({
  drawings,
  currentDrawingId,
  onNewChat,
  onLoadDrawing,
}: ChatSidebarProps) {
  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-surface">
      <div className="border-b border-border p-3">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full rounded bg-accent px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          + new chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <p className="mb-2 px-2 text-[10px] uppercase tracking-wide text-dim">
          previous chats
        </p>

        {drawings.length === 0 ? (
          <p className="px-2 text-xs text-muted">no saved chats yet.</p>
        ) : (
          <div className="space-y-1">
            {drawings.map((d, i) => {
              const isActive = d.id === currentDrawingId;
              return (
                <button
                  key={d.id || `drawing-${i}`}
                  type="button"
                  onClick={() => onLoadDrawing(d.id)}
                  title={d.name}
                  className={
                    "w-full rounded px-3 py-2.5 text-left text-xs transition-colors " +
                    (isActive
                      ? "bg-accent/10 text-foreground"
                      : "text-muted hover:bg-surface-strong hover:text-foreground")
                  }
                >
                  <span className="block line-clamp-2 leading-snug">{d.name}</span>
                  <span className="block mt-1 text-[10px] text-dim">
                    {relativeTime(d.updatedAt)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
