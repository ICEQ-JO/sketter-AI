import { TOOL_SCHEMA } from "@/lib/tools/schema";
import type { CanvasSummary } from "@/lib/canvas/summary";

export const runtime = "edge";

interface ChatRequestBody {
  apiKey: string;
  model: string;
  messages: { role: "user" | "assistant"; content: string }[];
  canvasSummary: CanvasSummary;
}

function systemPrompt(canvasSummary: CanvasSummary): string {
  return [
    "You are a diagramming assistant that draws and edits an Excalidraw canvas by calling tools.",
    "You never emit raw Excalidraw JSON — only call the provided tools.",
    "Create diagrams incrementally: call create_element for each shape, then connect for arrows between them.",
    "Prefer move_relative over update_element with raw coordinates when the user describes a relationship (e.g. 'above', 'next to').",
    "Element ids must be short, human-readable, and unique (e.g. 'load_balancer', 'redis_cache').",
    "Only reference element ids that already exist on the canvas (see current state below) or that you are creating in this same turn.",
    "Current canvas state (compact summary, not full Excalidraw JSON):",
    JSON.stringify(canvasSummary),
  ].join("\n");
}

export async function POST(req: Request) {
  const body = (await req.json()) as ChatRequestBody;
  const { apiKey, model, messages, canvasSummary } = body;

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
      tools: TOOL_SCHEMA,
      tool_choice: "auto",
      messages: [{ role: "system", content: systemPrompt(canvasSummary) }, ...messages],
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
