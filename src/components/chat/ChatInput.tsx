"use client";

import type { ChatMode } from "@/lib/chat/mode";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  isStreaming: boolean;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  placeholder?: string;
  rows?: number;
}

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  isStreaming,
  mode,
  onModeChange,
  placeholder = "Describe or edit the diagram…",
  rows = 2,
}: ChatInputProps) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || isStreaming) return;
    onSubmit(value.trim());
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-xl border border-border bg-surface p-3 shadow-lg"
    >
      <div className="mb-2 flex justify-end">
        <div className="flex items-center gap-1 rounded-full border border-border p-0.5 text-[11px]">
          {(["plan", "build"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={
                "rounded-full px-2.5 py-1 capitalize transition-colors " +
                (mode === m ? "bg-accent text-background" : "text-muted hover:text-foreground")
              }
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
        placeholder={placeholder}
        rows={rows}
        disabled={isStreaming}
        className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-dim disabled:opacity-50"
      />
      <div className="mt-2 flex items-center justify-end">
        <button
          type="submit"
          disabled={isStreaming || !value.trim()}
          className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-background disabled:opacity-40"
        >
          {isStreaming ? (mode === "plan" ? "thinking…" : "drawing…") : "send"}
        </button>
      </div>
    </form>
  );
}
