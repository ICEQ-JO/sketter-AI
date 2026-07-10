export type ElementType =
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'text'
  | 'arrow'
  | 'line'
  | 'freedraw'
  | 'image';

export interface Style {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  backgroundColor?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  style?: Style;
  locked?: boolean;
  groupIds?: string[];
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
}

export interface ArrowElement extends BaseElement {
  type: 'arrow';
  startPoint: Point;
  endPoint: Point;
  startElementId?: string;
  endElementId?: string;
  startLabel?: string;
  endLabel?: string;
  label?: string;
}

export interface LineElement extends BaseElement {
  type: 'line';
  points: Point[];
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  fileId?: string;
}

export interface FreeDrawElement extends BaseElement {
  type: 'freedraw';
  points: Point[];
}

export interface ShapeElement extends BaseElement {
  type: 'rectangle' | 'ellipse' | 'diamond';
}

export type CanvasElement =
  | ShapeElement
  | TextElement
  | ArrowElement
  | LineElement
  | ImageElement
  | FreeDrawElement;

export interface Connection {
  id: string;
  fromElementId: string;
  toElementId: string;
  label?: string;
  style?: Style;
}

export interface Group {
  id: string;
  elementIds: string[];
  label?: string;
}

export interface CanvasMetadata {
  name?: string;
  version?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Canvas {
  id: string;
  elements: Record<string, CanvasElement>;
  groups: Record<string, Group>;
  connections: Record<string, Connection>;
  metadata: CanvasMetadata;
}
