// The fixed action schema the model speaks. Keep this flat and small —
// per the PRD, this is the single most important design decision in the project.
// The model never emits raw Excalidraw JSON, only calls from this list.

export const TOOL_SCHEMA = [
  {
    type: "function",
    function: {
      name: "create_element",
      description: "Create a new shape or text element on the canvas.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Short, human-readable, unique id, e.g. 'backend'.",
          },
          type: {
            type: "string",
            enum: ["rectangle", "ellipse", "diamond", "text", "arrow", "line"],
          },
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number", description: "Omit for text." },
          height: { type: "number", description: "Omit for text." },
          text: {
            type: "string",
            description: "Optional label inside/near the shape.",
          },
          strokeColor: { type: "string" },
          backgroundColor: { type: "string" },
        },
        required: ["id", "type", "x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "connect",
      description: "Draw an arrow between two existing elements by id.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Element id." },
          to: { type: "string", description: "Element id." },
          label: { type: "string" },
        },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_element",
      description: "Change properties of an existing element.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          text: { type: "string" },
          strokeColor: { type: "string" },
          backgroundColor: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_relative",
      description:
        "Move an element relative to another element, letting the app compute exact coordinates. Prefer this over update_element with raw x/y when the user describes a relationship.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          relative_to: { type: "string", description: "Element id." },
          position: { type: "string", enum: ["above", "below", "left", "right"] },
          gap: { type: "number", description: "Optional, default 40px." },
        },
        required: ["id", "relative_to", "position"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_element",
      description: "Delete an existing element.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "group",
      description: "Group a set of elements so they move together.",
      parameters: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" } },
        },
        required: ["ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "align",
      description: "Align a set of elements along an axis.",
      parameters: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" } },
          axis: { type: "string", enum: ["horizontal", "vertical"] },
        },
        required: ["ids", "axis"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "import_mermaid",
      description: "Render a Mermaid diagram definition directly onto the canvas.",
      parameters: {
        type: "object",
        properties: {
          definition: { type: "string", description: "Mermaid syntax." },
        },
        required: ["definition"],
      },
    },
  },
] as const;

export type ToolName = (typeof TOOL_SCHEMA)[number]["function"]["name"];

export interface ToolCall {
  id: string;
  name: ToolName;
  arguments: Record<string, unknown>;
}
