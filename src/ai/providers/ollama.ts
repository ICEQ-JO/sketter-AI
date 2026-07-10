import type { ChatMessage, LLMProvider, LLMResponse, ToolDefinition, ToolCall } from '../types.ts';

export interface OllamaConfig {
  baseUrl: string;
  model: string;
}

export class OllamaProvider implements LLMProvider {
  id = 'ollama';
  name = 'Ollama (localhost)';
  isLocal = true;
  private config: OllamaConfig;

  constructor(config: Partial<OllamaConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? 'http://localhost:11434',
      model: config.model ?? 'llama3.1',
    };
  }

  async init(): Promise<void> {
    // Verify Ollama is reachable.
    const res = await fetch(`${this.config.baseUrl}/api/tags`);
    if (!res.ok) {
      throw new Error(`Ollama not available at ${this.config.baseUrl}`);
    }
  }

  async chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<LLMResponse> {
    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        tools: tools.map((t) => ({
          type: 'function',
          function: {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          },
        })),
        stream: false,
        options: {
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama chat failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      message?: {
        content?: string;
        tool_calls?: Array<{
          function: { name: string; arguments: Record<string, unknown> | string };
        }>;
      };
    };

    const message = data.message;
    const toolCalls: ToolCall[] =
      message?.tool_calls?.map((tc, idx) => ({
        id: `call_${idx}`,
        function: {
          name: tc.function.name,
          arguments:
            typeof tc.function.arguments === 'string'
              ? tc.function.arguments
              : JSON.stringify(tc.function.arguments),
        },
      })) ?? [];

    return {
      content: message?.content ?? undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}
