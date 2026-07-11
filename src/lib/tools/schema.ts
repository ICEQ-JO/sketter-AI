// The fixed action schema the model speaks. Keep this flat and small —
// per the PRD, this is the single most important design decision in the project.
// The model never emits raw Excalidraw JSON, only calls from this list.

export const TOOL_SCHEMA = [
  {
    type: "function",
    function: {
      name: "add_node",
      description:
        "Add a node that participates in the diagram's connected graph — anything you'll later connect to other elements via `connect`. Do not specify a position: layout is computed automatically once your tool calls finish, arranging nodes by their connections and group. Use add_freeform instead for standalone content not part of the graph.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Short, human-readable, unique id, e.g. 'backend'.",
          },
          type: {
            type: "string",
            enum: ["rectangle", "ellipse", "diamond", "text"],
          },
          text: {
            type: "string",
            description: "Optional label inside/near the shape.",
          },
          group: {
            type: "string",
            description:
              "Optional cluster name, e.g. 'frontend', 'backend'. Nodes sharing a group are laid out near each other.",
          },
          width: { type: "number", description: "Only if you need a non-default size." },
          height: { type: "number", description: "Only if you need a non-default size." },
          strokeColor: { type: "string" },
          backgroundColor: { type: "string" },
        },
        required: ["id", "type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_freeform",
      description:
        "Place a standalone element at an explicit position — for annotations, titles, or notes that are NOT part of the connected node/edge graph. If this should connect to or cluster with other elements, use add_node instead.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Short, human-readable, unique id, e.g. 'note_1'.",
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
      description:
        "Draw an arrow between two existing elements by id. Arrows between add_node elements participate in the graph and influence automatic layout.",
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
      description: "Change properties of an existing element, including its shape type.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          type: {
            type: "string",
            enum: ["rectangle", "ellipse", "diamond", "text"],
            description: "Change the element's shape, e.g. turn a rectangle into a circle/ellipse.",
          },
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

// Tools available in PLAN mode. The model can't touch the canvas here — it
// can only ask clarifying questions or propose a plan for the user to
// approve, mirroring a Claude-Code-style plan/approve loop.
export const PLAN_TOOL_SCHEMA = [
  {
    type: "function",
    function: {
      name: "ask_question",
      description:
        "Ask the user a single clarifying question before proposing a plan. Prefer multiple-choice (2-5 short options) when there's a natural set of choices; omit options for a free-text question. Ask one question per call.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: {
            type: "array",
            items: { type: "string" },
            description: "2-5 short choices. Omit for a free-text question.",
          },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_plan",
      description:
        "Present the concrete plan you intend to build once you have enough information: structured nodes and edges, not prose. The user must approve it before anything is drawn — on approval it's built directly from this structure, without asking you to reinterpret it.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "One sentence describing what you'll build, shown to the user above the plan.",
          },
          nodes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                type: { type: "string", enum: ["rectangle", "ellipse", "diamond", "text"] },
                group: { type: "string", description: "Optional cluster name." },
              },
              required: ["id", "label", "type"],
            },
          },
          edges: {
            type: "array",
            items: {
              type: "object",
              properties: {
                from: { type: "string" },
                to: { type: "string" },
                label: { type: "string" },
              },
              required: ["from", "to"],
            },
          },
        },
        required: ["summary", "nodes", "edges"],
      },
    },
  },
] as const;

export type PlanToolName = (typeof PLAN_TOOL_SCHEMA)[number]["function"]["name"];
