import { z } from 'zod';
import {
  type CreateShapeOptions,
  type CreateTextOptions,
} from '../canvas/element.ts';
import * as ops from '../canvas/operations.ts';
import * as layout from '../layout/index.ts';
import type { ToolContext, ToolDefinition, ToolHandler, ToolResult } from './types.ts';

const styleSchema = z.object({
  fillColor: z.string().optional(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().optional(),
}).optional();

const definitions: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'create_box',
      description: 'Create a rectangle on the canvas. Use this for services, components, or any box-like concept.',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate. Omit or set 0 to let the layout engine place it.' },
          y: { type: 'number', description: 'Y coordinate. Omit or set 0 to let the layout engine place it.' },
          width: { type: 'number' },
          height: { type: 'number' },
          text: { type: 'string', description: 'Label inside the box' },
          style: {
            type: 'object',
            properties: {
              fillColor: { type: 'string' },
              strokeColor: { type: 'string' },
              strokeWidth: { type: 'number' },
            },
          },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_circle',
      description: 'Create an ellipse. Useful for states, databases, or endpoints.',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          text: { type: 'string' },
          style: { type: 'object', properties: { fillColor: { type: 'string' }, strokeColor: { type: 'string' }, strokeWidth: { type: 'number' } } },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_diamond',
      description: 'Create a diamond. Useful for decisions.',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          text: { type: 'string' },
          style: { type: 'object', properties: { fillColor: { type: 'string' }, strokeColor: { type: 'string' }, strokeWidth: { type: 'number' } } },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_text',
      description: 'Create a text element.',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          text: { type: 'string' },
          fontSize: { type: 'number' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'connect',
      description: 'Draw an arrow between two elements.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'ID of the source element' },
          to: { type: 'string', description: 'ID of the target element' },
          label: { type: 'string', description: 'Optional label on the arrow' },
        },
        required: ['from', 'to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move',
      description: 'Move an element by a delta or to an absolute position.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          dx: { type: 'number' },
          dy: { type: 'number' },
          x: { type: 'number' },
          y: { type: 'number' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'place_relative',
      description: 'Place an element relative to another (right, left, above, below).',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          to: { type: 'string', description: 'Reference element ID' },
          direction: { type: 'string', enum: ['right', 'left', 'above', 'below'] },
          gap: { type: 'number' },
        },
        required: ['id', 'to', 'direction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'align',
      description: 'Align multiple elements along an axis.',
      parameters: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
          axis: { type: 'string', enum: ['left', 'center', 'right', 'top', 'middle', 'bottom'] },
        },
        required: ['ids', 'axis'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'distribute',
      description: 'Evenly distribute multiple elements horizontally or vertically.',
      parameters: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
          axis: { type: 'string', enum: ['horizontal', 'vertical'] },
        },
        required: ['ids', 'axis'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete',
      description: 'Delete an element by ID.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'group',
      description: 'Group elements together.',
      parameters: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
          label: { type: 'string' },
        },
        required: ['ids'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'change_color',
      description: 'Change the stroke and fill color of an element.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          color: { type: 'string', description: 'CSS color string' },
        },
        required: ['id', 'color'],
      },
    },
  },
];

