"use client";

import { useTheme } from "@/lib/theme/useTheme";

export default function ThemeQuickToggle() {
  const [theme, setTheme] = useTheme();
  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="rounded border border-border px-3.5 py-2.5 text-base text-muted hover:text-foreground"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {/* SSR always guesses "dark" (no localStorage access); the inline
          theme-init script sets the real class before hydration, so the
          client's first render can legitimately differ here — expected,
          not a bug. */}
      <span suppressHydrationWarning>{theme === "dark" ? "☀" : "◐"}</span>
    </button>
  );
}
