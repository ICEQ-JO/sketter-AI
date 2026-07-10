import { nanoid } from 'nanoid';
import type { Canvas, CanvasElement, Connection, Group, Point, Style } from './types.ts';

export function generateId(): string {
  return nanoid(12);
}

export function createCanvas(overrides: Partial<Canvas> = {}): Canvas {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    elements: {},
    groups: {},
    connections: {},
    metadata: {
      name: 'Untitled',
      version: '0.1.0',
      createdAt: now,
      updatedAt: now,
      ...overrides.metadata,
    },
    ...overrides,
  };
}

export function cloneCanvas(canvas: Canvas): Canvas {
  return {
    ...canvas,
    elements: { ...canvas.elements },
    groups: { ...canvas.groups },
    connections: { ...canvas.connections },
    metadata: { ...canvas.metadata },
  };
}

export function updateMetadata(canvas: Canvas, metadata: Partial<Canvas['metadata']>): Canvas {
  const next = cloneCanvas(canvas);
  next.metadata = { ...next.metadata, ...metadata, updatedAt: new Date().toISOString() };
  return next;
}

export function getElement(canvas: Canvas, id: string): CanvasElement | undefined {
  return canvas.elements[id];
}

export function getElements(canvas: Canvas): CanvasElement[] {
  return Object.values(canvas.elements);
}

export function getSelectedElements(canvas: Canvas, ids: string[]): CanvasElement[] {
  return ids.map((id) => canvas.elements[id]).filter(Boolean);
}

export function setElement(canvas: Canvas, element: CanvasElement): Canvas {
  const next = cloneCanvas(canvas);
  next.elements[element.id] = element;
  return updateMetadata(next, {});
}

export function removeElement(canvas: Canvas, id: string): Canvas {
  const next = cloneCanvas(canvas);
  delete next.elements[id];

  // Remove related connections
  Object.keys(next.connections).forEach((connId) => {
    const conn = next.connections[connId];
    if (conn.fromElementId === id || conn.toElementId === id) {
      delete next.connections[connId];
    }
  });

  // Remove from groups
  Object.keys(next.groups).forEach((groupId) => {
    const group = next.groups[groupId];
    group.elementIds = group.elementIds.filter((eid) => eid !== id);
    if (group.elementIds.length === 0) {
      delete next.groups[groupId];
    }
  });

  return updateMetadata(next, {});
}

export function addConnection(canvas: Canvas, connection: Connection): Canvas {
  const next = cloneCanvas(canvas);
  next.connections[connection.id] = connection;
  return updateMetadata(next, {});
}

export function removeConnection(canvas: Canvas, id: string): Canvas {
  const next = cloneCanvas(canvas);
  delete next.connections[id];
  return updateMetadata(next, {});
}

export function addGroup(canvas: Canvas, group: Group): Canvas {
  const next = cloneCanvas(canvas);
  next.groups[group.id] = group;
  return updateMetadata(next, {});
}

export function removeGroup(canvas: Canvas, id: string): Canvas {
  const next = cloneCanvas(canvas);
  delete next.groups[id];
  return updateMetadata(next, {});
}

export function moveElement(
  canvas: Canvas,
  id: string,
  deltaOrPoint: Point | { dx: number; dy: number }
): Canvas {
  const element = getElement(canvas, id);
  if (!element) return canvas;

  const dx = 'dx' in deltaOrPoint ? deltaOrPoint.dx : deltaOrPoint.x - element.x;
  const dy = 'dy' in deltaOrPoint ? deltaOrPoint.dy : deltaOrPoint.y - element.y;

  const next = setElement(canvas, { ...element, x: element.x + dx, y: element.y + dy });

  // Move connected arrows if they are bound
  Object.values(next.elements).forEach((el) => {
    if (el.type === 'arrow') {
      const arrow = el as import('./types.ts').ArrowElement;
      if (arrow.startElementId === id || arrow.endElementId === id) {
        // Arrow position is recomputed by the adapter; here we just keep the semantic connection.
      }
    }
  });

  return next;
}

export function resizeElement(
  canvas: Canvas,
  id: string,
  width: number,
  height: number
): Canvas {
  const element = getElement(canvas, id);
  if (!element) return canvas;
  return setElement(canvas, { ...element, width, height });
}

export function updateStyle(canvas: Canvas, id: string, style: Style): Canvas {
  const element = getElement(canvas, id);
  if (!element) return canvas;
  return setElement(canvas, { ...element, style: { ...element.style, ...style } });
}

export function updateElementText(canvas: Canvas, id: string, text: string): Canvas {
  const element = getElement(canvas, id);
  if (!element) return canvas;
  if (element.type === 'text') {
    return setElement(canvas, { ...element, text });
  }
  return canvas;
}
