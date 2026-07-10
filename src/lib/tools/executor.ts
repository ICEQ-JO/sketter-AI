import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { SceneStore } from "../canvas/sceneStore";
import { sanitizeToolCall } from "./sanitize";
import type { ToolName } from "./schema";

export interface ExecutionResult {
  name: ToolName;
  ok: boolean;
  reason?: string;
}

/**
 * Applies a single tool call to the live canvas, immediately (not batched)
 * so drawing appears incremental as calls stream in.
 */
export async function executeToolCall(
  api: ExcalidrawImperativeAPI,
  store: SceneStore,
  name: ToolName,
  rawArgs: Record<string, unknown>,
): Promise<ExecutionResult> {
  const sanitized = sanitizeToolCall({ name, arguments: rawArgs }, store.validIds());
  if (!sanitized.ok) {
    console.warn(`[executor] rejected ${name}:`, sanitized.reason);
    return { name, ok: false, reason: sanitized.reason };
  }

  switch (sanitized.name) {
    case "create_element":
      store.createElement(api, sanitized.args);
      break;
    case "connect":
      store.connect(api, sanitized.args);
      break;
    case "update_element":
      store.updateElement(api, sanitized.args);
      break;
    case "move_relative":
      store.moveRelative(api, sanitized.args);
      break;
    case "delete_element":
      store.deleteElement(api, sanitized.args);
      break;
    case "group":
      store.group(api, sanitized.args);
      break;
    case "align":
      store.align(api, sanitized.args);
      break;
    case "import_mermaid":
      await store.importMermaid(api, sanitized.args);
      break;
  }

  return { name, ok: true };
}
