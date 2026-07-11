"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clearAllDrawings, drawingsCount } from "@/lib/storage/drawings";
import { clearApiKey } from "@/lib/storage/apiKey";

interface DataSectionProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

export default function DataSection({ apiKey, onApiKeyChange }: DataSectionProps) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    void drawingsCount().then(setCount);
  }, []);

  function handleClearKey() {
    clearApiKey();
    onApiKeyChange("");
  }

  function handleClearDrawings() {
    if (count === 0 || count === null) return;
    if (!confirm(`Delete all ${count} saved drawing${count === 1 ? "" : "s"}? This can't be undone.`)) {
      return;
    }
    void clearAllDrawings().then(() => setCount(0));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-xs text-muted">
        api key
        <div className="flex items-center justify-between rounded border border-border px-3 py-2">
          <span className={apiKey ? "text-foreground" : "text-dim"}>
            {apiKey ? "key set" : "no key set"}
          </span>
          <button
            type="button"
            onClick={handleClearKey}
            disabled={!apiKey}
            className="text-xs text-accent hover:underline disabled:pointer-events-none disabled:opacity-40"
          >
            clear key
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 text-xs text-muted">
        saved drawings
        <div className="flex items-center justify-between rounded border border-border px-3 py-2">
          <span className="text-foreground">
            {count === null ? "…" : `${count} saved`}
          </span>
          <div className="flex items-center gap-3">
            <Link href="/my-drawings" className="text-xs text-muted hover:text-foreground">
              view
            </Link>
            <button
              type="button"
              onClick={handleClearDrawings}
              disabled={!count}
              className="text-xs text-accent hover:underline disabled:pointer-events-none disabled:opacity-40"
            >
              clear all
            </button>
          </div>
        </div>
        <span className="text-[10px] text-dim">
          drawings autosave locally to this browser via IndexedDB. clearing is permanent.
        </span>
      </div>
    </div>
  );
}
