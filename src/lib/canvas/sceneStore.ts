import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type {
  ExcalidrawElementSkeleton,
} from "@excalidraw/excalidraw/data/transform";
import type {
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { collectForeignElements, findDeadSkeletonIds, syncSkeletonsFromLive } from "./reconcile";

/**
 * Holds the AI-authored elements as skeleton definitions keyed by our own
 * human-readable ids (regenerateIds: false keeps them stable across
 * re-converts, which is what lets `connect` bind arrows by id and later
 * turns reference the same id again). Mermaid-imported elements are stored
 * separately since they arrive already fully formed.
 *
 * Skeletons are a *shadow* of live canvas state for AI-owned elements, not a
 * competing source of truth: every commit reconciles against the live scene
 * first (see reconcile.ts), so manual edits the user makes directly in
 * Excalidraw are never silently discarded, and hand-drawn/imported elements
 * are passed through untouched.
 */
export class SceneStore {
  private skeletons = new Map<string, ExcalidrawElementSkeleton>();
  private mermaidElements: ExcalidrawElement[] = [];
  private groupCounter = 0;

  has(id: string): boolean {
    return this.skeletons.has(id);
  }

  /**
   * Syncs skeleton geometry from live state, prunes ids the user deleted by
   * hand, and returns elements owned by neither the skeleton map nor the
   * mermaid list (hand-drawn/imported content) for pass-through.
   */
  private reconcile(api: ExcalidrawImperativeAPI): ExcalidrawElement[] {
    const live = api.getSceneElements();

    syncSkeletonsFromLive(this.skeletons, live);
    for (const id of findDeadSkeletonIds(this.skeletons, live)) {
      this.skeletons.delete(id);
    }
    const liveIds = new Set(live.filter((el) => !el.isDeleted).map((el) => el.id));
    this.mermaidElements = this.mermaidElements.filter((el) => liveIds.has(el.id));

    return collectForeignElements(
      live,
      new Set(this.skeletons.keys()),
      new Set(this.mermaidElements.map((el) => el.id)),
    );
  }

  private compile(api: ExcalidrawImperativeAPI): ExcalidrawElement[] {
    const foreign = this.reconcile(api);
    const aiElements = convertToExcalidrawElements(
      Array.from(this.skeletons.values()),
      { regenerateIds: false },
    );
    return [...aiElements, ...this.mermaidElements, ...foreign];
  }

  private commit(api: ExcalidrawImperativeAPI) {
    api.updateScene({ elements: this.compile(api) });
  }

  createElement(api: ExcalidrawImperativeAPI, args: Record<string, unknown>) {
    const { id, type, x, y, width, height, text, strokeColor, backgroundColor } = args as {
      id: string;
      type: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      text?: string;
      strokeColor?: string;
      backgroundColor?: string;
    };

    const base: Record<string, unknown> = { id, type, x, y };
    if (width !== undefined) base.width = width;
    if (height !== undefined) base.height = height;
    if (strokeColor) base.strokeColor = strokeColor;
    if (backgroundColor) base.backgroundColor = backgroundColor;
    if (text) {
      if (type === "text") {
        base.text = text;
      } else {
        base.label = { text };
      }
    }

    this.skeletons.set(id, base as ExcalidrawElementSkeleton);
    this.commit(api);
  }

  connect(api: ExcalidrawImperativeAPI, args: Record<string, unknown>) {
    const { from, to, label } = args as { from: string; to: string; label?: string };
    const arrowId = `arrow-${from}-${to}-${Date.now().toString(36)}`;
    const skeleton: Record<string, unknown> = {
      id: arrowId,
      type: "arrow",
      x: 0,
      y: 0,
      start: { id: from },
      end: { id: to },
    };
    if (label) skeleton.label = { text: label };
    this.skeletons.set(arrowId, skeleton as ExcalidrawElementSkeleton);
    this.commit(api);
  }

  updateElement(api: ExcalidrawImperativeAPI, args: Record<string, unknown>) {
    const { id, x, y, text, strokeColor, backgroundColor } = args as {
      id: string;
      x?: number;
      y?: number;
      text?: string;
      strokeColor?: string;
      backgroundColor?: string;
    };
    const existing = this.skeletons.get(id) as Record<string, unknown> | undefined;
    if (!existing) return;
    if (x !== undefined) existing.x = x;
    if (y !== undefined) existing.y = y;
    if (strokeColor) existing.strokeColor = strokeColor;
    if (backgroundColor) existing.backgroundColor = backgroundColor;
    if (text) {
      if (existing.type === "text") {
        existing.text = text;
      } else {
        existing.label = { text };
      }
    }
    this.commit(api);
  }

  /**
   * Resolves an anchor/target id against the reconciled skeleton map first,
   * falling back to a live-scene lookup for anything not AI-owned (mermaid
   * imports, hand-drawn shapes) — so "position relative to X" works against
   * literally anything on the canvas, not just AI-created elements.
   */
  moveRelative(api: ExcalidrawImperativeAPI, args: Record<string, unknown>) {
    const { id, relative_to, position, gap } = args as {
      id: string;
      relative_to: string;
      position: "above" | "below" | "left" | "right";
      gap: number;
    };

    const target = this.skeletons.get(id) as Record<string, unknown> | undefined;
    if (!target) return; // can only move an AI-owned element; SceneStore doesn't mutate foreign geometry.

    const live = api.getSceneElements();
    const liveById = new Map(live.filter((el) => !el.isDeleted).map((el) => [el.id, el]));

    const anchorSkeleton = this.skeletons.get(relative_to) as Record<string, unknown> | undefined;
    const anchorLive = anchorSkeleton ? undefined : liveById.get(relative_to);
    if (!anchorSkeleton && !anchorLive) return;

    const anchorX = Number(anchorSkeleton?.x ?? anchorLive?.x ?? 0);
    const anchorY = Number(anchorSkeleton?.y ?? anchorLive?.y ?? 0);
    const anchorW = Number(anchorSkeleton?.width ?? anchorLive?.width ?? 120);
    const anchorH = Number(anchorSkeleton?.height ?? anchorLive?.height ?? 80);
    const targetW = Number(target.width ?? 120);
    const targetH = Number(target.height ?? 80);

    switch (position) {
      case "above":
        target.x = anchorX;
        target.y = anchorY - targetH - gap;
        break;
      case "below":
        target.x = anchorX;
        target.y = anchorY + anchorH + gap;
        break;
      case "left":
        target.x = anchorX - targetW - gap;
        target.y = anchorY;
        break;
      case "right":
        target.x = anchorX + anchorW + gap;
        target.y = anchorY;
        break;
    }
    this.commit(api);
  }

  deleteElement(api: ExcalidrawImperativeAPI, args: Record<string, unknown>) {
    const { id } = args as { id: string };
    this.skeletons.delete(id);
    for (const [key, el] of this.skeletons) {
      const s = el as unknown as { start?: { id?: string }; end?: { id?: string } };
      if (s.start?.id === id || s.end?.id === id) this.skeletons.delete(key);
    }
    this.commit(api);
  }

  group(api: ExcalidrawImperativeAPI, args: Record<string, unknown>) {
    const { ids } = args as { ids: string[] };
    const groupId = `group-${this.groupCounter++}`;
    for (const id of ids) {
      const el = this.skeletons.get(id) as Record<string, unknown> | undefined;
      if (!el) continue;
      const existingGroups = Array.isArray(el.groupIds) ? (el.groupIds as string[]) : [];
      el.groupIds = [...existingGroups, groupId];
    }
    this.commit(api);
  }

  align(api: ExcalidrawImperativeAPI, args: Record<string, unknown>) {
    const { ids, axis } = args as { ids: string[]; axis: "horizontal" | "vertical" };
    const els = ids
      .map((id) => this.skeletons.get(id) as Record<string, unknown> | undefined)
      .filter((e): e is Record<string, unknown> => !!e);
    if (els.length < 2) return;
    if (axis === "horizontal") {
      const y = Number(els[0].y ?? 0);
      for (const el of els) el.y = y;
    } else {
      const x = Number(els[0].x ?? 0);
      for (const el of els) el.x = x;
    }
    this.commit(api);
  }

  async importMermaid(api: ExcalidrawImperativeAPI, args: Record<string, unknown>) {
    const { definition } = args as { definition: string };
    const { parseMermaidToExcalidraw } = await import("@excalidraw/mermaid-to-excalidraw");
    const { elements } = await parseMermaidToExcalidraw(definition);
    const converted = convertToExcalidrawElements(elements, { regenerateIds: true });
    this.mermaidElements.push(...converted);
    this.commit(api);
  }

  /**
   * Ids currently addressable by the model: AI-created ids, imported mermaid
   * element ids, and anything else currently live on the canvas (hand-drawn
   * shapes) — `relative_to`/`connect` should resolve against anything on
   * screen, not just AI-owned elements.
   */
  validIds(api: ExcalidrawImperativeAPI): Set<string> {
    const ids = new Set(this.skeletons.keys());
    for (const el of this.mermaidElements) ids.add(el.id);
    for (const el of api.getSceneElements()) {
      if (!el.isDeleted) ids.add(el.id);
    }
    return ids;
  }

  reset(api: ExcalidrawImperativeAPI) {
    this.skeletons.clear();
    this.mermaidElements = [];
    api.resetScene();
  }
}
