import type { Canvas } from '../canvas/types.ts';

export function buildSpatialMemory(canvas: Canvas): string {
  const elements = Object.values(canvas.elements);
  const groups = Object.values(canvas.groups);
  const connections = Object.values(canvas.connections);

  const lines: string[] = [];
  lines.push(`Canvas: ${canvas.metadata.name ?? 'Untitled'}`);
  lines.push(`Elements: ${elements.length}`);
  lines.push(`Groups: ${groups.length}`);
  lines.push(`Connections: ${connections.length}`);
  lines.push('');

  if (elements.length > 0) {
    lines.push('Elements:');
    elements.forEach((el) => {
      const label = el.type === 'text' ? (el as import('../canvas/types.ts').TextElement).text : '';
      const connectedTo = connections
        .filter((c) => c.fromElementId === el.id)
        .map((c) => canvas.elements[c.toElementId]?.type ?? c.toElementId)
        .join(', ');
      lines.push(
        `- ${el.type} id=${el.id} x=${Math.round(el.x)} y=${Math.round(el.y)} w=${Math.round(
          el.width
        )} h=${Math.round(el.height)}${label ? ` text="${label}"` : ''}${
          connectedTo ? ` → ${connectedTo}` : ''
        }`
      );
    });
  }

  if (connections.length > 0) {
    lines.push('');
    lines.push('Connections:');
    connections.forEach((c) => {
      lines.push(`- ${c.fromElementId} → ${c.toElementId}${c.label ? ` (${c.label})` : ''}`);
    });
  }

  return lines.join('\n');
}

export function buildSystemPrompt(): string {
  return `You are CanvasAI, an AI that edits diagrams through a Canvas SDK.
You control a visual canvas using tools. Never output raw coordinates or JSON.
Reason about diagrams in concepts: "create a box", "place it right of X", "connect A to B", "align these".
When the user asks for a diagram, create the necessary elements and arrange them cleanly.
Always prefer relative placement (place_relative) over absolute coordinates.
Use the layout tools (align, distribute) to make diagrams tidy.
Element IDs are short strings returned by creation tools. Use them for subsequent operations.
`;
}
