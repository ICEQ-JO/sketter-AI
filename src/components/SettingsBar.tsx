"use client";

import { useState } from "react";
import { CURATED_MODELS } from "@/lib/openrouter/models";

interface SettingsBarProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  model: string;
  onModelChange: (model: string) => void;
}

export default function SettingsBar({
  apiKey,
  onApiKeyChange,
  model,
  onModelChange,
}: SettingsBarProps) {
  const [showKey, setShowKey] = useState(false);
  const isCustom = !CURATED_MODELS.some((m) => m.id === model);

  return (
    <div className="flex flex-col gap-2 border-b border-black/10 p-3 dark:border-white/10">
      <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
        OpenRouter API key
        <div className="flex gap-1">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="sk-or-v1-..."
            className="w-full rounded border border-black/15 bg-transparent px-2 py-1 text-sm text-black outline-none dark:border-white/15 dark:text-white"
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            className="shrink-0 rounded border border-black/15 px-2 text-xs dark:border-white/15"
          >
            {showKey ? "hide" : "show"}
          </button>
        </div>
        <span className="text-[10px] text-black/40 dark:text-white/40">
          Stored only in this browser&apos;s localStorage. Never sent anywhere but OpenRouter.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
        Model
        <select
          value={isCustom ? "__custom__" : model}
          onChange={(e) => {
            if (e.target.value === "__custom__") return;
            onModelChange(e.target.value);
          }}
          className="w-full rounded border border-black/15 bg-transparent px-2 py-1 text-sm text-black outline-none dark:border-white/15 dark:text-white"
        >
          {CURATED_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} ({m.tier})
            </option>
          ))}
          <option value="__custom__">Custom model slug…</option>
        </select>
        {isCustom && (
          <input
            type="text"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            placeholder="vendor/model-slug"
            className="w-full rounded border border-black/15 bg-transparent px-2 py-1 text-sm text-black outline-none dark:border-white/15 dark:text-white"
          />
        )}
      </label>
    </div>
  );
}
