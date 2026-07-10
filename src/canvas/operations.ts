import {
  createArrow,
  createDiamond as makeDiamond,
  createEllipse as makeEllipse,
  createImage as makeImage,
  createLine as makeLine,
  createRectangle as makeRectangle,
  createText as makeText,
  duplicateElement,
  type CreateShapeOptions,
  type CreateTextOptions,
} from './element.ts';
import {
  addConnection,
  addGroup,
  createCanvas,
  generateId,
  getElement,
  removeElement,
  removeGroup,
  setElement,
  updateMetadata,
  updateStyle,
} from './utils.ts';
import type {
  Canvas,
  CanvasElement,
  Connection,
  Group,
  Point,
  Style,
} from './types.ts';

export { createCanvas };

export function createRectangle(canvas: Canvas, options: CreateShapeOptions = {}): [Canvas, string] {
  const el = makeRectangle(options);
  return [setElement(canvas, el), el.id];
}

export function createEllipse(canvas: Canvas, options: CreateShapeOptions = {}): [Canvas, string] {
  const el = makeEllipse(options);
  return [setElement(canvas, el), el.id];
}

export function createDiamond(canvas: Canvas, options: CreateShapeOptions = {}): [Canvas, string] {
  const el = makeDiamond(options);
  return [setElement(canvas, el), el.id];
}

export function createText(canvas: Canvas, options: CreateTextOptions = {}): [Canvas, string] {
  const el = makeText(options);
  return [setElement(canvas, el), el.id];
}

export function createLine(canvas: Canvas, points: Point[]): [Canvas, string] {
  const el = makeLine({ points });
  return [setElement(canvas, el), el.id];
}

export function createImage(canvas: Canvas, options: Omit<Parameters<typeof makeImage>[0], 'id'>): [Canvas, string] {
  const el = makeImage(options);
  return [setElement(canvas, el), el.id];
}

export function connect(
  canvas: Canvas,
  fromId: string,
  toId: string,
  label?: string,
  style?: Style
): [Canvas, string] {
  const from = getElement(canvas, fromId);
  const to = getElement(canvas, toId);
  if (!from || !to) return [canvas, ''];

  const startPoint: Point = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const endPoint: Point = { x: to.x + to.width / 2, y: to.y + to.height / 2 };

  const arrow = createArrow({
    startPoint,
    endPoint,
    startElementId: fromId,
    endElementId: toId,
    label,
    style,
  });

  const connection: Connection = {
    id: generateId(),
    fromElementId: fromId,
    toElementId: toId,
    label,
    style,
  };

  let next = setElement(canvas, arrow);
  next = addConnection(next, connection);
  return [next, connection.id];
}

export function deleteElement(canvas: Canvas, id: string): Canvas {
  return removeElement(canvas, id);
}

export function duplicate(canvas: Canvas, id: string): [Canvas, string] {
  const el = getElement(canvas, id);
  if (!el) return [canvas, ''];
  const copy = duplicateElement(el);
  return [setElement(canvas, copy as CanvasElement), copy.id];
}

export function group(canvas: Canvas, elementIds: string[], label?: string): [Canvas, string] {
  const existing = elementIds.filter((id) => canvas.elements[id]);
  if (existing.length === 0) return [canvas, ''];

  const group: Group = {
    id: generateId(),
    elementIds: existing,
    label,
  };

  let next = canvas;
  existing.forEach((id) => {
    const el = getElement(next, id);
    if (el) {
      const groupIds = new Set(el.groupIds ?? []);
      groupIds.add(group.id);
      next = setElement(next, { ...el, groupIds: Array.from(groupIds) });
    }
  });

  return [addGroup(next, group), group.id];
}

export function ungroup(canvas: Canvas, groupId: string): Canvas {
  const group = canvas.groups[groupId];
  if (!group) return canvas;

  let next = canvas;
  group.elementIds.forEach((id) => {
    const el = getElement(next, id);
    if (el) {
      next = setElement(next, {
        ...el,
        groupIds: (el.groupIds ?? []).filter((gid) => gid !== groupId),
      });
    }
  });

  return removeGroup(next, groupId);
}

export function changeColor(canvas: Canvas, id: string, color: string): Canvas {
  return updateStyle(canvas, id, { strokeColor: color, fillColor: color });
}

export function changeStroke(canvas: Canvas, id: string, stroke: Style['strokeStyle'], width?: number): Canvas {
  return updateStyle(canvas, id, { strokeStyle: stroke, strokeWidth: width });
}

export function bringForward(canvas: Canvas, _id: string): Canvas {
  // Z-order is handled by element array order in Excalidraw.
  // In our Record representation we maintain no explicit order; adapter sorts by insertion.
  return canvas;
}

export function sendBackward(canvas: Canvas, _id: string): Canvas {
  return canvas;
}

export function setCanvasName(canvas: Canvas, name: string): Canvas {
  return updateMetadata(canvas, { name });
}
