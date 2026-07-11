"use client";

import { useTheme } from "@/lib/theme/useTheme";

export default function ThemeToggle() {
  const [theme, setTheme] = useTheme();

  return (
    <div className="flex items-center gap-2">
      {(["dark", "light"] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTheme(t)}
          className={
            "flex items-center gap-2 rounded border px-3 py-1.5 text-xs capitalize transition-colors " +
            (theme === t
              ? "border-accent-dim bg-surface text-accent"
              : "border-border text-muted hover:text-foreground")
          }
        >
          <span aria-hidden>{t === "dark" ? "◐" : "☀"}</span>
          {t}
        </button>
      ))}
    </div>
  );
}
