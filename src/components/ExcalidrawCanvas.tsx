"use client";

import dynamic from "next/dynamic";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false },
);

interface ExcalidrawCanvasProps {
  onReady: (api: ExcalidrawImperativeAPI) => void;
}

export default function ExcalidrawCanvas({ onReady }: ExcalidrawCanvasProps) {
  return (
    <div className="h-full w-full">
      <Excalidraw
        excalidrawAPI={(api) => onReady(api)}
        initialData={{ appState: { viewBackgroundColor: "#fafaf9" } }}
      />
    </div>
  );
}
