"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import ExcalidrawCanvas from "@/components/ExcalidrawCanvas";
import { formatDrawingName, newDrawingId, saveDrawing } from "@/lib/storage/drawings";

const PARSE_DEBOUNCE_MS = 400;

const EXAMPLE = `graph TD
  A[start] --> B{decide}
  B -->|yes| C[do the thing]
  B -->|no| D[skip it]
  C --> E[done]
  D --> E`;

type Status = "idle" | "saving" | "saved";

/**
 * mermaid-to-excalidraw falls back to rendering an uneditable flattened image
 * when it can't convert certain constructs (e.g. some subgraph layouts) to
 * live shapes — and logs that via console.error even though it recovered.
 * Silence just that known, non-fatal message so it doesn't trip Next's dev
 * error overlay; anything else still reaches the console untouched.
 */
async function parseMermaidQuietly(
  definition: string,
): Promise<ReturnType<typeof import("@excalidraw/mermaid-to-excalidraw")["parseMermaidToExcalidraw"]>> {
  const { parseMermaidToExcalidraw } = await import("@excalidraw/mermaid-to-excalidraw");
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("Error processing Mermaid diagram")) return;
    originalConsoleError(...args);
  };
  try {
    return await parseMermaidToExcalidraw(definition);
  } finally {
    console.error = originalConsoleError;
  }
}

export default function MermaidStudio() {
  const router = useRouter();
  const [source, setSource] = useState(EXAMPLE);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [excalidrawApi, setExcalidrawApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const drawingIdRef = useRef<string>(newDrawingId());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!excalidrawApi) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const definition = source.trim();
      if (!definition) {
        excalidrawApi.resetScene();
        setError(null);
        setNotice(null);
        return;
      }
      try {
        const [{ elements, files }, { convertToExcalidrawElements }] = await Promise.all([
          parseMermaidQuietly(definition),
          import("@excalidraw/excalidraw"),
        ]);
        // regenerateIds: true — convertToExcalidrawElements tracks emitted ids in a
        // store that persists across calls, so re-parsing on every keystroke with
        // stable mermaid-derived ids trips its "duplicate id" guard and corrupts
        // arrows. Minting fresh ids each parse avoids that entirely.
        const converted = convertToExcalidrawElements(elements, { regenerateIds: true }).map(
          (el) => ({ ...el, groupIds: [] }),
        );
        excalidrawApi.updateScene({ elements: converted });
        if (files) {
          const fileList = Object.values(files);
          if (fileList.length > 0) excalidrawApi.addFiles(fileList);
        }
        excalidrawApi.scrollToContent(converted, { fitToContent: true });
        setError(null);
        setNotice(
          converted.length === 1 && converted[0].type === "image"
            ? "this diagram couldn't be fully converted to editable shapes, so it's shown as a flattened image instead."
            : null,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "couldn't parse this diagram");
      }
    }, PARSE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [source, excalidrawApi]);

  function drawingName(): string {
    return formatDrawingName("mermaid diagram") || "mermaid diagram";
  }

  async function handleSave(): Promise<void> {
    if (!excalidrawApi) return;
    setStatus("saving");
    await saveDrawing(excalidrawApi, { id: drawingIdRef.current, name: drawingName() });
    setStatus("saved");
  }

  async function handleOpenInSketter(): Promise<void> {
    if (!excalidrawApi) return;
    setStatus("saving");
    await saveDrawing(excalidrawApi, { id: drawingIdRef.current, name: drawingName() });
    router.push(`/sketter?drawingId=${drawingIdRef.current}`);
  }

  async function handleDownloadJson(): Promise<void> {
    if (!excalidrawApi) return;
    const { serializeAsJSON } = await import("@excalidraw/excalidraw");
    const json = serializeAsJSON(
      excalidrawApi.getSceneElements(),
      excalidrawApi.getAppState(),
      excalidrawApi.getFiles(),
      "local",
    );
    downloadBlob(new Blob([json], { type: "application/json" }), `${drawingName()}.excalidraw`);
  }

  async function handleDownloadPng(): Promise<void> {
    if (!excalidrawApi) return;
    const { exportToBlob } = await import("@excalidraw/excalidraw");
    const elements = excalidrawApi.getSceneElements();
    if (elements.length === 0) return;
    const blob = await exportToBlob({
      elements,
      appState: { ...excalidrawApi.getAppState(), exportBackground: true },
      files: excalidrawApi.getFiles(),
      mimeType: "image/png",
    });
    downloadBlob(blob, `${drawingName()}.png`);
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
        <Link
          href="/"
          className="flex items-center gap-2 rounded px-3 py-2 text-base font-medium text-muted transition-colors hover:text-foreground"
        >
          <span aria-hidden>←</span>
          <span>sketter</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="mr-1 text-[11px] text-dim">
            {status === "saving" ? "saving…" : status === "saved" ? "saved" : ""}
          </span>
          <button
            type="button"
            onClick={() => void handleDownloadPng()}
            className="rounded border border-border px-3 py-2 text-xs text-muted hover:text-foreground"
          >
            download png
          </button>
          <button
            type="button"
            onClick={() => void handleDownloadJson()}
            className="rounded border border-border px-3 py-2 text-xs text-muted hover:text-foreground"
          >
            download .excalidraw
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            className="rounded border border-border px-3 py-2 text-xs text-muted hover:text-foreground"
          >
            save to my drawings
          </button>
          <button
            type="button"
            onClick={() => void handleOpenInSketter()}
            className="rounded bg-accent px-3 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90"
          >
            open in sketter ai
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-[380px] shrink-0 flex-col border-r border-border">
          <div className="border-b border-border px-4 py-3">
            <h1 className="text-sm font-medium text-foreground">mermaid → canvas</h1>
            <p className="mt-1 text-xs text-muted">
              paste mermaid syntax on the left, get a live excalidraw canvas on the right.
            </p>
          </div>
          <textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            spellCheck={false}
            className="min-h-0 flex-1 resize-none bg-background p-4 font-mono text-xs text-foreground outline-none placeholder:text-dim"
            placeholder="graph TD&#10;  A --> B"
          />
          {error && (
            <div className="shrink-0 border-t border-border bg-surface px-4 py-3 text-xs text-red-400">
              {error}
            </div>
          )}
          {!error && notice && (
            <div className="shrink-0 border-t border-border bg-surface px-4 py-3 text-xs text-amber-400">
              {notice}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1">
          <ExcalidrawCanvas onReady={setExcalidrawApi} />
        </div>
      </div>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
