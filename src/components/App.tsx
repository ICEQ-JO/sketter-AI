"use client";

import { useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import ExcalidrawCanvas from "@/components/ExcalidrawCanvas";
import ChatPanel from "@/components/ChatPanel";
import { SceneStore } from "@/lib/canvas/sceneStore";

export default function App() {
  const [excalidrawApi, setExcalidrawApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [sceneStore] = useState(() => new SceneStore());

  return (
    <div className="flex h-screen w-screen flex-1 overflow-hidden">
      <aside className="flex w-[360px] shrink-0 flex-col border-r border-black/10 dark:border-white/10">
        <div className="border-b border-black/10 px-3 py-2 dark:border-white/10">
          <h1 className="text-sm font-semibold text-black dark:text-white">ExcaliChat</h1>
          <p className="text-xs text-black/50 dark:text-white/50">
            Chat with any AI model to draw on the canvas.
          </p>
        </div>
        <ChatPanel excalidrawApi={excalidrawApi} sceneStore={sceneStore} />
      </aside>
      <main className="flex-1">
        <ExcalidrawCanvas onReady={setExcalidrawApi} />
      </main>
    </div>
  );
}
