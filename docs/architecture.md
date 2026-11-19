# Architecture

```
your backend ──(stream)──▶ adapter ──▶ AgentEvent ──▶ foldFlow ──▶ Flow ──▶ components
                              ▲                          (pure)
                  createNdjsonAdapter / Sse / OpenAi / LangGraph / your own
```

## Core (`@agent-kit/core`, no React)

| Module | Job |
|---|---|
| `protocol/events.ts` | The event vocabulary: `run.start`, `step.start/end`, `tool.start/end`, `text.delta`, `reasoning.delta`, `approval.request/resolved`, `final`, `error` |
| `protocol/stream.ts` | `streamRun`: fetch, abort, retry before anything arrived, line/SSE decoders, `StreamError` (knows whether the flow on screen is real) |
| `adapters/*` | A backend's wire format → events. `AgentAdapter = { ask, respond?, health? }` |
| `flow/fold.ts` | Events → `Flow` (visits, tool calls, plan, handoffs, replans, approvals, phase). Pure and DOM-free, so it is tested with plain event arrays |
| `registry/kit.ts` | `defineAgentKit`: names, tools, categories, transitions, entry/ending nodes, answer rules |
| `session/*` | `Turn`, `SessionStore` (memory, IndexedDB, HTTP), stored messages |
| `answer/parse.ts` | Answer text → blocks (markdown, records, chart, code, your own). Only the last block re-renders while streaming |
| `workspace/workspace.ts` | The side panel's state machine, as pure functions |
| `i18n/*` | `tr` (default) and `en`, typed so the key sets cannot drift |

## React (`@agent-kit/react`)

- `useAgentChat` owns the conversation: sessions, turns, the run in flight, errors, approvals, the panel.
  `<AgentApp>` is one way to draw it; copy it to draw another.
- `AgentKitProvider` gives every component the kit, the locale, `t()` and the renderers. Without a provider
  components fall back to the demo kit in Turkish, so one can be used alone.
- `renderers/` maps an answer block `kind` or a tool `outputKind` to a component.
- `styles/` is plain CSS over tokens; Tailwind supplies only the responsive utility classes.

## Why a node that runs twice is two visits

The reviewer sending a question back to the planner is the most interesting thing a graph does. Folding both
passes into one row would hide it, so `Visit` is per pass, a `Handoff` back to the entry node is a `replan`,
and the map draws the second pass below the first.

## Why tool calls are inferred when the backend sends no tool events

A backend that only reports steps still gets a useful map: while a node is active its `mainTool` (from the
kit) shows as running, and `step.end`'s `output.calls` replaces the guess. Send `tool.start/tool.end` to show
the real thing.
