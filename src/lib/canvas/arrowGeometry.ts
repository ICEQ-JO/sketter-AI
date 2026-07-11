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
 * start box (along the line to the end box's center) to the edge of the end
 * box, with a small gap on each side.
 */
export function computeArrowGeometry(start: Rect, end: Rect): ArrowGeometry {
  const centerA = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
  const centerB = { x: end.x + end.width / 2, y: end.y + end.height / 2 };
  const dx = centerB.x - centerA.x;
  const dy = centerB.y - centerA.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  const from = rectExitPoint(start, dx, dy);
  const to = rectExitPoint(end, -dx, -dy);

  const startX = from.x + ux * GAP;
  const startY = from.y + uy * GAP;
  const endX = to.x - ux * GAP;
  const endY = to.y - uy * GAP;

  return {
    x: startX,
    y: startY,
    points: [
      [0, 0],
      [endX - startX, endY - startY],
    ],
    width: Math.abs(endX - startX) || 1,
    height: Math.abs(endY - startY) || 1,
  };
}
