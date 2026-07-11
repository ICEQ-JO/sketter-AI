# Changelog

Notable changes to the AI harness and diagramming logic. Newest first.

## 2026-07-12 — Agentic build loop, arrow routing, and plan-refinement fixes

### 1. Real agentic loop for BUILD mode

Previously, a build turn was a single blind batch: the model emitted tool
calls, they executed, and the model never saw the outcome. Self-correction
was faked by recursively calling `sendMessage` with a synthetic user message
("The diagram has issues you should fix...").

Now `runBuildLoop` (`src/components/ChatPanel.tsx`) drives a proper
multi-step loop, up to `MAX_AGENT_STEPS` (6) rounds:

1. Stream a turn, executing each tool call as its arguments finish streaming.
2. Run auto-layout, then `verifyAndFix` on the resulting geometry.
3. Feed the model back an `assistant` message with its `tool_calls`, a `tool`
   result for every call (`{ok:true}` or `{ok:false, reason}`), and any
   unresolved verify issues as a `user` message.
4. Loop. The model stops on its own once it emits no more tool calls (or the
   step budget runs out).

This required widening the chat message contract end-to-end:
- `src/app/api/chat/route.ts` — `ChatRequestBody.messages` now accepts
  `assistant` messages with `tool_calls` and `tool` messages with
  `tool_call_id`, alongside `user`/`assistant`.
- `src/components/ChatPanel.tsx` — `streamTurn()` was extracted as the
  single-round-trip primitive; `runBuildLoop()` is the new loop built on top
  of it. PLAN mode still uses `streamTurn()` directly as a single shot (no
  tool results to feed back).

### 2. Canvas spatial-awareness upgrade

- `src/lib/canvas/summary.ts` — `CanvasSummary` gained a `spatialNote`
  field: a one-line natural-language read of the scene ("2 connected
  clusters (auth, api) and 1 unconnected element... open space is to the
  right around (x, y)..."). Small/cheap models orient off prose far more
  reliably than off a raw coordinate list.
- `src/app/api/chat/route.ts` — the system prompt was restructured from a
  flat wall of sentences into an explicit `CANVAS_AWARENESS` contract
  (how to read `elements`/`connections`/`extent`/`clusters`/
  `suggestedFreeRegion`/`spatialNote`) plus a numbered operating loop and
  tool-selection guide for BUILD mode, and a numbered procedure for PLAN
  mode.

### 3. "Keep refining" ignored the instruction to ask a question

**Symptom:** clicking "keep refining" on a proposed plan sometimes just
re-proposed a near-identical plan instead of asking a clarifying question,
even though the system prompt explicitly says not to.

**Root cause:** the model was trusted to follow a prose instruction
("you MUST ask a clarifying question... do NOT call propose_plan again").
Small/fast models don't reliably obey "don't call X" when X is still an
available tool.

**Fix:** `handleRefinePlan` now sends the request with `forceTool:
"ask_question"`. The server (`src/app/api/chat/route.ts`) turns this into
`tool_choice: {type:"function", function:{name:"ask_question"}}` instead of
`"auto"` for that one turn, making it structurally impossible for the model
to call `propose_plan` instead.

### 4. Arrows drawn straight through unrelated boxes

**Symptom:** in multi-step diagrams, an arrow connecting into an existing
subgraph could be rendered as a straight line cutting directly through an
unrelated box placed in an earlier turn.

**Root cause:** `SceneStore.runAutoLayout` (`src/lib/canvas/sceneStore.ts`)
only feeds *newly added* nodes into dagre for layout. Already-placed
elements from earlier turns are invisible to that pass, so dagre's
rank-crossing routing (which only avoids nodes it knows about) has no way
to route around them. `verify.ts` also had no check at all for "does this
arrow's line cross a box" — only box-vs-box overlap, dangling arrows, and
out-of-bounds elements were checked.

**Fix:**
- `src/lib/canvas/verify.ts` — new `arrow_crosses_element` check: for every
  arrow, test each rendered segment against every other live element's
  bounding box (with a small margin). If AI-owned, compute a two-point
  "step" detour around the obstruction (`computeDetourWaypoints`) and
  reroute it; otherwise report unresolved (foreign arrows aren't mutated).
- `src/lib/canvas/sceneStore.ts` — new `setArrowRoute()` method to apply the
  detour by overriding the arrow skeleton's `routingPoints`.
- `src/components/ChatPanel.tsx` — fixed the build loop skipping
  verification entirely on any step whose tool calls only included
  `connect` (no new nodes) — exactly the scenario that triggers this bug
  (wiring an arrow to something that already exists on the canvas).

### 5. No indication of where the AI just drew

**Symptom:** on a large or busy canvas, there was no way to tell where new
or changed content landed after a turn.

**Fix:** `src/components/ChatPanel.tsx` — every successful tool call now
records the element ids it touched (`affectedIds()`); once a build finishes
(loop terminates or a plan is built), `focusOnElements()`:
- pans/zooms the camera to fit the touched elements
  (`ExcalidrawImperativeAPI.scrollToContent`), and
- briefly selects them (native Excalidraw selection highlight) for ~2.2s.

### Files touched

- `src/app/api/chat/route.ts` — message contract, `forceTool` /
  `tool_choice`, system prompt restructure.
- `src/components/ChatPanel.tsx` — `streamTurn`, `runBuildLoop`,
  `focusOnElements`, `affectedIds`, refine-plan force-tool wiring.
- `src/lib/canvas/summary.ts` — `spatialNote`.
- `src/lib/canvas/verify.ts` — `arrow_crosses_element` check, detour
  geometry helpers.
- `src/lib/canvas/sceneStore.ts` — `setArrowRoute()`.

### Known limitation

These changes were verified with `tsc --noEmit`, `eslint`, and a manual
browser boot check (no console errors, existing chat state loads, error
paths render correctly) — not a live end-to-end run through a real model,
since no API key was available in that environment. The exact "keep
refining" and multi-turn-arrow-routing scenarios reported should be
re-tested against a live model to confirm in practice.
