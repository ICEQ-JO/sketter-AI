export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "sketter.theme";
export const THEME_CHANGE_EVENT = "sketter:theme-change";

/** Sketter defaults to dark mode regardless of OS preference until the user picks a theme. */
export function getDefaultTheme(): Theme {
  return "dark";
}

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

export function setStoredTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  window.dispatchEvent(new CustomEvent<Theme>(THEME_CHANGE_EVENT, { detail: theme }));
}
