import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

export interface CanvasSummaryElement {
  id: string;
  type: string;
  text?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface CanvasSummaryConnection {
  from: string;
  to: string;
  label?: string;
}

export interface CanvasSummary {
  elements: CanvasSummaryElement[];
  connections: CanvasSummaryConnection[];
}

/**
 * Compact scene summary sent to the model each turn instead of raw
 * Excalidraw JSON — strips stroke widths, roughness seeds, version numbers,
 * and binding internals the model doesn't need to reason about. This is the
 * single biggest lever for keeping small/cheap models reliable.
 */
export function buildCanvasSummary(elements: readonly ExcalidrawElement[]): CanvasSummary {
  const live = elements.filter((el) => !el.isDeleted);
  const summaryElements: CanvasSummaryElement[] = [];
  const connections: CanvasSummaryConnection[] = [];

  for (const el of live) {
    if (el.type === "arrow") {
      const start = el.startBinding?.elementId;
      const end = el.endBinding?.elementId;
      if (start && end) {
        const boundText = live.find(
          (t) => t.type === "text" && "containerId" in t && t.containerId === el.id,
        );
        connections.push({
          from: start,
          to: end,
          ...(boundText && "text" in boundText ? { label: boundText.text as string } : {}),
        });
        continue;
      }
    }
    if (el.type === "text" && "containerId" in el && el.containerId) {
      // bound label text, already represented via the container/connection
      continue;
    }

    const text =
      "text" in el
        ? (el.text as string)
        : (() => {
            const bound = live.find(
              (t) => t.type === "text" && "containerId" in t && t.containerId === el.id,
            );
            return bound && "text" in bound ? (bound.text as string) : undefined;
          })();

    summaryElements.push({
      id: el.id,
      type: el.type,
      x: Math.round(el.x),
      y: Math.round(el.y),
      ...(el.width ? { width: Math.round(el.width) } : {}),
      ...(el.height ? { height: Math.round(el.height) } : {}),
      ...(text ? { text } : {}),
    });
  }

  return { elements: summaryElements, connections };
}
