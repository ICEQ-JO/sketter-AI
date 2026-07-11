"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteDrawing, listDrawings, renameDrawing, type SavedDrawing } from "@/lib/storage/drawings";

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DrawingsGallery() {
  const [drawings, setDrawings] = useState<SavedDrawing[] | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    void listDrawings().then(setDrawings);
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this drawing? This can't be undone.")) return;
    await deleteDrawing(id);
    setDrawings((prev) => prev?.filter((d) => d.id !== id) ?? null);
  }

  function startRename(d: SavedDrawing) {
    setRenamingId(d.id);
    setRenameValue(d.name);
  }

  async function commitRename(id: string) {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name) return;
    await renameDrawing(id, name);
    setDrawings((prev) => prev?.map((d) => (d.id === id ? { ...d, name } : d)) ?? null);
  }

  return (
    <div className="grain relative min-h-screen w-full bg-background px-8 py-16 text-foreground sm:px-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(700px 400px at 30% 20%, rgba(255,138,61,0.06), transparent 60%)",
        }}
      />

      <div className="relative z-10" style={{ animation: "fade-up 0.5s ease-out both" }}>
        <Link
          href="/"
          className="sketter-link inline-flex items-baseline gap-2 text-sm text-muted hover:text-foreground"
        >
          <span aria-hidden>←</span>
          <span className="label">back to sketter</span>
        </Link>

        <h1 className="mt-6 text-2xl font-semibold text-foreground">my drawings</h1>
        <p className="mt-2 max-w-md text-sm text-muted">
          everything you&apos;ve sketched, saved locally in this browser.
        </p>

        {drawings === null ? (
          <p className="mt-10 text-sm text-dim">loading…</p>
        ) : drawings.length === 0 ? (
          <p className="mt-10 text-sm text-dim">
            nothing saved yet — draw something in{" "}
            <Link href="/sketter" className="text-accent underline underline-offset-2">
              sketter ai
            </Link>{" "}
            and it&apos;ll show up here automatically.
          </p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {drawings.map((d) => (
              <div
                key={d.id}
                className="group flex flex-col overflow-hidden rounded-lg border border-border bg-surface"
              >
                <Link
                  href={`/sketter?drawingId=${d.id}`}
                  className="flex aspect-video items-center justify-center overflow-hidden bg-background/40"
                >
                  {d.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={d.thumbnail}
                      alt={d.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-dim">no preview</span>
                  )}
                </Link>
                <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
                  {renamingId === d.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => void commitRename(d.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void commitRename(d.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="w-full rounded border border-border bg-transparent px-1.5 py-0.5 text-xs text-foreground outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startRename(d)}
                      className="truncate text-left text-xs text-foreground hover:text-accent"
                    >
                      {d.name}
                    </button>
                  )}
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[10px] text-dim">{relativeTime(d.updatedAt)}</span>
                    <button
                      type="button"
                      onClick={() => void handleDelete(d.id)}
                      className="text-[11px] text-dim hover:text-accent"
                      aria-label={`Delete ${d.name}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
