import { generateId } from './utils.ts';
import type {
  ArrowElement,
  CanvasElement,
  FreeDrawElement,
  ImageElement,
  LineElement,
  Point,
  ShapeElement,
  Style,
  TextElement,
} from './types.ts';

const DEFAULT_STYLE: Required<Style> = {
  fillColor: '#ffffff',
  strokeColor: '#1e1e1e',
  strokeWidth: 2,
  strokeStyle: 'solid',
  opacity: 100,
  fontSize: 20,
  fontFamily: 'Virgil, Segoe UI Emoji',
  textAlign: 'center',
  verticalAlign: 'middle',
  backgroundColor: 'transparent',
};

export function mergeStyle(style?: Style): Required<Style> {
  return { ...DEFAULT_STYLE, ...style };
}

export interface CreateShapeOptions {
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  style?: Style;
}

export function createShape(
  type: ShapeElement['type'],
  options: CreateShapeOptions = {}
): ShapeElement {
  return {
    id: options.id ?? generateId(),
    type,
    x: options.x ?? 0,
    y: options.y ?? 0,
    width: options.width ?? 120,
    height: options.height ?? 80,
    style: mergeStyle(options.style),
  };
}

export function createRectangle(options: CreateShapeOptions = {}): ShapeElement {
  return createShape('rectangle', options);
}

export function createEllipse(options: CreateShapeOptions = {}): ShapeElement {
  return createShape('ellipse', { width: 120, height: 120, ...options });
}

export function createDiamond(options: CreateShapeOptions = {}): ShapeElement {
  return createShape('diamond', { width: 120, height: 120, ...options });
}

export interface CreateTextOptions {
  id?: string;
  x?: number;
  y?: number;
  text?: string;
  fontSize?: number;
  style?: Style;
}

export function createText(options: CreateTextOptions = {}): TextElement {
  const style = mergeStyle(options.style);
  const fontSize = options.fontSize ?? style.fontSize;
  const width = (options.text?.length ?? 1) * fontSize * 0.6;
  const height = fontSize * 1.5;

  return {
    id: options.id ?? generateId(),
    type: 'text',
    x: options.x ?? 0,
    y: options.y ?? 0,
    width,
    height,
    text: options.text ?? '',
    style: { ...style, fontSize },
  };
}

export interface CreateArrowOptions {
  id?: string;
  startPoint: Point;
  endPoint: Point;
  startElementId?: string;
  endElementId?: string;
  label?: string;
  style?: Style;
}

export function createArrow(options: CreateArrowOptions): ArrowElement {
  const minX = Math.min(options.startPoint.x, options.endPoint.x);
  const minY = Math.min(options.startPoint.y, options.endPoint.y);
  const width = Math.abs(options.endPoint.x - options.startPoint.x);
  const height = Math.abs(options.endPoint.y - options.startPoint.y);

  return {
    id: options.id ?? generateId(),
    type: 'arrow',
    x: minX,
    y: minY,
    width,
    height,
    startPoint: options.startPoint,
    endPoint: options.endPoint,
    startElementId: options.startElementId,
    endElementId: options.endElementId,
    label: options.label,
    style: mergeStyle(options.style),
  };
}

export interface CreateLineOptions {
  id?: string;
  points: Point[];
  style?: Style;
}

export function createLine(options: CreateLineOptions): LineElement {
  const xs = options.points.map((p) => p.x);
  const ys = options.points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    id: options.id ?? generateId(),
    type: 'line',
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    points: options.points,
    style: mergeStyle(options.style),
  };
}

export interface CreateFreeDrawOptions {
  id?: string;
  points: Point[];
  style?: Style;
}

export function createFreeDraw(options: CreateFreeDrawOptions): FreeDrawElement {
  const xs = options.points.map((p) => p.x);
  const ys = options.points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    id: options.id ?? generateId(),
    type: 'freedraw',
    x: minX,
    y: minY,
    width: maxX - minX || 1,
    height: maxY - minY || 1,
    points: options.points,
    style: mergeStyle(options.style),
  };
}

export interface CreateImageOptions {
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  src: string;
  fileId?: string;
}

export function createImage(options: CreateImageOptions): ImageElement {
  return {
    id: options.id ?? generateId(),
    type: 'image',
    x: options.x ?? 0,
    y: options.y ?? 0,
    width: options.width ?? 100,
    height: options.height ?? 100,
    src: options.src,
    fileId: options.fileId,
    style: mergeStyle({}),
  };
}

export function duplicateElement(element: CanvasElement): CanvasElement {
  const copy = structuredClone(element);
  copy.id = generateId();
  copy.x += 20;
  copy.y += 20;
  return copy;
}
