import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { SceneStore } from "./sceneStore";

export type GeometryIssueKind = "overlap" | "dangling_arrow" | "out_of_bounds";

export interface GeometryIssue {
  kind: GeometryIssueKind;
  detail: string;
  elementIds: string[];
  autoFixed: boolean;
}

export interface VerifyResult {
  issues: GeometryIssue[];
  fixedCount: number;
  unresolvedCount: number;
}

const OVERLAP_TOLERANCE = 4;
const OVERLAP_PADDING = 24;
const OUT_OF_BOUNDS_THRESHOLD = 8000;

/** Whether `outer` fully encloses `inner` (with a little slack) — a deliberate
 *  container/frame around content, not accidental stacking that needs fixing. */
function contains(outer: ExcalidrawElement, inner: ExcalidrawElement): boolean {
  const slack = 2;
  return (
    outer.x - slack <= inner.x &&
    outer.y - slack <= inner.y &&
    outer.x + outer.width + slack >= inner.x + inner.width &&
    outer.y + outer.height + slack >= inner.y + inner.height
  );
}

function groupByTurn(
  elements: ExcalidrawElement[],
  createdThisTurn?: Set<string>,
): ExcalidrawElement[][] {
  if (!createdThisTurn) return elements.map((el) => [el]);
  const inTurn = elements.filter((el) => createdThisTurn.has(el.id));
  const outTurn = elements.filter((el) => !createdThisTurn.has(el.id));
  const groups: ExcalidrawElement[][] = outTurn.map((el) => [el]);
  if (inTurn.length > 0) groups.push(inTurn);
  return groups;
}

/**
 * Deterministic geometry check run after a build turn's tool calls (and
 * auto-layout) finish. Overlaps and off-canvas AI-owned elements are
 * auto-fixed by nudging/translating; dangling arrows and overlaps involving
 * a foreign (hand-drawn) element are reported as unresolved so the caller
 * can hand them back to the model as a corrective follow-up.
 */
export function verifyAndFix(
  api: ExcalidrawImperativeAPI,
  store: SceneStore,
  createdThisTurn?: Set<string>,
): VerifyResult {
  const issues: GeometryIssue[] = [];
  let live = api.getSceneElements().filter((el) => !el.isDeleted);

  // 1. Overlapping bounding boxes.
  const boxed = live.filter(
    (el) =>
      el.type !== "arrow" &&
      !("containerId" in el && el.containerId) &&
      el.width > 0 &&
      el.height > 0,
  );
  for (let i = 0; i < boxed.length; i++) {
    for (let j = i + 1; j < boxed.length; j++) {
      const a = boxed[i];
      const b = boxed[j];
      const ix = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const iy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (ix <= OVERLAP_TOLERANCE || iy <= OVERLAP_TOLERANCE) continue;
      if (contains(a, b) || contains(b, a)) continue; // deliberate container/frame, not accidental stacking

      const target = store.has(b.id) ? b : store.has(a.id) ? a : null;
      if (!target) {
        issues.push({
          kind: "overlap",
          detail: `${a.id} and ${b.id} overlap and neither is AI-owned, couldn't auto-fix`,
          elementIds: [a.id, b.id],
          autoFixed: false,
        });
        continue;
      }
      const anchor = target === b ? a : b;

      let newX = target.x;
      let newY = target.y;
      if (ix < iy) {
        const dir = target.x + target.width / 2 >= anchor.x + anchor.width / 2 ? 1 : -1;
        newX = target.x + dir * (ix + OVERLAP_PADDING);
      } else {
        const dir = target.y + target.height / 2 >= anchor.y + anchor.height / 2 ? 1 : -1;
        newY = target.y + dir * (iy + OVERLAP_PADDING);
      }
      store.updateElement(api, { id: target.id, x: newX, y: newY });
      issues.push({
        kind: "overlap",
        detail: `${a.id} and ${b.id} overlapped, moved ${target.id} apart`,
        elementIds: [a.id, b.id],
        autoFixed: true,
      });
    }
  }

  live = api.getSceneElements().filter((el) => !el.isDeleted);
  const liveIds = new Set(live.map((el) => el.id));

  // 2. Dangling arrows — bound to an element id that no longer exists live.
  for (const el of live) {
    if (el.type !== "arrow") continue;
    const start = el.startBinding?.elementId;
    const end = el.endBinding?.elementId;
    const missing = [start, end].filter((id): id is string => !!id && !liveIds.has(id));
    if (missing.length > 0) {
      issues.push({
        kind: "dangling_arrow",
        detail: `arrow ${el.id} references missing element(s): ${missing.join(", ")}`,
        elementIds: [el.id, ...missing],
        autoFixed: false,
      });
    }
  }

  // 3. Elements far outside a reasonable working area (evidence of a bad
  // computed position) — translate back near existing content, preserving
  // relative offsets for anything created together this turn.
  const inBounds = live.filter(
    (el) => Math.abs(el.x) <= OUT_OF_BOUNDS_THRESHOLD && Math.abs(el.y) <= OUT_OF_BOUNDS_THRESHOLD,
  );
  const outOfBounds = live.filter(
    (el) =>
      store.has(el.id) &&
      el.type !== "arrow" &&
      (Math.abs(el.x) > OUT_OF_BOUNDS_THRESHOLD || Math.abs(el.y) > OUT_OF_BOUNDS_THRESHOLD),
  );

  if (outOfBounds.length > 0) {
    const targetX = inBounds.length > 0 ? Math.min(...inBounds.map((el) => el.x)) : 0;
    const targetY = inBounds.length > 0 ? Math.min(...inBounds.map((el) => el.y)) : 0;

    for (const group of groupByTurn(outOfBounds, createdThisTurn)) {
      const minX = Math.min(...group.map((el) => el.x));
      const minY = Math.min(...group.map((el) => el.y));
      const dx = targetX + 400 - minX;
      const dy = targetY - minY;
      for (const el of group) {
        store.updateElement(api, { id: el.id, x: el.x + dx, y: el.y + dy });
      }
      issues.push({
        kind: "out_of_bounds",
        detail: `${group.map((el) => el.id).join(", ")} were far off-canvas, moved back near existing content`,
        elementIds: group.map((el) => el.id),
        autoFixed: true,
      });
    }
  }

  const fixedCount = issues.filter((i) => i.autoFixed).length;
  return { issues, fixedCount, unresolvedCount: issues.length - fixedCount };
}
