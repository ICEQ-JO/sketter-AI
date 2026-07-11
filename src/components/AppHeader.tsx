"use client";

import Link from "next/link";
import { useTheme } from "@/lib/theme/useTheme";

function ThemeQuickToggle() {
  const [theme, setTheme] = useTheme();
  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="rounded border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {theme === "dark" ? "☀" : "◐"}
    </button>
  );
}

function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="8" x2="20" y2="8" />
      <line x1="4" y1="16" x2="20" y2="16" />
    </svg>
  );
}

interface AppHeaderProps {
  onOpenSettings: () => void;
  showChat: boolean;
  showCanvas: boolean;
  onToggleChat: () => void;
  onToggleCanvas: () => void;
  onToggleSidebar: () => void;
}

export default function AppHeader({
  onOpenSettings,
  showChat,
  showCanvas,
  onToggleChat,
  onToggleCanvas,
  onToggleSidebar,
}: AppHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
          aria-label="Toggle chat sidebar"
          title="Chats"
        >
          <MenuIcon />
        </button>

        <Link
          href="/"
          className="flex items-center gap-1.5 rounded px-2 py-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          <span aria-hidden>←</span>
          <span>sketter</span>
        </Link>
      </div>

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
          className="rounded border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
          aria-label="Open settings"
          title="Settings"
        >
          ⚙
        </button>
      </div>
    </header>
  );
}
