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
    <div className="relative flex h-screen w-screen flex-1 overflow-hidden bg-background">
      <aside className="flex w-[360px] shrink-0 flex-col border-r border-border">
        <ChatPanel excalidrawApi={excalidrawApi} sceneStore={sceneStore} />
      </aside>
      <main className="flex-1">
        <ExcalidrawCanvas onReady={setExcalidrawApi} />
      </main>
    </div>
  );
}
