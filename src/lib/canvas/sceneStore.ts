import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type {
  ExcalidrawElementSkeleton,
} from "@excalidraw/excalidraw/data/transform";
import type {
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { collectForeignElements, findDeadSkeletonIds, syncSkeletonsFromLive } from "./reconcile";
import { layoutGraph, type GraphLayoutEdge, type GraphLayoutNode } from "../layout/dagreLayout";
import { computeArrowGeometry } from "./arrowGeometry";
import type { CanvasSummary } from "./summary";

/**
 * Holds the AI-authored elements as skeleton definitions keyed by our own
 * human-readable ids (regenerateIds: false keeps them stable across
 * re-converts, which is what lets `connect` bind arrows by id and later
 * turns reference the same id again). Mermaid-imported elements are stored
 * separately since they arrive already fully formed.
 *
 * Skeletons are a *shadow* of live canvas state for AI-owned elements, not a
 * competing source of truth: `beginTurn()` reconciles against the live scene
 * once at the start of each user turn (see reconcile.ts), so manual edits
 * the user makes directly in Excalidraw between turns are never silently
 * discarded, and hand-drawn/imported elements are passed through untouched.
 *
 * Reconciliation deliberately does NOT run on every commit — only once per
 * turn. If it ran on every commit, it would read the live scene from
 * *before* that commit's own push and copy those stale values straight back
 * over whatever this same call just computed (e.g. a freshly laid-out
 * position), undoing every mutation before it ever reached the canvas.
 */
export class SceneStore {
  private skeletons = new Map<string, ExcalidrawElementSkeleton>();
  private mermaidElements: ExcalidrawElement[] = [];
  private groupCounter = 0;
  /** Ids added via `addNode` that don't have a real position yet — cleared once `runAutoLayout` places them. */
  private pendingLayoutIds = new Set<string>();
  /** Group hint per node id, used by `runAutoLayout`; kept out of the skeleton itself so it never leaks into the compiled Excalidraw element. */
  private nodeGroups = new Map<string, string>();
  /** Hand-drawn/imported elements owned by neither map, captured at the last `beginTurn()`; passed through `compile()` untouched. */
  private foreignElements: ExcalidrawElement[] = [];
  /**
   * Ids (skeleton + mermaid) that have been successfully pushed to the live
   * scene at least once. "Dead" pruning in `beginTurn()` only applies to ids
   * in this set — otherwise a node added but not yet pushed would be
   * indistinguishable from one the user just deleted by hand.
   */
  private confirmedLiveIds = new Set<string>();

  has(id: string): boolean {
    return this.skeletons.has(id);
  }

  /**
   * Call once at the start of processing a user turn, before any tool calls
   * execute — pulls in live drift (manual edits made since the last turn)
   * and prunes ids the user deleted by hand. Deliberately not called again
   * mid-turn; see the class doc comment for why.
   */
  beginTurn(api: ExcalidrawImperativeAPI): void {
    const live = api.getSceneElements();
    const liveIds = new Set(live.filter((el) => !el.isDeleted).map((el) => el.id));

    syncSkeletonsFromLive(this.skeletons, live);
    const deadIds = findDeadSkeletonIds(this.skeletons, live).filter((id) =>
      this.confirmedLiveIds.has(id),
    );
    for (const id of deadIds) {
      this.skeletons.delete(id);
      this.pendingLayoutIds.delete(id);
      this.nodeGroups.delete(id);
    }
    this.mermaidElements = this.mermaidElements.filter(
      (el) => !this.confirmedLiveIds.has(el.id) || liveIds.has(el.id),
    );

    this.foreignElements = collectForeignElements(
      live,
      new Set(this.skeletons.keys()),
      new Set(this.mermaidElements.map((el) => el.id)),
    );
  }

  private compile(): ExcalidrawElement[] {
    const aiElements = convertToExcalidrawElements(
      Array.from(this.skeletons.values()),
      { regenerateIds: false },
    );
    const all = [...aiElements, ...this.mermaidElements, ...this.foreignElements];
    const byId = new Map(all.map((el) => [el.id, el]));

    // convertToExcalidrawElements sets startBinding/endBinding correctly but
    // doesn't recompute an arrow's actual points/x/y to match those elements'
    // current positions — that only happens during interactive dragging in
    // the live app. Since we push scenes programmatically, compute the
    // visual line ourselves from the bound elements' real geometry.
    for (const el of aiElements) {
      if (el.type !== "arrow") continue;
      const startId = el.startBinding?.elementId;
      const endId = el.endBinding?.elementId;
      if (!startId || !endId) continue;
      const start = byId.get(startId);
      const end = byId.get(endId);
      if (!start || !end || !("width" in start) || !("width" in end)) continue;

      const geometry = computeArrowGeometry(
        { x: start.x, y: start.y, width: start.width, height: start.height },
        { x: end.x, y: end.y, width: end.width, height: end.height },
      );
      Object.assign(el as unknown as Record<string, unknown>, geometry);
    }

    return all;
  }

  private commit(api: ExcalidrawImperativeAPI) {
    api.updateScene({ elements: this.compile() });
    this.confirmedLiveIds = new Set([
      ...this.skeletons.keys(),
      ...this.mermaidElements.map((el) => el.id),
    ]);
  }

  /**
   * Adds a node that participates in the connected graph — no position is
   * assigned here; it's tracked in `pendingLayoutIds` until `runAutoLayout`
   * computes real geometry deterministically via dagre.
   */
  addNode(api: ExcalidrawImperativeAPI, args: Record<string, unknown>) {
    const { id, type, text, group, width, height, strokeColor, backgroundColor } = args as {
      id: string;
      type: string;
      text?: string;
      group?: string;
      width?: number;
      height?: number;
      strokeColor?: string;
      backgroundColor?: string;
    };

    const base: Record<string, unknown> = { id, type, x: 0, y: 0 };
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
    this.pendingLayoutIds.add(id);
    if (group) this.nodeGroups.set(id, group);
    this.commit(api);
  }

  /** Explicit escape hatch for standalone content (annotations, notes) not part of the connected graph — keeps an explicit position, never auto-laid-out. */
  addFreeform(api: ExcalidrawImperativeAPI, args: Record<string, unknown>) {
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

  /**
   * Computes real, non-overlapping positions for every node added via
   * `addNode` since the last layout pass, using dagre. New subgraphs are
   * anchored near a connected already-positioned neighbor (if `connect`
   * linked one in) or `canvasSummary.suggestedFreeRegion` otherwise —
   * already-positioned nodes are never moved by this pass.
   */
  runAutoLayout(api: ExcalidrawImperativeAPI, canvasSummary: CanvasSummary) {
    if (this.pendingLayoutIds.size === 0) return;
    const pending = this.pendingLayoutIds;

    const nodes: GraphLayoutNode[] = [];
    for (const id of pending) {
      const skeleton = this.skeletons.get(id) as Record<string, unknown> | undefined;
      if (!skeleton) continue;
      nodes.push({
        id,
        label: typeof skeleton.text === "string" ? skeleton.text : undefined,
        width: Number(skeleton.width ?? 120),
        height: Number(skeleton.height ?? 80),
        group: this.nodeGroups.get(id),
      });
    }

    const live = api.getSceneElements().filter((el) => !el.isDeleted);
    const liveById = new Map(live.map((el) => [el.id, el]));

    const internalEdges: GraphLayoutEdge[] = [];
    let neighborAnchor: { x: number; y: number } | null = null;

    for (const skeleton of this.skeletons.values()) {
      const s = skeleton as unknown as { type?: string; start?: { id?: string }; end?: { id?: string } };
      if (s.type !== "arrow") continue;
      const from = s.start?.id;
      const to = s.end?.id;
      if (!from || !to) continue;
      const fromPending = pending.has(from);
      const toPending = pending.has(to);
      if (fromPending && toPending) {
        internalEdges.push({ from, to });
      } else if ((fromPending || toPending) && !neighborAnchor) {
        const externalId = fromPending ? to : from;
        const externalEl = liveById.get(externalId);
        if (externalEl) {
          neighborAnchor = { x: externalEl.x, y: externalEl.y + (externalEl.height ?? 0) + 120 };
        }
      }
    }

    const anchor =
      neighborAnchor ?? {
        x: canvasSummary.suggestedFreeRegion.x,
        y: canvasSummary.suggestedFreeRegion.y,
      };

    const { positions } = layoutGraph(nodes, internalEdges, {
      anchorX: anchor.x,
      anchorY: anchor.y,
    });

    for (const [id, rect] of positions) {
      const skeleton = this.skeletons.get(id) as Record<string, unknown> | undefined;
      if (!skeleton) continue;
      skeleton.x = rect.x;
      skeleton.y = rect.y;
      skeleton.width = rect.width;
      skeleton.height = rect.height;
    }

    this.pendingLayoutIds.clear();
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
    const { id, x, y, type, text, strokeColor, backgroundColor } = args as {
      id: string;
      x?: number;
      y?: number;
      type?: string;
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

    if (type && type !== existing.type) {
      const wasText = existing.type === "text";
      const willBeText = type === "text";
      if (willBeText && !wasText) {
        // Shape -> text: fold the bound label (if any) into a top-level text field.
        const label = existing.label as { text?: string } | undefined;
        existing.text = label?.text ?? "";
        delete existing.label;
        delete existing.width;
        delete existing.height;
      } else if (!willBeText && wasText) {
        // Text -> shape: the other direction — move top-level text into a bound label.
        const existingText = typeof existing.text === "string" ? existing.text : "";
        if (existingText) existing.label = { text: existingText };
        delete existing.text;
        if (existing.width === undefined) existing.width = 120;
        if (existing.height === undefined) existing.height = 80;
      }
      existing.type = type;
    }

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
    this.pendingLayoutIds.delete(id);
    this.nodeGroups.delete(id);
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
    this.pendingLayoutIds.clear();
    this.nodeGroups.clear();
    this.confirmedLiveIds.clear();
    this.foreignElements = [];
    api.resetScene();
  }
}
