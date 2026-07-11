export type ChatRole =
  | "user"
  | "assistant"
  | "system-note"
  | "tool-activity"
  | "question"
  | "plan";

export interface QuestionData {
  options?: string[];
  answered?: boolean;
  answer?: string;
}

export interface PlanNode {
  id: string;
  label: string;
  type: "rectangle" | "ellipse" | "diamond" | "text";
  group?: string;
}

export interface PlanEdge {
  from: string;
  to: string;
  label?: string;
}

export interface PlanData {
  approved?: boolean;
  summary?: string;
  nodes?: PlanNode[];
  edges?: PlanEdge[];
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  question?: QuestionData;
  plan?: PlanData;
}
