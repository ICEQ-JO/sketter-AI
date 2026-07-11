"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import ExcalidrawCanvas from "@/components/ExcalidrawCanvas";
import ChatPanel from "@/components/ChatPanel";
import AppHeader from "@/components/AppHeader";
import { SceneStore } from "@/lib/canvas/sceneStore";
import { loadDrawing, pendingDrawingNameKey, saveDrawing } from "@/lib/storage/drawings";

const CURRENT_DRAWING_STORAGE_KEY = "sketter.currentDrawingId";
const CHAT_WIDTH_STORAGE_KEY = "sketter.chatWidthPct";
const AUTOSAVE_DEBOUNCE_MS = 1500;
const MIN_PANEL_PCT = 20;
const MAX_PANEL_PCT = 80;
const DEFAULT_CHAT_WIDTH_PCT = 50;

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showCanvas, setShowCanvas] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatWidthPct, setChatWidthPct] = useState(() => {
    const stored = Number(localStorage.getItem(CHAT_WIDTH_STORAGE_KEY));
    return stored >= MIN_PANEL_PCT && stored <= MAX_PANEL_PCT ? stored : DEFAULT_CHAT_WIDTH_PCT;
  });
  const hasLoadedRef = useRef(false);
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
    localStorage.setItem(CHAT_WIDTH_STORAGE_KEY, String(chatWidthPct));
  }, [chatWidthPct]);

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

  function toggleChat() {
    if (showChat && !showCanvas) return;
    setShowChat((v) => !v);
  }

  function toggleCanvas() {
    if (showCanvas && !showChat) return;
    setShowCanvas((v) => !v);
  }

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    function onMove(ev: PointerEvent) {
      const rect = container!.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setChatWidthPct(Math.min(MAX_PANEL_PCT, Math.max(MIN_PANEL_PCT, pct)));
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      <AppHeader
        onOpenSettings={() => setSettingsOpen(true)}
        showChat={showChat}
        showCanvas={showCanvas}
        onToggleChat={toggleChat}
        onToggleCanvas={toggleCanvas}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />
      <div ref={containerRef} className="relative flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={
            (showChat ? "flex" : "hidden") +
            " relative min-h-0 shrink-0 flex-col overflow-hidden border-r border-border"
          }
          style={{ width: showChat ? (showCanvas ? `${chatWidthPct}%` : "100%") : undefined }}
        >
          <ChatPanel
            excalidrawApi={excalidrawApi}
            sceneStore={sceneStore}
            currentDrawingId={currentDrawingId}
            saveStatus={saveStatus}
            settingsOpen={settingsOpen}
            onCloseSettings={() => setSettingsOpen(false)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </aside>

        {showChat && showCanvas && (
          <div
            onPointerDown={startDrag}
            className="w-1 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-accent-dim active:bg-accent"
          />
        )}

        <main className={(showCanvas ? "flex-1" : "hidden") + " min-h-0"}>
          <ExcalidrawCanvas onReady={setExcalidrawApi} onSceneChange={handleSceneChange} />
        </main>
      </div>
    </div>
  );
}
