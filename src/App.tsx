import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types';
import type { Canvas } from './canvas/types.ts';
import { createCanvas } from './canvas/operations.ts';
import { canvasToExcalidraw, excalidrawToCanvas } from './adapters/excalidraw/index.ts';
import { runAgent } from './ai/router.ts';
import {
  createOpenRouterProvider,
  OllamaProvider,
  WebLLMProvider,
  type LLMProvider,
  type ToolCall,
} from './ai/index.ts';

type ProviderType = 'webllm' | 'ollama' | 'openrouter';

interface Message {
  role: 'user' | 'assistant' | 'system';
  text: string;
}

function createProvider(type: ProviderType, apiKey = ''): LLMProvider {
  if (type === 'ollama') return new OllamaProvider();
  if (type === 'openrouter') return createOpenRouterProvider(apiKey);
  return new WebLLMProvider();
}

export default function App() {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [canvas, setCanvas] = useState<Canvas>(() => createCanvas({ metadata: { name: 'New diagram' } }));
  const canvasRef = useRef(canvas);

  // Keep ref in sync so callbacks can read latest canvas without re-creating.
  useEffect(() => {
    canvasRef.current = canvas;
  }, [canvas]);

  const [providerType, setProviderType] = useState<ProviderType>('webllm');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('canvasai-api-key') ?? '');
  const [provider, setProvider] = useState<LLMProvider>(() => createProvider('webllm'));
  const [initialized, setInitialized] = useState(false);
  const [initProgress, setInitProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Select a provider and click Init.');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: 'Welcome to CanvasAI. Select a provider (local WebLLM/Ollama, or OpenRouter) and describe the diagram you want.' },
  ]);
  const [input, setInput] = useState('');

  const initialExcalidrawData = useMemo(
    () => canvasToExcalidraw(canvas) as unknown as React.ComponentProps<typeof Excalidraw>['initialData'],
    []
  );

  const pushCanvasToExcalidraw = useCallback((nextCanvas: Canvas) => {
    const scene = canvasToExcalidraw(nextCanvas);
    apiRef.current?.updateScene(scene as unknown as Parameters<ExcalidrawImperativeAPI['updateScene']>[0]);
  }, []);

  const handleExcalidrawAPI = useCallback((api: ExcalidrawImperativeAPI) => {
    apiRef.current = api;
  }, []);

  // Pull Excalidraw changes back into SDK when user edits.
  const handleChange = useCallback(() => {
    const elements = apiRef.current?.getSceneElements();
    if (!elements) return;
    const scene = canvasToExcalidraw(canvasRef.current);
    scene.elements = elements as unknown as typeof scene.elements;
    setCanvas(excalidrawToCanvas(scene));
  }, []);

  const handleInit = async () => {
    setLoading(true);
    setStatus(`Initializing ${provider.name}...`);
    try {
      await provider.init((p) => {
        setInitProgress(Math.round(p * 100));
        setStatus(`Loading model... ${Math.round(p * 100)}%`);
      });
      setInitialized(true);
      setStatus(`${provider.name} ready.`);
    } catch (err) {
      setStatus(`Init failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (type: ProviderType) => {
    setProviderType(type);
    const next = createProvider(type, apiKey);
    setProvider(next);
    setInitialized(false);
    setInitProgress(0);
    setStatus(`Selected ${next.name}. Click Init to load.`);
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    localStorage.setItem('canvasai-api-key', value);
    if (providerType === 'openrouter') {
      const next = createProvider('openrouter', value);
      setProvider(next);
      setInitialized(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !initialized) return;
    const userText = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setLoading(true);
    setStatus('AI is thinking...');

    // Capture any user edits from Excalidraw before sending to AI.
    const elements = apiRef.current?.getSceneElements();
    let currentCanvas = canvasRef.current;
    if (elements) {
      const scene = canvasToExcalidraw(canvasRef.current);
      scene.elements = elements as unknown as typeof scene.elements;
      currentCanvas = excalidrawToCanvas(scene);
      setCanvas(currentCanvas);
    }

    const toolLogs: string[] = [];
    try {
      const result = await runAgent(currentCanvas, userText, {
        provider,
        onProgress: (text) => setStatus(text),
        onToolCall: (call: ToolCall) => {
          toolLogs.push(`→ ${call.function.name}`);
          setStatus(`Tool: ${call.function.name}`);
        },
      });

      setCanvas(result.canvas);
      pushCanvasToExcalidraw(result.canvas);
      setMessages((prev) => [
        ...prev,
        ...(toolLogs.length ? [{ role: 'system' as const, text: toolLogs.join('\n') }] : []),
        { role: 'assistant', text: result.reply },
      ]);
      setStatus('Done.');
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `Error: ${err instanceof Error ? err.message : String(err)}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="app">
      <div className="canvas-area">
        <Excalidraw
          excalidrawAPI={handleExcalidrawAPI}
          onChange={handleChange}
          initialData={initialExcalidrawData}
        />
      </div>
      <div className="chat-panel">
        <div className="chat-header">
          <h1>CanvasAI</h1>
          <select
            className="provider-select"
            value={providerType}
            onChange={(e) => handleProviderChange(e.target.value as ProviderType)}
            disabled={loading}
          >
            <option value="webllm">WebLLM (runs in browser)</option>
            <option value="ollama">Ollama (localhost)</option>
            <option value="openrouter">OpenRouter</option>
          </select>
          {providerType === 'openrouter' && (
            <input
              type="password"
              className="provider-select"
              style={{ marginTop: 8 }}
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="OpenRouter API key"
            />
          )}
          <button className="init-button" onClick={handleInit} disabled={loading || initialized}>
            {initialized
              ? 'Ready'
              : providerType === 'webllm'
              ? 'Download / Init Model'
              : providerType === 'openrouter'
              ? 'Connect to OpenRouter'
              : 'Connect to Ollama'}
          </button>
          <div className="status">{status}</div>
          {providerType === 'webllm' && initProgress > 0 && initProgress < 100 && (
            <div className="status">Progress: {initProgress}%</div>
          )}
        </div>
        <div className="chat-messages">
          {messages.map((m, idx) => (
            <div key={idx} className={`message ${m.role}`}>
              {m.text}
            </div>
          ))}
        </div>
        <div className="chat-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={initialized ? 'Describe a diagram...' : 'Init provider and enter API key if needed'}
            disabled={!initialized || loading}
          />
          <button onClick={handleSend} disabled={!initialized || loading || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
