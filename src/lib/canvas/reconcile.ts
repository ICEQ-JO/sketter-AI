import type {
  ExcalidrawElementSkeleton,
} from "@excalidraw/excalidraw/data/transform";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

/**
 * Copies live geometry/content back into AI-owned skeletons before they're
 * recompiled, so a shape the user dragged/resized/edited by hand doesn't get
 * silently reverted the next time the AI touches the canvas. Skeletons are
 * the shadow of live state for AI-owned elements, not a competing source of
 * truth.
 */
export function syncSkeletonsFromLive(
  skeletons: Map<string, ExcalidrawElementSkeleton>,
  live: readonly ExcalidrawElement[],
): void {
  const liveById = new Map(live.filter((el) => !el.isDeleted).map((el) => [el.id, el]));

  for (const [id, skeleton] of skeletons) {
    const liveEl = liveById.get(id);
    if (!liveEl) continue;
    const s = skeleton as unknown as Record<string, unknown>;

    s.x = liveEl.x;
    s.y = liveEl.y;
    if ("width" in liveEl) s.width = liveEl.width;
    if ("height" in liveEl) s.height = liveEl.height;
    if (liveEl.strokeColor) s.strokeColor = liveEl.strokeColor;
    if (liveEl.backgroundColor) s.backgroundColor = liveEl.backgroundColor;

    if (liveEl.type === "text" && "text" in liveEl) {
      s.text = liveEl.text;
    } else {
      const boundText = live.find(
        (t) => t.type === "text" && !t.isDeleted && "containerId" in t && t.containerId === id,
      );
      if (boundText && "text" in boundText) {
        s.label = { text: boundText.text };
      }
    }
  }
}

/**
 * Live, non-deleted elements owned by neither the AI's skeleton map nor the
 * mermaid-imported list — hand-drawn shapes, or anything from a loaded
 * .excalidraw file. Passed through compile() untouched.
 */
export function collectForeignElements(
  live: readonly ExcalidrawElement[],
  skeletonIds: Set<string>,
  mermaidIds: Set<string>,
): ExcalidrawElement[] {
  return live.filter(
    (el) => !el.isDeleted && !skeletonIds.has(el.id) && !mermaidIds.has(el.id),
  );
}

/**
 * Ids present in `skeletons` that no longer exist live — the user deleted
 * them by hand. Callers should prune these before recompiling so the AI's
 * internal model (and `validIds()`) stays accurate.
 */
export function findDeadSkeletonIds(
  skeletons: Map<string, ExcalidrawElementSkeleton>,
  live: readonly ExcalidrawElement[],
): string[] {
  const liveIds = new Set(live.filter((el) => !el.isDeleted).map((el) => el.id));
  return Array.from(skeletons.keys()).filter((id) => !liveIds.has(id));
}
