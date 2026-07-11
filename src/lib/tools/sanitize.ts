import type { ToolCall, ToolName, PlanToolName } from "./schema";

const MIN_COORD = -20000;
const MAX_COORD = 20000;
const SHAPE_TYPES = new Set(["rectangle", "ellipse", "diamond"]);
const NODE_TYPES = new Set(["rectangle", "ellipse", "diamond", "text"]);
const ELEMENT_TYPES = new Set([
  "rectangle",
  "ellipse",
  "diamond",
  "text",
  "arrow",
  "line",
]);

export type SanitizedCall =
  | { ok: true; name: ToolName; args: Record<string, unknown> }
  | { ok: false; name: ToolName; reason: string };

function clampNum(v: unknown, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.min(MAX_COORD, Math.max(MIN_COORD, n));
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Validates and clamps a raw tool call before it touches the scene. This is
 * the reliability layer: reject calls that reference nonexistent ids, clamp
 * coordinates, and fill in sane defaults so a small/cheap model can't corrupt
 * the canvas.
 */
export function sanitizeToolCall(
  call: Pick<ToolCall, "name" | "arguments">,
  validIds: Set<string>,
): SanitizedCall {
  const a = call.arguments ?? {};

  switch (call.name) {
    case "add_node": {
      if (!isNonEmptyString(a.id)) {
        return { ok: false, name: call.name, reason: "missing id" };
      }
      if (!NODE_TYPES.has(a.type as string)) {
        return { ok: false, name: call.name, reason: `invalid type ${String(a.type)}` };
      }
      const type = a.type as string;
      const args: Record<string, unknown> = { id: a.id, type };
      if (SHAPE_TYPES.has(type)) {
        args.width = clampNum(a.width, 120);
        args.height = clampNum(a.height, 80);
      }
      if (isNonEmptyString(a.text)) args.text = a.text;
      if (isNonEmptyString(a.group)) args.group = a.group;
      if (isNonEmptyString(a.strokeColor)) args.strokeColor = a.strokeColor;
      if (isNonEmptyString(a.backgroundColor)) args.backgroundColor = a.backgroundColor;
      return { ok: true, name: call.name, args };
    }

    case "add_freeform": {
      if (!isNonEmptyString(a.id)) {
        return { ok: false, name: call.name, reason: "missing id" };
      }
      if (!ELEMENT_TYPES.has(a.type as string)) {
        return { ok: false, name: call.name, reason: `invalid type ${String(a.type)}` };
      }
      const type = a.type as string;
      const args: Record<string, unknown> = {
        id: a.id,
        type,
        x: clampNum(a.x, 0),
        y: clampNum(a.y, 0),
      };
      if (SHAPE_TYPES.has(type)) {
        args.width = clampNum(a.width, 120);
        args.height = clampNum(a.height, 80);
      } else if (type === "arrow" || type === "line") {
        args.width = clampNum(a.width, 160);
        args.height = clampNum(a.height, 0);
      }
      if (isNonEmptyString(a.text)) args.text = a.text;
      if (isNonEmptyString(a.strokeColor)) args.strokeColor = a.strokeColor;
      if (isNonEmptyString(a.backgroundColor)) args.backgroundColor = a.backgroundColor;
      return { ok: true, name: call.name, args };
    }

    case "connect": {
      if (!isNonEmptyString(a.from) || !validIds.has(a.from)) {
        return { ok: false, name: call.name, reason: `unknown 'from' id ${String(a.from)}` };
      }
      if (!isNonEmptyString(a.to) || !validIds.has(a.to)) {
        return { ok: false, name: call.name, reason: `unknown 'to' id ${String(a.to)}` };
      }
      const args: Record<string, unknown> = { from: a.from, to: a.to };
      if (isNonEmptyString(a.label)) args.label = a.label;
      return { ok: true, name: call.name, args };
    }

    case "update_element": {
      if (!isNonEmptyString(a.id) || !validIds.has(a.id)) {
        return { ok: false, name: call.name, reason: `unknown id ${String(a.id)}` };
      }
      const args: Record<string, unknown> = { id: a.id };
      if (typeof a.x === "number") args.x = clampNum(a.x, 0);
      if (typeof a.y === "number") args.y = clampNum(a.y, 0);
      if (isNonEmptyString(a.type)) {
        if (!NODE_TYPES.has(a.type)) {
          return { ok: false, name: call.name, reason: `invalid type ${String(a.type)}` };
        }
        args.type = a.type;
      }
      if (isNonEmptyString(a.text)) args.text = a.text;
      if (isNonEmptyString(a.strokeColor)) args.strokeColor = a.strokeColor;
      if (isNonEmptyString(a.backgroundColor)) args.backgroundColor = a.backgroundColor;
      return { ok: true, name: call.name, args };
    }

    case "move_relative": {
      if (!isNonEmptyString(a.id) || !validIds.has(a.id)) {
        return { ok: false, name: call.name, reason: `unknown id ${String(a.id)}` };
      }
      if (!isNonEmptyString(a.relative_to) || !validIds.has(a.relative_to)) {
        return {
          ok: false,
          name: call.name,
          reason: `unknown relative_to id ${String(a.relative_to)}`,
        };
      }
      if (!["above", "below", "left", "right"].includes(a.position as string)) {
        return { ok: false, name: call.name, reason: `invalid position ${String(a.position)}` };
      }
      const args: Record<string, unknown> = {
        id: a.id,
        relative_to: a.relative_to,
        position: a.position,
        gap: typeof a.gap === "number" ? Math.max(0, a.gap) : 40,
      };
      return { ok: true, name: call.name, args };
    }

    case "delete_element": {
      if (!isNonEmptyString(a.id) || !validIds.has(a.id)) {
        return { ok: false, name: call.name, reason: `unknown id ${String(a.id)}` };
      }
      return { ok: true, name: call.name, args: { id: a.id } };
    }

    case "group": {
      const ids = Array.isArray(a.ids)
        ? a.ids.filter((id) => isNonEmptyString(id) && validIds.has(id))
        : [];
      if (ids.length < 2) {
        return { ok: false, name: call.name, reason: "fewer than 2 valid ids" };
      }
      return { ok: true, name: call.name, args: { ids } };
    }

    case "align": {
      const ids = Array.isArray(a.ids)
        ? a.ids.filter((id) => isNonEmptyString(id) && validIds.has(id))
        : [];
      if (ids.length < 2) {
        return { ok: false, name: call.name, reason: "fewer than 2 valid ids" };
      }
      if (!["horizontal", "vertical"].includes(a.axis as string)) {
        return { ok: false, name: call.name, reason: `invalid axis ${String(a.axis)}` };
      }
      return { ok: true, name: call.name, args: { ids, axis: a.axis } };
    }

    case "import_mermaid": {
      if (!isNonEmptyString(a.definition)) {
        return { ok: false, name: call.name, reason: "missing definition" };
      }
      return { ok: true, name: call.name, args: { definition: a.definition } };
    }

    default:
      return { ok: false, name: call.name, reason: `unknown tool ${String(call.name)}` };
  }
}

export interface SanitizedPlanNode {
  id: string;
  label: string;
  type: string;
  group?: string;
}

export interface SanitizedPlanEdge {
  from: string;
  to: string;
  label?: string;
}

export type SanitizedPlanCall =
  | {
      ok: true;
      name: PlanToolName;
      args: Record<string, unknown>;
    }
  | { ok: false; name: PlanToolName; reason: string };

const PLAN_NODE_TYPES = new Set(["rectangle", "ellipse", "diamond", "text"]);

/**
 * Structural validation for plan-mode tool calls — plan mode had zero
 * sanitize coverage before propose_plan became structured data, and
 * structured data is much easier to get subtly wrong (duplicate ids,
 * dangling edge references) than free prose ever was.
 */
export function sanitizePlanToolCall(call: {
  name: PlanToolName;
  arguments: Record<string, unknown>;
}): SanitizedPlanCall {
  const a = call.arguments ?? {};

  switch (call.name) {
    case "ask_question": {
      if (!isNonEmptyString(a.question)) {
        return { ok: false, name: call.name, reason: "missing question" };
      }
      const args: Record<string, unknown> = { question: a.question };
      if (Array.isArray(a.options)) {
        const options = a.options.filter(isNonEmptyString);
        if (options.length >= 2) args.options = options;
      }
      return { ok: true, name: call.name, args };
    }

    case "propose_plan": {
      if (!isNonEmptyString(a.summary)) {
        return { ok: false, name: call.name, reason: "missing summary" };
      }

      const seenIds = new Set<string>();
      const nodes: SanitizedPlanNode[] = [];
      for (const raw of Array.isArray(a.nodes) ? a.nodes : []) {
        if (!raw || typeof raw !== "object") continue;
        const n = raw as Record<string, unknown>;
        if (!isNonEmptyString(n.id) || seenIds.has(n.id)) continue;
        if (!isNonEmptyString(n.label)) continue;
        if (!PLAN_NODE_TYPES.has(n.type as string)) continue;
        seenIds.add(n.id);
        const node: SanitizedPlanNode = { id: n.id, label: n.label, type: n.type as string };
        if (isNonEmptyString(n.group)) node.group = n.group;
        nodes.push(node);
      }
      if (nodes.length === 0) {
        return { ok: false, name: call.name, reason: "no valid nodes" };
      }

      const nodeIds = new Set(nodes.map((n) => n.id));
      const edges: SanitizedPlanEdge[] = [];
      for (const raw of Array.isArray(a.edges) ? a.edges : []) {
        if (!raw || typeof raw !== "object") continue;
        const e = raw as Record<string, unknown>;
        if (!isNonEmptyString(e.from) || !nodeIds.has(e.from)) continue;
        if (!isNonEmptyString(e.to) || !nodeIds.has(e.to)) continue;
        const edge: SanitizedPlanEdge = { from: e.from, to: e.to };
        if (isNonEmptyString(e.label)) edge.label = e.label;
        edges.push(edge);
      }

      return { ok: true, name: call.name, args: { summary: a.summary, nodes, edges } };
    }

    default:
      return { ok: false, name: call.name, reason: `unknown tool ${String(call.name)}` };
  }
}