const handlers: Record<string, ToolHandler> = {
  create_box: (ctx, args) => {
    const opts: CreateShapeOptions = {
      x: z.number().optional().catch(undefined).parse(args.x),
      y: z.number().optional().catch(undefined).parse(args.y),
      width: z.number().optional().catch(undefined).parse(args.width),
      height: z.number().optional().catch(undefined).parse(args.height),
      text: z.string().parse(args.text),
      style: styleSchema.parse(args.style),
    };
    const [next, id] = ops.createRectangle(ctx.canvas, opts);
    return { canvas: next, output: `Created box ${id} with text "${opts.text}"` };
  },
  create_circle: (ctx, args) => {
    const opts: CreateShapeOptions = {
      x: z.number().optional().catch(undefined).parse(args.x),
      y: z.number().optional().catch(undefined).parse(args.y),
      width: z.number().optional().catch(undefined).parse(args.width),
      height: z.number().optional().catch(undefined).parse(args.height),
      text: z.string().parse(args.text),
      style: styleSchema.parse(args.style),
    };
    const [next, id] = ops.createEllipse(ctx.canvas, opts);
    return { canvas: next, output: `Created circle ${id}` };
  },
  create_diamond: (ctx, args) => {
    const opts: CreateShapeOptions = {
      x: z.number().optional().catch(undefined).parse(args.x),
      y: z.number().optional().catch(undefined).parse(args.y),
      text: z.string().parse(args.text),
      style: styleSchema.parse(args.style),
    };
    const [next, id] = ops.createDiamond(ctx.canvas, opts);
    return { canvas: next, output: `Created diamond ${id}` };
  },
  create_text: (ctx, args) => {
    const opts: CreateTextOptions = {
      x: z.number().optional().catch(undefined).parse(args.x),
      y: z.number().optional().catch(undefined).parse(args.y),
      text: z.string().parse(args.text),
      fontSize: z.number().optional().catch(undefined).parse(args.fontSize),
    };
    const [next, id] = ops.createText(ctx.canvas, opts);
    return { canvas: next, output: `Created text ${id}` };
  },
  connect: (ctx, args) => {
    const from = z.string().parse(args.from);
    const to = z.string().parse(args.to);
    const label = z.string().optional().catch(undefined).parse(args.label);
    const [next, id] = ops.connect(ctx.canvas, from, to, label);
    return { canvas: next, output: id ? `Connected ${from} → ${to}` : `Could not connect ${from} → ${to}` };
  },
  move: (ctx, args) => {
    const id = z.string().parse(args.id);
    const dx = z.number().optional().catch(undefined).parse(args.dx);
    const dy = z.number().optional().catch(undefined).parse(args.dy);
    const x = z.number().optional().catch(undefined).parse(args.x);
    const y = z.number().optional().catch(undefined).parse(args.y);

    let next = ctx.canvas;
    if (x !== undefined && y !== undefined) {
      next = layout.placeAt(next, id, x, y);
    } else if (dx !== undefined && dy !== undefined) {
      const el = next.elements[id];
      if (el) next = layout.placeAt(next, id, el.x + dx, el.y + dy);
    }
    return { canvas: next, output: `Moved ${id}` };
  },
  place_relative: (ctx, args) => {
    const id = z.string().parse(args.id);
    const to = z.string().parse(args.to);
    const direction = z.enum(['right', 'left', 'above', 'below']).parse(args.direction);
    const gap = z.number().optional().catch(undefined).parse(args.gap);
    const next = layout.placeRelative(ctx.canvas, id, to, direction, gap);
    return { canvas: next, output: `Placed ${id} ${direction} ${to}` };
  },
  align: (ctx, args) => {
    const ids = z.array(z.string()).parse(args.ids);
    const axis = z.enum(['left', 'center', 'right', 'top', 'middle', 'bottom']).parse(args.axis);
    const next = layout.align(ctx.canvas, ids, axis);
    return { canvas: next, output: `Aligned ${ids.length} elements ${axis}` };
  },
  distribute: (ctx, args) => {
    const ids = z.array(z.string()).parse(args.ids);
    const axis = z.enum(['horizontal', 'vertical']).parse(args.axis);
    const next = layout.distribute(ctx.canvas, ids, axis);
    return { canvas: next, output: `Distributed ${ids.length} elements ${axis}` };
  },
  delete: (ctx, args) => {
    const id = z.string().parse(args.id);
    const next = ops.deleteElement(ctx.canvas, id);
    return { canvas: next, output: `Deleted ${id}` };
  },
  group: (ctx, args) => {
    const ids = z.array(z.string()).parse(args.ids);
    const label = z.string().optional().catch(undefined).parse(args.label);
    const [next, id] = ops.group(ctx.canvas, ids, label);
    return { canvas: next, output: id ? `Grouped into ${id}` : 'No elements to group' };
  },
  change_color: (ctx, args) => {
    const id = z.string().parse(args.id);
    const color = z.string().parse(args.color);
    const next = ops.changeColor(ctx.canvas, id, color);
    return { canvas: next, output: `Changed color of ${id}` };
  },
};

export function getToolDefinitions(): ToolDefinition[] {
  return definitions;
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const handler = handlers[name];
  if (!handler) {
    return { canvas: ctx.canvas, output: `Unknown tool: ${name}` };
  }
  return handler(ctx, args);
}
