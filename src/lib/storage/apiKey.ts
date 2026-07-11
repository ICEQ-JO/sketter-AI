const API_KEY_STORAGE_KEY = "sketter.apiKey";

export function hasApiKey(): boolean {
  return !!localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}
