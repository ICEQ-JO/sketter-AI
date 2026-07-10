# CanvasAI

A web-first AI canvas editor. The AI reasons in diagrams — boxes, arrows, alignments — and the engine turns those concepts into real Excalidraw drawings. Runs locally with WebLLM/Ollama, or via OpenRouter.

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## How to use

1. Select a provider:
   - **WebLLM** runs a small LLM entirely in your browser (requires WebGPU).
   - **Ollama** connects to a local Ollama server at `http://localhost:11434`.
   - **OpenRouter** connects to remote models via your OpenRouter API key.
2. For OpenRouter, paste your API key in the input that appears. It is stored in `localStorage` only.
3. Click **Init** / **Connect**.
3. Type a request like:
   - "Create a microservice architecture"
   - "Add a load balancer to the right of the API"
   - "Connect Frontend to Backend"
   - "Align all boxes to the top"
4. The AI calls Canvas SDK tools; the canvas updates live.

## Architecture

```
User prompt
    ↓
LLM (WebLLM / Ollama / OpenRouter)
    ↓
Tool calls (create_box, connect, align...)
    ↓
Canvas SDK
    ↓
Layout engine (relative placement, alignment, distribution)
    ↓
Excalidraw adapter
    ↓
@excalidraw/excalidraw renderer
```

## Project structure

```
src/
  canvas/        # Canvas SDK: elements, operations, state
  layout/        # Constraint-based placement engine
  adapters/      # Format adapters (Excalidraw first)
  ai/            # LLM providers, tools, router, context
  components/    # UI components
  App.tsx        # Main application
```

## Local providers

### WebLLM

The default model is `Phi-3-mini-4k-instruct-q4f16_1-MLC`. It downloads automatically on first use. Requires a browser with WebGPU support (Chrome 113+ on desktop usually works).

### Ollama

Make sure Ollama is running and CORS is enabled:

```bash
OLLAMA_ORIGINS=* ollama serve
```

Make sure you have a model pulled, e.g.:

```bash
ollama pull llama3.1
```

### OpenRouter

Select **OpenRouter** in the provider dropdown and paste your API key. The key is saved in the browser's `localStorage`. The default model is `openai/gpt-4o-mini`; you can change it in `src/ai/providers/openai-compatible.ts`.

To use a different OpenRouter model, replace the model string with any model ID from [openrouter.ai/docs#models](https://openrouter.ai/docs#models), e.g. `anthropic/claude-3.5-sonnet` or `deepseek/deepseek-chat`.

## Scripts

- `npm run dev` — start development server
- `npm run build` — production build
- `npm run preview` — preview production build
- `npm run lint` — TypeScript check

## Notes

- This is an MVP. The SDK, adapter, layout engine, and AI router are functional but minimal.
- WebLLM performance depends heavily on your GPU. For faster inference, use Ollama.
