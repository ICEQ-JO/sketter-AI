export type ChatRole = "user" | "assistant" | "system-note" | "tool-activity";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}
