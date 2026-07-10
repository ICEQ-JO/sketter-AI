import type { Canvas, CanvasElement, ArrowElement, Style } from '../../canvas/types.ts';

// Minimal Excalidraw element shapes used by this adapter.
// Full typing is available from @excalidraw/excalidraw but we keep this self-contained.

interface ExcalidrawBase {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: 'solid' | 'hachure' | 'cross-hatch';
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: null;
  roundness: { type: number; value?: number } | null;
  boundElements: { type: 'arrow'; id: string }[];
  link: null;
  locked: boolean;
}

interface ExcalidrawText extends ExcalidrawBase {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: number;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  baseline: number;
  containerId?: string;
  originalText?: string;
}

interface ExcalidrawArrow extends ExcalidrawBase {
  type: 'arrow';
  points: [number, number][];
  startBinding: { elementId: string; focus: number; gap: number } | null;
  endBinding: { elementId: string; focus: number; gap: number } | null;
  startArrowhead: null;
  endArrowhead: 'arrow';
  elbowed?: boolean;
}

interface ExcalidrawLinear extends ExcalidrawBase {
  type: 'line' | 'freedraw';
  points: [number, number][];
  lastCommittedPoint?: [number, number];
}

interface ExcalidrawImage extends ExcalidrawBase {
  type: 'image';
  fileId: string;
  scale: [number, number];
  status: 'pending' | 'saved';
}

type ExcalidrawElement =
  | ExcalidrawBase
  | ExcalidrawText
  | ExcalidrawArrow
  | ExcalidrawLinear
  | ExcalidrawImage;

export interface ExcalidrawScene {
  type: 'excalidraw';
  version: 2;
  source: string;
  elements: ExcalidrawElement[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
}

function fontFamilyToExcalidraw(fontFamily?: string): number {
  if (fontFamily?.includes('Helvetica')) return 1;
  if (fontFamily?.includes('Courier')) return 2;
  return 1; // Virgil / Hand-drawn default maps to 1
}

function mapStyle(style: Style | undefined) {
  const s = style ?? {};
  return {
    strokeColor: s.strokeColor ?? '#1e1e1e',
    backgroundColor: s.fillColor ?? 'transparent',
    strokeWidth: s.strokeWidth ?? 2,
    strokeStyle: (s.strokeStyle as 'solid' | 'dashed' | 'dotted') ?? 'solid',
    opacity: s.opacity ?? 100,
  };
}

function baseFromElement(el: CanvasElement): ExcalidrawBase {
  const style = mapStyle(el.style);
  return {
    id: el.id,
    type: el.type,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    angle: el.angle ?? 0,
    strokeColor: style.strokeColor,
    backgroundColor: style.backgroundColor,
    fillStyle: 'solid',
    strokeWidth: style.strokeWidth,
    strokeStyle: style.strokeStyle,
    roughness: 1,
    opacity: style.opacity,
    groupIds: el.groupIds ?? [],
    frameId: null,
    roundness: el.type === 'rectangle' ? { type: 3 } : { type: 2 },
    boundElements: [],
    link: null,
    locked: el.locked ?? false,
  };
}

export function canvasToExcalidraw(canvas: Canvas): ExcalidrawScene {
  const elements = Object.values(canvas.elements);
  const excalidrawElements: ExcalidrawElement[] = [];
  const boundMap = new Map<string, string[]>();

  // First pass: create shape/text/image elements and collect arrow bindings.
  elements.forEach((el) => {
    if (el.type === 'text') {
      const textEl = el as import('../../canvas/types.ts').TextElement;
      excalidrawElements.push({
        ...baseFromElement(textEl),
        type: 'text',
        text: textEl.text,
        fontSize: textEl.style?.fontSize ?? 20,
        fontFamily: fontFamilyToExcalidraw(textEl.style?.fontFamily),
        textAlign: (textEl.style?.textAlign as 'left' | 'center' | 'right') ?? 'center',
        verticalAlign: (textEl.style?.verticalAlign as 'top' | 'middle' | 'bottom') ?? 'middle',
        baseline: (textEl.style?.fontSize ?? 20) * 0.7,
      } as ExcalidrawText);
      return;
    }

    if (el.type === 'image') {
      const imgEl = el as import('../../canvas/types.ts').ImageElement;
      excalidrawElements.push({
        ...baseFromElement(imgEl),
        type: 'image',
        fileId: imgEl.fileId ?? imgEl.id,
        scale: [1, 1],
        status: 'saved',
      } as ExcalidrawImage);
      return;
    }

    if (el.type === 'arrow') {
      // Arrows are handled in second pass after bound targets exist.
      return;
    }

    if (el.type === 'line' || el.type === 'freedraw') {
      const linear = el as import('../../canvas/types.ts').LineElement | import('../../canvas/types.ts').FreeDrawElement;
      const points: [number, number][] = linear.points.map((p) => [p.x - el.x, p.y - el.y]);
      excalidrawElements.push({
        ...baseFromElement(linear),
        type: linear.type,
        points,
      } as ExcalidrawLinear);
      return;
    }

    // rectangle, ellipse, diamond
    excalidrawElements.push(baseFromElement(el));
  });

  // Second pass: arrows with bindings.
  elements.forEach((el) => {
    if (el.type !== 'arrow') return;
    const arrow = el as ArrowElement;
    const relativeStart: [number, number] = [arrow.startPoint.x - arrow.x, arrow.startPoint.y - arrow.y];
    const relativeEnd: [number, number] = [arrow.endPoint.x - arrow.x, arrow.endPoint.y - arrow.y];

    const excalArrow: ExcalidrawArrow = {
      ...baseFromElement(arrow),
      type: 'arrow',
      points: [relativeStart, relativeEnd],
      startBinding: arrow.startElementId
        ? { elementId: arrow.startElementId, focus: 0.2, gap: 8 }
        : null,
      endBinding: arrow.endElementId
        ? { elementId: arrow.endElementId, focus: 0.2, gap: 8 }
        : null,
      startArrowhead: null,
      endArrowhead: 'arrow',
    };

    if (arrow.startElementId) {
      const list = boundMap.get(arrow.startElementId) ?? [];
      list.push(arrow.id);
      boundMap.set(arrow.startElementId, list);
    }
    if (arrow.endElementId) {
      const list = boundMap.get(arrow.endElementId) ?? [];
      list.push(arrow.id);
      boundMap.set(arrow.endElementId, list);
    }

    excalidrawElements.push(excalArrow);
  });

  // Add boundElements references to targets.
  excalidrawElements.forEach((exEl) => {
    const bound = boundMap.get(exEl.id);
    if (bound && bound.length > 0) {
      exEl.boundElements = bound.map((id) => ({ type: 'arrow', id }));
    }
  });

  return {
    type: 'excalidraw',
    version: 2,
    source: 'canvas-ai',
    elements: excalidrawElements,
    appState: {
      viewBackgroundColor: '#ffffff',
      currentItemFontFamily: 1,
      zoom: { value: 1 },
    },
    files: {},
  };
}
