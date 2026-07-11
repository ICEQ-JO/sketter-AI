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

export interface PlanData {
  approved?: boolean;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  question?: QuestionData;
  plan?: PlanData;
}
