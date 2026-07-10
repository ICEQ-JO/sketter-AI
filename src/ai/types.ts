import type { Canvas } from '../canvas/types.ts';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

export interface ToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
  [key: string]: unknown;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolParameter;
  };
}

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMResponse {
  content?: string;
  toolCalls?: ToolCall[];
}

export interface LLMProvider {
  id: string;
  name: string;
  isLocal: boolean;
  init(progress?: (p: number) => void): Promise<void>;
  chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<LLMResponse>;
}

export interface ToolContext {
  canvas: Canvas;
  reply: (text: string) => void;
}

export interface ToolResult {
  canvas: Canvas;
  output: string;
}

export type ToolHandler = (ctx: ToolContext, args: Record<string, unknown>) => ToolResult | Promise<ToolResult>;
