import type { Canvas } from '../canvas/types.ts';
import { buildSpatialMemory, buildSystemPrompt } from './context.ts';
import { executeTool, getToolDefinitions } from './tools.ts';
import type { ChatMessage, LLMProvider, ToolCall } from './types.ts';

export interface RouterOptions {
  provider: LLMProvider;
  onProgress?: (text: string) => void;
  onToolCall?: (call: ToolCall) => void;
}

export interface RouterResult {
  canvas: Canvas;
  reply: string;
}

export async function runAgent(
  canvas: Canvas,
  userMessage: string,
  options: RouterOptions
): Promise<RouterResult> {
  const { provider, onProgress, onToolCall } = options;

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    {
      role: 'system',
      content: `Current canvas state:\n${buildSpatialMemory(canvas)}`,
    },
    { role: 'user', content: userMessage },
  ];

  let currentCanvas = canvas;
  let replyParts: string[] = [];
  const maxTurns = 5;

  for (let turn = 0; turn < maxTurns; turn++) {
    onProgress?.(`Thinking... (turn ${turn + 1}/${maxTurns})`);
    const response = await provider.chat(messages, getToolDefinitions());

    if (response.content) {
      replyParts.push(response.content);
      messages.push({ role: 'assistant', content: response.content });
    }

    if (!response.toolCalls || response.toolCalls.length === 0) {
      break;
    }

    for (const call of response.toolCalls) {
      onToolCall?.(call);
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments);
      } catch {
        replyParts.push(`Failed to parse arguments for ${call.function.name}`);
        continue;
      }

      const result = await executeTool(call.function.name, args, {
        canvas: currentCanvas,
        reply: (text) => replyParts.push(text),
      });

      currentCanvas = result.canvas;
      messages.push({
        role: 'tool',
        content: result.output,
        tool_call_id: call.id,
        name: call.function.name,
      });
    }

    // Refresh canvas context for next turn.
    messages[1] = {
      role: 'system',
      content: `Current canvas state:\n${buildSpatialMemory(currentCanvas)}`,
    };
  }

  return {
    canvas: currentCanvas,
    reply: replyParts.join('\n\n') || 'Done.',
  };
}
