import type { Canvas, Point, Style } from '../../canvas/types.ts';
import { createCanvas, setElement } from '../../canvas/utils.ts';
import type { ExcalidrawScene } from './export.ts';

// Minimal Excalidraw element types for import.
type ExcalidrawBase = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  strokeColor?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
  groupIds?: string[];
  boundElements?: { type: string; id: string }[];
  locked?: boolean;
};

type ExcalidrawText = ExcalidrawBase & {
  type: 'text';
  text: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
};

type ExcalidrawArrow = ExcalidrawBase & {
  type: 'arrow';
  points: [number, number][];
  startBinding?: { elementId: string } | null;
  endBinding?: { elementId: string } | null;
};

type ExcalidrawLinear = ExcalidrawBase & {
  type: 'line' | 'freedraw';
  points: [number, number][];
};

type ExcalidrawImage = ExcalidrawBase & {
  type: 'image';
  fileId: string;
};

interface BaseCanvasFields {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  style: Style;
  locked?: boolean;
  groupIds?: string[];
}

function mapStyle(el: ExcalidrawBase): Style {
  const familyMap: Record<number, string> = {
    1: 'Virgil, Segoe UI Emoji',
    2: 'Helvetica, sans-serif',
    3: 'Courier, monospace',
  };
  return {
    strokeColor: el.strokeColor,
    fillColor: el.backgroundColor,
    strokeWidth: el.strokeWidth,
    strokeStyle: el.strokeStyle,
    opacity: el.opacity,
    fontFamily: familyMap[(el as ExcalidrawText).fontFamily ?? 1],
  };
}

function baseFromExcalidraw(el: ExcalidrawBase): BaseCanvasFields {
  return {
    id: el.id,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    angle: el.angle ?? 0,
    style: mapStyle(el),
    locked: el.locked,
    groupIds: el.groupIds,
  };
}

export function excalidrawToCanvas(scene: ExcalidrawScene): Canvas {
  let canvas = createCanvas({ metadata: { name: 'Imported' } });

  scene.elements.forEach((el) => {
    const base = baseFromExcalidraw(el);

    if (el.type === 'text') {
      const textEl = el as ExcalidrawText;
      canvas = setElement(canvas, {
        ...base,
        type: 'text',
        text: textEl.text,
        style: {
          ...base.style,
          fontSize: textEl.fontSize,
          textAlign: textEl.textAlign,
          verticalAlign: textEl.verticalAlign,
        },
      });
      return;
    }

    if (el.type === 'image') {
      const imgEl = el as ExcalidrawImage;
      canvas = setElement(canvas, {
        ...base,
        type: 'image',
        src: '',
        fileId: imgEl.fileId,
      });
      return;
    }

    if (el.type === 'arrow') {
      const arrowEl = el as ExcalidrawArrow;
      const start: Point = {
        x: arrowEl.x + (arrowEl.points[0]?.[0] ?? 0),
        y: arrowEl.y + (arrowEl.points[0]?.[1] ?? 0),
      };
      const end: Point = {
        x: arrowEl.x + (arrowEl.points[arrowEl.points.length - 1]?.[0] ?? 0),
        y: arrowEl.y + (arrowEl.points[arrowEl.points.length - 1]?.[1] ?? 0),
      };

      canvas = setElement(canvas, {
        ...base,
        type: 'arrow',
        startPoint: start,
        endPoint: end,
        startElementId: arrowEl.startBinding?.elementId,
        endElementId: arrowEl.endBinding?.elementId,
      });
      return;
    }

    if (el.type === 'line' || el.type === 'freedraw') {
      const linear = el as ExcalidrawLinear;
      const points: Point[] = linear.points.map((p) => ({
        x: el.x + p[0],
        y: el.y + p[1],
      }));
      canvas = setElement(canvas, {
        ...base,
        type: linear.type,
        points,
      });
      return;
    }

    if (['rectangle', 'ellipse', 'diamond'].includes(el.type)) {
      canvas = setElement(canvas, {
        ...base,
        type: el.type as 'rectangle' | 'ellipse' | 'diamond',
      });
      return;
    }
  });

  return canvas;
}
