"use client";

import { useState } from "react";
import AppearanceSection from "./settings/AppearanceSection";
import ProviderSection from "./settings/ProviderSection";
import DataSection from "./settings/DataSection";

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

const TABS = [
  { id: "appearance", label: "appearance" },
  { id: "provider", label: "ai provider" },
  { id: "data", label: "data" },
] as const;

type TabId = (typeof TABS)[number]["id"];

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
  const [activeTab, setActiveTab] = useState<TabId>("provider");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="grain flex h-[520px] w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
        style={{ animation: "fade-up 0.2s ease-out both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <nav className="flex w-40 shrink-0 flex-col gap-1 border-r border-border p-3">
          <span className="mb-2 px-2 text-sm font-semibold text-foreground">settings</span>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={
                "rounded px-2 py-1.5 text-left text-xs transition-colors " +
                (activeTab === tab.id
                  ? "border-l-2 border-accent bg-surface text-accent"
                  : "border-l-2 border-transparent text-muted hover:text-foreground")
              }
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-end border-b border-border px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="text-dim hover:text-foreground"
              aria-label="Close settings"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === "appearance" && <AppearanceSection />}
            {activeTab === "provider" && (
              <ProviderSection
                providerId={providerId}
                onProviderChange={onProviderChange}
                apiKey={apiKey}
                onApiKeyChange={onApiKeyChange}
                model={model}
                onModelChange={onModelChange}
              />
            )}
            {activeTab === "data" && (
              <DataSection apiKey={apiKey} onApiKeyChange={onApiKeyChange} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
