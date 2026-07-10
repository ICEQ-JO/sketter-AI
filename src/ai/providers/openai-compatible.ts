import type { ChatMessage, LLMProvider, LLMResponse, ToolCall, ToolDefinition } from '../types.ts';

export interface OpenAICompatibleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export class OpenAICompatibleProvider implements LLMProvider {
  id = 'openai-compatible';
  name: string;
  isLocal = false;
  private config: OpenAICompatibleConfig;

  constructor(config: Partial<OpenAICompatibleConfig> & { name?: string } = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? 'https://api.openai.com/v1',
      apiKey: config.apiKey ?? '',
      model: config.model ?? 'gpt-4o-mini',
    };
    this.name = config.name ?? 'OpenAI-compatible';
  }

  async init(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('API key is required');
    }
  }

  async chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<LLMResponse> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
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
        tool_choice: 'auto',
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    };

    const message = data.choices?.[0]?.message;
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

export function createOpenRouterProvider(apiKey: string, model = 'openai/gpt-4o-mini'): LLMProvider {
  return new OpenAICompatibleProvider({
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey,
    model,
  });
}
