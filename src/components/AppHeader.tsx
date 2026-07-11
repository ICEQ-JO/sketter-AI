"use client";

import Link from "next/link";
import { useTheme } from "@/lib/theme/useTheme";

function ThemeQuickToggle() {
  const [theme, setTheme] = useTheme();
  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="rounded border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {theme === "dark" ? "☀" : "◐"}
    </button>
  );
}

interface AppHeaderProps {
  onOpenSettings: () => void;
  showChat: boolean;
  showCanvas: boolean;
  onToggleChat: () => void;
  onToggleCanvas: () => void;
}

export default function AppHeader({
  onOpenSettings,
  showChat,
  showCanvas,
  onToggleChat,
  onToggleCanvas,
}: AppHeaderProps) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-background px-3">
      <Link href="/" className="text-xs text-muted hover:text-foreground">
        ← sketter
      </Link>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-border p-0.5 text-[11px]">
          <button
            type="button"
            onClick={onToggleChat}
            className={
              "rounded-full px-2.5 py-1 transition-colors " +
              (showChat ? "bg-accent text-background" : "text-muted hover:text-foreground")
            }
          >
            chat
          </button>
          <button
            type="button"
            onClick={onToggleCanvas}
            className={
              "rounded-full px-2.5 py-1 transition-colors " +
              (showCanvas ? "bg-accent text-background" : "text-muted hover:text-foreground")
            }
          >
            canvas
          </button>
        </div>

        <ThemeQuickToggle />

        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
          aria-label="Open settings"
          title="Settings"
        >
          ⚙
        </button>
      </div>
    </header>
  );
}
