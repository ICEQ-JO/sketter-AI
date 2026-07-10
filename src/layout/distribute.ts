import type { Canvas } from '../canvas/types.ts';
import { getElement, setElement } from '../canvas/utils.ts';
import type { DistributeAxis } from './types.ts';

export function distribute(canvas: Canvas, ids: string[], axis: DistributeAxis): Canvas {
  const elements = ids
    .map((id) => getElement(canvas, id))
    .filter(Boolean) as import('../canvas/types.ts').CanvasElement[];

  if (elements.length < 3) return canvas;

  const sorted =
    axis === 'horizontal'
      ? [...elements].sort((a, b) => a.x - b.x)
      : [...elements].sort((a, b) => a.y - b.y);

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const totalSpace =
    axis === 'horizontal'
      ? last.x + last.width - first.x
      : last.y + last.height - first.y;

  const totalSize = sorted.reduce(
    (sum, el) => sum + (axis === 'horizontal' ? el.width : el.height),
    0
  );

  const gap = (totalSpace - totalSize) / (sorted.length - 1);
  let cursor = axis === 'horizontal' ? first.x : first.y;

  sorted.forEach((el) => {
    const size = axis === 'horizontal' ? el.width : el.height;
    if (axis === 'horizontal') {
      canvas = setElement(canvas, { ...el, x: cursor });
    } else {
      canvas = setElement(canvas, { ...el, y: cursor });
    }
    cursor += size + gap;
  });

  return canvas;
}
