"use client";

import dynamic from "next/dynamic";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useTheme } from "@/lib/theme/useTheme";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false },
);

interface ExcalidrawCanvasProps {
  onReady: (api: ExcalidrawImperativeAPI) => void;
  onSceneChange?: () => void;
}

export default function ExcalidrawCanvas({ onReady, onSceneChange }: ExcalidrawCanvasProps) {
  const [theme] = useTheme();

  return (
    <div className="h-full w-full">
      {/*
        Excalidraw's dark theme is a CSS `filter: invert()` over the canvas,
        not literal dark pixels — leave viewBackgroundColor at its default
        (white) so the built-in filter inverts it to a proper dark paper,
        same as excalidraw.com's own dark mode. In light mode no inversion
        happens, so the canvas stays its natural white/paper look.
      */}
      <Excalidraw
        excalidrawAPI={(api) => onReady(api)}
        theme={theme}
        onChange={onSceneChange}
      />
    </div>
  );
}
