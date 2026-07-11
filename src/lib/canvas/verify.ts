import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { SceneStore } from "./sceneStore";

export type GeometryIssueKind =
  | "overlap"
  | "dangling_arrow"
  | "out_of_bounds"
  | "arrow_crosses_element";

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
const ARROW_CROSS_MARGIN = 6;
const ARROW_DETOUR_MARGIN = 24;

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };

function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const cross = (a: Point, b: Point, c: Point) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

/** Whether the segment p1-p2 passes through `rect` (inflated by `margin`) —
 *  used to catch an arrow's straight run cutting through an unrelated box. */
function segmentIntersectsRect(p1: Point, p2: Point, rect: Rect, margin: number): boolean {
  const rx0 = rect.x - margin;
  const ry0 = rect.y - margin;
  const rx1 = rect.x + rect.width + margin;
  const ry1 = rect.y + rect.height + margin;
  const inside = (p: Point) => p.x >= rx0 && p.x <= rx1 && p.y >= ry0 && p.y <= ry1;
  if (inside(p1) || inside(p2)) return true;

  const corners: Point[] = [
    { x: rx0, y: ry0 },
    { x: rx1, y: ry0 },
    { x: rx1, y: ry1 },
    { x: rx0, y: ry1 },
  ];
  for (let i = 0; i < 4; i++) {
    if (segmentsIntersect(p1, p2, corners[i], corners[(i + 1) % 4])) return true;
  }
  return false;
}

/**
 * A two-point "step" detour that routes a line from `start` to `end` around
 * `box` instead of through it — over/under the box if the line runs mostly
 * horizontally, or left/right of it if the line runs mostly vertically,
 * whichever side needs the smaller nudge off the original line.
 */
function computeDetourWaypoints(start: Point, end: Point, box: Rect, margin: number): Point[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    const t = dx === 0 ? 0.5 : (box.x + box.width / 2 - start.x) / dx;
    const lineYAtBox = start.y + dy * t;
    const above = box.y - margin;
    const below = box.y + box.height + margin;
    const detourY = Math.abs(lineYAtBox - above) <= Math.abs(lineYAtBox - below) ? above : below;
    const leftX = box.x - margin;
    const rightX = box.x + box.width + margin;
    return dx >= 0
      ? [{ x: leftX, y: detourY }, { x: rightX, y: detourY }]
      : [{ x: rightX, y: detourY }, { x: leftX, y: detourY }];
  }

  const t = dy === 0 ? 0.5 : (box.y + box.height / 2 - start.y) / dy;
  const lineXAtBox = start.x + dx * t;
  const left = box.x - margin;
  const right = box.x + box.width + margin;
  const detourX = Math.abs(lineXAtBox - left) <= Math.abs(lineXAtBox - right) ? left : right;
  const topY = box.y - margin;
  const bottomY = box.y + box.height + margin;
  return dy >= 0
    ? [{ x: detourX, y: topY }, { x: detourX, y: bottomY }]
    : [{ x: detourX, y: bottomY }, { x: detourX, y: topY }];
}

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

  // 4. Arrows whose straight-line run cuts through an unrelated box — this is
  // dagre's blind spot: incremental layout only knows about nodes added in
  // the same pass, so an arrow connecting into an existing subgraph can end
  // up drawn straight through a box that was placed in an earlier turn.
  // AI-owned arrows get a two-point detour around the obstruction; anything
  // else is reported unresolved since we can't reroute a foreign arrow.
  live = api.getSceneElements().filter((el) => !el.isDeleted);
  const crossBoxes = live.filter(
    (el) =>
      el.type !== "arrow" &&
      !("containerId" in el && el.containerId) &&
      el.width > 0 &&
      el.height > 0,
  );
  for (const arrow of live) {
    if (arrow.type !== "arrow") continue;
    const points = (arrow as unknown as { points: readonly (readonly [number, number])[] }).points;
    if (!points || points.length < 2) continue;
    const abs: Point[] = points.map(([px, py]) => ({ x: arrow.x + px, y: arrow.y + py }));
    const startId = arrow.startBinding?.elementId;
    const endId = arrow.endBinding?.elementId;

    let obstruction: ExcalidrawElement | null = null;
    outer: for (let i = 0; i < abs.length - 1; i++) {
      for (const box of crossBoxes) {
        if (box.id === startId || box.id === endId) continue;
        if (segmentIntersectsRect(abs[i], abs[i + 1], box, ARROW_CROSS_MARGIN)) {
          obstruction = box;
          break outer;
        }
      }
    }
    if (!obstruction) continue;

    if (!store.has(arrow.id)) {
      issues.push({
        kind: "arrow_crosses_element",
        detail: `arrow ${arrow.id} passes through ${obstruction.id} and isn't AI-owned, couldn't auto-fix`,
        elementIds: [arrow.id, obstruction.id],
        autoFixed: false,
      });
      continue;
    }

    const waypoints = computeDetourWaypoints(
      abs[0],
      abs[abs.length - 1],
      obstruction,
      ARROW_DETOUR_MARGIN,
    );
    store.setArrowRoute(api, arrow.id, waypoints);
    issues.push({
      kind: "arrow_crosses_element",
      detail: `arrow ${arrow.id} was cutting through ${obstruction.id}, routed it around instead`,
      elementIds: [arrow.id, obstruction.id],
      autoFixed: true,
    });
  }

  const fixedCount = issues.filter((i) => i.autoFixed).length;
  return { issues, fixedCount, unresolvedCount: issues.length - fixedCount };
}
