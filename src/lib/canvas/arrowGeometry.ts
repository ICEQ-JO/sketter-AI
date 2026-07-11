export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArrowGeometry {
  x: number;
  y: number;
  points: [number, number][];
  width: number;
  height: number;
}

const GAP = 6;

/** Where a ray from `rect`'s center in direction (dx, dy) exits its boundary. */
function rectExitPoint(rect: Rect, dx: number, dy: number): { x: number; y: number } {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const halfW = rect.width / 2 || 1;
  const halfH = rect.height / 2 || 1;
  const scale = Math.min(halfW / Math.abs(dx || 1e-6), halfH / Math.abs(dy || 1e-6));
  return { x: cx + dx * scale, y: cy + dy * scale };
}

/**
 * `convertToExcalidrawElements` sets an arrow's startBinding/endBinding
 * metadata correctly from a skeleton's `start: {id}` / `end: {id}`, but does
 * NOT recompute the arrow's actual points/x/y to match those elements'
 * positions — that recompute normally only happens during interactive
 * dragging in the live app. Since we push scenes programmatically via
 * `updateScene`, we compute the visual line ourselves: from the edge of the
 * start box, through any interior waypoints, to the edge of the end box,
 * with a small gap at each end.
 *
 * `waypoints` (optional) come from dagre's own edge routing — for an edge
 * spanning more than one rank (e.g. skipping over a sibling that sits
 * between its endpoints), dagre routes around whatever occupies the
 * intermediate rank instead of a straight line cutting through it. Without
 * them this always degrades gracefully to the old straight A-to-B line.
 */
export function computeArrowGeometry(
  start: Rect,
  end: Rect,
  waypoints: { x: number; y: number }[] = [],
): ArrowGeometry {
  const centerA = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
  const centerB = { x: end.x + end.width / 2, y: end.y + end.height / 2 };
  const firstTarget = waypoints[0] ?? centerB;
  const lastSource = waypoints[waypoints.length - 1] ?? centerA;

  const outDx = firstTarget.x - centerA.x;
  const outDy = firstTarget.y - centerA.y;
  const outLen = Math.hypot(outDx, outDy) || 1;

  const inDx = lastSource.x - centerB.x;
  const inDy = lastSource.y - centerB.y;
  const inLen = Math.hypot(inDx, inDy) || 1;

  const from = rectExitPoint(start, outDx, outDy);
  const to = rectExitPoint(end, inDx, inDy);

  const startX = from.x + (outDx / outLen) * GAP;
  const startY = from.y + (outDy / outLen) * GAP;
  const endX = to.x + (inDx / inLen) * GAP;
  const endY = to.y + (inDy / inLen) * GAP;

  const points: [number, number][] = [
    [0, 0],
    ...waypoints.map((p): [number, number] => [p.x - startX, p.y - startY]),
    [endX - startX, endY - startY],
  ];
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);

  return {
    x: startX,
    y: startY,
    points,
    width: Math.max(...xs) - Math.min(...xs) || 1,
    height: Math.max(...ys) - Math.min(...ys) || 1,
  };
}
