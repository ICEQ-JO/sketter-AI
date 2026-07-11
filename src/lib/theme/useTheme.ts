"use client";

import { useEffect, useState } from "react";
import {
  applyTheme,
  getStoredTheme,
  getSystemTheme,
  setStoredTheme,
  THEME_CHANGE_EVENT,
  type Theme,
} from "./theme";

function getInitialTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  if (document.documentElement.classList.contains("light")) return "light";
  if (document.documentElement.classList.contains("dark")) return "dark";
  return getStoredTheme() ?? getSystemTheme();
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const handler = (e: Event) => {
      const next = (e as CustomEvent<Theme>).detail;
      setTheme((prev) => (prev === next ? prev : next));
    };
    window.addEventListener(THEME_CHANGE_EVENT, handler);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handler);
  }, []);

  function updateTheme(next: Theme) {
    applyTheme(next);
    setStoredTheme(next);
    setTheme(next);
  }

  return [theme, updateTheme];
}
