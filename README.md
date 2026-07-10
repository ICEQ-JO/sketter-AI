# ExcaliChat

Chat with any AI model to draw and iterate on [Excalidraw](https://excalidraw.com) diagrams — no login, no backend, bring your own [OpenRouter](https://openrouter.ai) API key.

## What this is

A thin, well-designed product layer on top of things that already exist:

- [`@excalidraw/excalidraw`](https://github.com/excalidraw/excalidraw) — the canvas
- [`@excalidraw/mermaid-to-excalidraw`](https://github.com/excalidraw/mermaid-to-excalidraw) — Mermaid import
- [OpenRouter](https://openrouter.ai) — one API, any model

The model never emits raw Excalidraw JSON. It calls a small, fixed set of tools (`create_element`, `connect`, `update_element`, `move_relative`, `delete_element`, `group`, `align`, `import_mermaid`) defined in [`src/lib/tools/schema.ts`](./src/lib/tools/schema.ts). A client-side executor ([`src/lib/tools/executor.ts`](./src/lib/tools/executor.ts)) sanitizes and applies each call to the live canvas immediately, so drawing happens incrementally as the model streams — not as a single frozen dump.

## Status

MVP core loop (M0–M2 of the build plan): scaffold, single-shot chat → draw, and incremental/streaming tool-call execution with a sanitization layer. Canvas-state-aware multi-turn iteration, the Mermaid import/export UI, and export buttons are not wired up yet.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), paste an [OpenRouter API key](https://openrouter.ai/keys), pick a model, and start describing a diagram.

## Privacy

- Your API key is stored **only** in your browser's `localStorage`. It is sent per-request to `/api/chat`, a stateless streaming proxy that forwards it straight to OpenRouter and logs nothing — it is never persisted server-side.
- No telemetry, no accounts, no stored diagrams.

## Architecture

```
Browser (Next.js)
  ChatPanel  <-->  ExcalidrawCanvas
       |                 |
       v                 v
   Action Executor (client, src/lib/tools + src/lib/canvas)
       |
       v
  /api/chat (stateless streaming proxy)
       |
       v
  OpenRouter API
```

See `src/lib/canvas/summary.ts` for the compact scene summary sent back to the model each turn instead of full Excalidraw JSON — this is what keeps small/cheap models reliable.

## License

MIT
