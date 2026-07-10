import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type {
  ExcalidrawElementSkeleton,
} from "@excalidraw/excalidraw/data/transform";
import type {
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

/**
 * Holds the AI-authored elements as skeleton definitions keyed by our own
 * human-readable ids (regenerateIds: false keeps them stable across
 * re-converts, which is what lets `connect` bind arrows by id and later
 * turns reference the same id again). Mermaid-imported elements are stored
 * separately since they arrive already fully formed.
 */
export class SceneStore {
  private skeletons = new Map<string, ExcalidrawElementSkeleton>();
  private mermaidElements: ExcalidrawElement[] = [];
  private groupCounter = 0;

  has(id: string): boolean {
    return this.skeletons.has(id);
  }

  private compile(): ExcalidrawElement[] {
    const aiElements = convertToExcalidrawElements(
      Array.from(this.skeletons.values()),
      { regenerateIds: false },
    );
    return [...aiElements, ...this.mermaidElements];
  }

  private commit(api: ExcalidrawImperativeAPI) {
    api.updateScene({ elements: this.compile() });
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

  moveRelative(api: ExcalidrawImperativeAPI, args: Record<string, unknown>) {
    const { id, relative_to, position, gap } = args as {
      id: string;
      relative_to: string;
      position: "above" | "below" | "left" | "right";
      gap: number;
    };
    const target = this.skeletons.get(id) as Record<string, unknown> | undefined;
    const anchor = this.skeletons.get(relative_to) as Record<string, unknown> | undefined;
    if (!target || !anchor) return;

    const anchorX = Number(anchor.x ?? 0);
    const anchorY = Number(anchor.y ?? 0);
    const anchorW = Number(anchor.width ?? 120);
    const anchorH = Number(anchor.height ?? 80);
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

  /** ids currently addressable by the model: AI-created ids plus imported mermaid element ids. */
  validIds(): Set<string> {
    const ids = new Set(this.skeletons.keys());
    for (const el of this.mermaidElements) ids.add(el.id);
    return ids;
  }

  reset(api: ExcalidrawImperativeAPI) {
    this.skeletons.clear();
    this.mermaidElements = [];
    api.resetScene();
  }
}
