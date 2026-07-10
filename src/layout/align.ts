import type { Canvas } from '../canvas/types.ts';
import { getElement, setElement } from '../canvas/utils.ts';
import type { AlignAxis } from './types.ts';

export function align(canvas: Canvas, ids: string[], axis: AlignAxis): Canvas {
  const elements = ids.map((id) => getElement(canvas, id)).filter(Boolean) as import('../canvas/types.ts').CanvasElement[];
  if (elements.length < 2) return canvas;

  let value = 0;

  switch (axis) {
    case 'left':
      value = Math.min(...elements.map((el) => el.x));
      elements.forEach((el) => (canvas = setElement(canvas, { ...el, x: value })));
      break;
    case 'center':
      value = elements.reduce((sum, el) => sum + el.x + el.width / 2, 0) / elements.length;
      elements.forEach((el) => (canvas = setElement(canvas, { ...el, x: value - el.width / 2 })));
      break;
    case 'right':
      value = Math.max(...elements.map((el) => el.x + el.width));
      elements.forEach((el) => (canvas = setElement(canvas, { ...el, x: value - el.width })));
      break;
    case 'top':
      value = Math.min(...elements.map((el) => el.y));
      elements.forEach((el) => (canvas = setElement(canvas, { ...el, y: value })));
      break;
    case 'middle':
      value = elements.reduce((sum, el) => sum + el.y + el.height / 2, 0) / elements.length;
      elements.forEach((el) => (canvas = setElement(canvas, { ...el, y: value - el.height / 2 })));
      break;
    case 'bottom':
      value = Math.max(...elements.map((el) => el.y + el.height));
      elements.forEach((el) => (canvas = setElement(canvas, { ...el, y: value - el.height })));
      break;
  }

  return canvas;
}
