export interface ModelOption {
  id: string;
  label: string;
  tier: "frontier" | "mid" | "cheap";
}

// Curated shortlist of models known to be reliable at structured tool-calling
// through OpenRouter, spanning frontier/mid/cheap so the "any model" claim is
// backed by a real spread, not just one provider. Advanced users can type a
// custom slug via the picker's free-text option.
export const CURATED_MODELS: ModelOption[] = [
  { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", tier: "frontier" },
  { id: "openai/gpt-5.1", label: "GPT-5.1", tier: "frontier" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", tier: "frontier" },
  { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5", tier: "mid" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini", tier: "mid" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", tier: "mid" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash", tier: "cheap" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", tier: "cheap" },
];

// Free-to-try default so people can test the app before committing spend.
export const DEFAULT_MODEL = "google/gemini-2.0-flash-001";
