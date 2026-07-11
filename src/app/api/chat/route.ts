import { TOOL_SCHEMA, PLAN_TOOL_SCHEMA } from "@/lib/tools/schema";
import type { CanvasSummary } from "@/lib/canvas/summary";
import type { ChatMode } from "@/lib/chat/mode";

export const runtime = "edge";

interface ChatRequestBody {
  apiKey: string;
  model: string;
  messages: { role: "user" | "assistant"; content: string }[];
  canvasSummary: CanvasSummary;
  mode: ChatMode;
}

const AGENT_IDENTITY =
  "You are Sketter, an autonomous diagramming agent embedded in a canvas app — not a generic chatbot. " +
  "You have direct tool access to create and edit an Excalidraw diagram on the user's screen. Act like an agent: " +
  "gather what you genuinely need, commit to a plan, then execute it decisively.";

function systemPrompt(canvasSummary: CanvasSummary, mode: ChatMode): string {
  const shared = [
    "Current canvas state (compact summary, not full Excalidraw JSON):",
    JSON.stringify(canvasSummary),
  ];

  if (mode === "plan") {
    return [
      AGENT_IDENTITY,
      "You are currently in PLAN mode: you cannot touch the canvas yet.",
      "Use the ask_question tool to clarify anything genuinely ambiguous before committing to a plan — one question per call, and prefer multiple-choice options when there's a natural set of choices. Don't ask about things you can reasonably infer or default; keep the back-and-forth short.",
      "Once you have enough information, call propose_plan with structured data: nodes (id, label, type, optional group) and edges (from, to, optional label) describing the diagram. Do not describe positions or coordinates — layout is computed automatically, exactly the same way it will be in BUILD mode. Group nodes that belong together with the same `group` value. Don't call ask_question and propose_plan in the same turn.",
      "After propose_plan, stop and wait. The user approves the plan themselves in the UI, which builds it directly from your structured nodes/edges and switches you to BUILD mode — don't explain how to approve, don't restate the plan as plain prose outside the tool call.",
      "If the user answers a question or gives new instructions instead of approving, keep iterating: ask another question if needed, or move straight to propose_plan.",
      ...shared,
    ].join("\n");
  }

  return [
    AGENT_IDENTITY,
    "You are currently in BUILD mode: draw and edit the Excalidraw canvas by calling tools immediately, without asking for permission again.",
    "If a plan was just approved or described earlier in this conversation, follow it closely as you build.",
    "You never emit raw Excalidraw JSON — only call the provided tools.",
    "Create diagrams incrementally: call add_node for each shape that's part of a connected structure — never specify x/y for these, layout is computed automatically once your tool calls finish, arranging nodes by their connections and group. Use add_freeform only for standalone annotations, titles, or notes that are NOT part of the connected graph — those require an explicit x/y.",
    "Call connect to draw arrows between add_node elements; arrows influence how they're laid out.",
    "Prefer move_relative over add_freeform coordinates when the user describes a relationship to something outside the graph (e.g. 'above', 'next to').",
    "Element ids must be short, human-readable, and unique (e.g. 'load_balancer', 'redis_cache').",
    "Only reference element ids that already exist on the canvas (see current state below) or that you are creating in this same turn.",
    "The canvas summary below includes `extent` (bounding box of existing content), `clusters` (groups of already-connected elements with their labels and bbox), and `suggestedFreeRegion` (an empty area recommended for new content). If the user is asking for something new and unrelated to what's already there, use a distinct `group` so it lays out away from existing clusters rather than tangled into them.",
    "After your tool calls execute, the app automatically checks the result for overlapping or malformed geometry. If it finds something it couldn't fix on its own, you'll receive a short follow-up message describing the problem — call the necessary tools to correct it, then stop.",
    ...shared,
  ].join("\n");
}

export async function POST(req: Request) {
  const body = (await req.json()) as ChatRequestBody;
  const { apiKey, model, messages, canvasSummary, mode } = body;
  const effectiveMode: ChatMode = mode === "plan" ? "plan" : "build";

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing API key" }), { status: 401 });
  }
  if (!model) {
    return new Response(JSON.stringify({ error: "Missing model" }), { status: 400 });
  }

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": req.headers.get("origin") ?? "https://excalichat.app",
      "X-Title": "ExcaliChat",
    },
    body: JSON.stringify({
      model,
      stream: true,
      tools: effectiveMode === "build" ? TOOL_SCHEMA : PLAN_TOOL_SCHEMA,
      tool_choice: "auto",
      messages: [
        { role: "system", content: systemPrompt(canvasSummary, effectiveMode) },
        ...messages,
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => upstream.statusText);
    return new Response(JSON.stringify({ error: errText }), { status: upstream.status || 502 });
  }

  // Stateless streaming passthrough: no logging, no storage, key never persisted.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
