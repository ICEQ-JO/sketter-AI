import type { Canvas } from '../canvas/types.ts';
import { getElement, setElement } from '../canvas/utils.ts';
import type { Direction } from './types.ts';

const DEFAULT_GAP = 40;

export function placeRelative(
  canvas: Canvas,
  movingId: string,
  referenceId: string,
  direction: Direction,
  gap: number = DEFAULT_GAP
): Canvas {
  const moving = getElement(canvas, movingId);
  const reference = getElement(canvas, referenceId);
  if (!moving || !reference) return canvas;

  let x = moving.x;
  let y = moving.y;

  switch (direction) {
    case 'right':
      x = reference.x + reference.width + gap;
      y = reference.y + reference.height / 2 - moving.height / 2;
      break;
    case 'left':
      x = reference.x - moving.width - gap;
      y = reference.y + reference.height / 2 - moving.height / 2;
      break;
    case 'below':
      x = reference.x + reference.width / 2 - moving.width / 2;
      y = reference.y + reference.height + gap;
      break;
    case 'above':
      x = reference.x + reference.width / 2 - moving.width / 2;
      y = reference.y - moving.height - gap;
      break;
  }

  return setElement(canvas, { ...moving, x, y });
}

export function placeAt(canvas: Canvas, id: string, x: number, y: number): Canvas {
  const el = getElement(canvas, id);
  if (!el) return canvas;
  return setElement(canvas, { ...el, x, y });
}

export function centerInCanvas(canvas: Canvas, id: string, canvasWidth: number, canvasHeight: number): Canvas {
  const el = getElement(canvas, id);
  if (!el) return canvas;
  return setElement(canvas, {
    ...el,
    x: canvasWidth / 2 - el.width / 2,
    y: canvasHeight / 2 - el.height / 2,
  });
}
