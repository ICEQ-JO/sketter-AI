"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import ExcalidrawCanvas from "@/components/ExcalidrawCanvas";
import ChatPanel from "@/components/ChatPanel";
import { SceneStore } from "@/lib/canvas/sceneStore";
import { loadDrawing, pendingDrawingNameKey, saveDrawing } from "@/lib/storage/drawings";

const CURRENT_DRAWING_STORAGE_KEY = "sketter.currentDrawingId";
const AUTOSAVE_DEBOUNCE_MS = 1500;

function newDrawingId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `drawing-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export default function App() {
  const searchParams = useSearchParams();
  const [excalidrawApi, setExcalidrawApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [sceneStore] = useState(() => new SceneStore());
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const hasLoadedRef = useRef(false);
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currentDrawingId] = useState(() => {
    const fromUrl = searchParams.get("drawingId");
    if (fromUrl) return fromUrl;
    const stored = localStorage.getItem(CURRENT_DRAWING_STORAGE_KEY);
    if (stored) return stored;
    const id = newDrawingId();
    localStorage.setItem(CURRENT_DRAWING_STORAGE_KEY, id);
    return id;
  });

  useEffect(() => {
    localStorage.setItem(CURRENT_DRAWING_STORAGE_KEY, currentDrawingId);
  }, [currentDrawingId]);

  useEffect(() => {
    if (!excalidrawApi || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const drawingId = searchParams.get("drawingId");
    if (!drawingId) return;

    void loadDrawing(drawingId).then((saved) => {
      if (!saved) return;
      const { elements, appState, files } = saved.sceneData;
      excalidrawApi.updateScene({
        elements: [...elements],
        appState: appState as Parameters<typeof excalidrawApi.updateScene>[0]["appState"],
      });
      const fileList = Object.values(files);
      if (fileList.length > 0) excalidrawApi.addFiles(fileList);
    });
  }, [excalidrawApi, searchParams]);

  useEffect(() => {
    excalidrawApiRef.current = excalidrawApi;
  }, [excalidrawApi]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  function handleSceneChange() {
    const api = excalidrawApiRef.current;
    if (!api) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setSaveStatus("saving");
    autosaveTimerRef.current = setTimeout(async () => {
      try {
        const existing = await loadDrawing(currentDrawingId);
        const pendingName = localStorage.getItem(pendingDrawingNameKey(currentDrawingId));
        await saveDrawing(api, {
          id: currentDrawingId,
          name: existing?.name ?? pendingName ?? "untitled sketch",
        });
        setSaveStatus("saved");
      } catch {
        setSaveStatus("idle");
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  return (
    <div className="relative flex h-screen w-screen flex-1 overflow-hidden bg-background">
      <aside className="flex w-[360px] shrink-0 flex-col border-r border-border">
        <ChatPanel
          excalidrawApi={excalidrawApi}
          sceneStore={sceneStore}
          currentDrawingId={currentDrawingId}
          saveStatus={saveStatus}
        />
      </aside>
      <main className="flex-1">
        <ExcalidrawCanvas onReady={setExcalidrawApi} onSceneChange={handleSceneChange} />
      </main>
    </div>
  );
}
