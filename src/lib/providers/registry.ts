import { CURATED_MODELS, DEFAULT_MODEL, type ModelOption } from "@/lib/openrouter/models";

export interface Provider {
  id: string;
  label: string;
  status: "available" | "coming-soon";
  models: ModelOption[];
  defaultModel: string;
  apiKeyPlaceholder: string;
  apiKeyHelpUrl: string;
}

// Adding a provider later means: implement its /api/chat branch server-side,
// then add an entry here. The settings UI only ever renders "available" ones.
export const PROVIDERS: Provider[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    status: "available",
    models: CURATED_MODELS,
    defaultModel: DEFAULT_MODEL,
    apiKeyPlaceholder: "sk-or-v1-...",
    apiKeyHelpUrl: "https://openrouter.ai/keys",
  },
  {
    id: "openai",
    label: "OpenAI (direct)",
    status: "coming-soon",
    models: [],
    defaultModel: "",
    apiKeyPlaceholder: "sk-...",
    apiKeyHelpUrl: "",
  },
  {
    id: "anthropic",
    label: "Anthropic (direct)",
    status: "coming-soon",
    models: [],
    defaultModel: "",
    apiKeyPlaceholder: "sk-ant-...",
    apiKeyHelpUrl: "",
  },
];

export const DEFAULT_PROVIDER_ID = "openrouter";

export function getProvider(id: string): Provider {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}
