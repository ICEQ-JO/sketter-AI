import * as webllm from '@mlc-ai/web-llm';
import type { ChatMessage, LLMProvider, LLMResponse, ToolDefinition, ToolCall } from '../types.ts';

const DEFAULT_MODEL = 'Phi-3-mini-4k-instruct-q4f16_1-MLC';

export class WebLLMProvider implements LLMProvider {
  id = 'webllm';
  name = 'WebLLM (local)';
  isLocal = true;
  private engine: webllm.MLCEngine | null = null;
  private model: string;

  constructor(model: string = DEFAULT_MODEL) {
    this.model = model;
  }

  async init(progress?: (p: number) => void): Promise<void> {
    this.engine = await webllm.CreateMLCEngine(this.model, {
      initProgressCallback: (report) => {
        progress?.(report.progress);
      },
    });
  }

  async chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<LLMResponse> {
    if (!this.engine) {
      throw new Error('WebLLM engine not initialized');
    }

    const openAITools = tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    }));

    const response = await this.engine.chat.completions.create({
      messages: messages as webllm.ChatCompletionMessageParam[],
      tools: openAITools,
      tool_choice: 'auto',
      temperature: 0.2,
    });

    const choice = response.choices[0];
    const message = choice?.message;

    const toolCalls: ToolCall[] =
      message?.tool_calls?.map((tc) => ({
        id: tc.id,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })) ?? [];

    return {
      content: message?.content ?? undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}
