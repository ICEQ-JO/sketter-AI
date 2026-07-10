"use client";

import { useState } from "react";
import { PROVIDERS, getProvider } from "@/lib/providers/registry";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  providerId: string;
  onProviderChange: (id: string) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  model: string;
  onModelChange: (model: string) => void;
}

export default function SettingsModal({
  open,
  onClose,
  providerId,
  onProviderChange,
  apiKey,
  onApiKeyChange,
  model,
  onModelChange,
}: SettingsModalProps) {
  const [showKey, setShowKey] = useState(false);
  const availableProviders = PROVIDERS.filter((p) => p.status === "available");
  const provider = getProvider(providerId);
  const isCustomModel = !provider.models.some((m) => m.id === model);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="grain w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-2xl"
        style={{ animation: "fade-up 0.2s ease-out both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-dim hover:text-foreground"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-xs text-muted">
            provider
            <select
              value={providerId}
              onChange={(e) => onProviderChange(e.target.value)}
              className="rounded border border-border bg-transparent px-2 py-1.5 text-sm text-foreground outline-none"
            >
              {availableProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-dim">
              more providers (OpenAI, Anthropic direct) are on the roadmap.
            </span>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            {provider.label} API key
            <div className="flex gap-1">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                placeholder={provider.apiKeyPlaceholder}
                className="w-full rounded border border-border bg-transparent px-2 py-1.5 text-sm text-foreground outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="shrink-0 rounded border border-border px-2 text-xs text-muted hover:text-foreground"
              >
                {showKey ? "hide" : "show"}
              </button>
            </div>
            <span className="text-[10px] text-dim">
              stored only in this browser&apos;s localStorage, sent only to {provider.label}.
            </span>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            model
            <select
              value={isCustomModel ? "__custom__" : model}
              onChange={(e) => {
                if (e.target.value === "__custom__") return;
                onModelChange(e.target.value);
              }}
              className="rounded border border-border bg-transparent px-2 py-1.5 text-sm text-foreground outline-none"
            >
              {provider.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.tier})
                </option>
              ))}
              <option value="__custom__">custom model slug…</option>
            </select>
            {isCustomModel && (
              <input
                type="text"
                value={model}
                onChange={(e) => onModelChange(e.target.value)}
                placeholder="vendor/model-slug"
                className="mt-1 rounded border border-border bg-transparent px-2 py-1.5 text-sm text-foreground outline-none"
              />
            )}
          </label>
        </div>
      </div>
    </div>
  );
}
