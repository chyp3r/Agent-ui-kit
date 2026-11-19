# Adapters

```ts
interface AgentAdapter {
  ask(request: { prompt; history; onEvent; signal?; options? }): Promise<FinalEvent>;
  respond?(id: string, decision: "approved" | "rejected", signal?): Promise<void>; // approvals
  health?(signal?): Promise<{ ready: boolean; busy?: boolean }>;                   // locks the composer while busy
}
```

| Adapter | Backend | Notes |
|---|---|---|
| `createNdjsonAdapter` | Emits kit events, one JSON per line | `mapLine` translates a legacy stream; `buildBody` changes the request |
| `createSseAdapter` | Emits kit events as server-sent events | `mapFrame` for your own frames |
| `createOpenAiAdapter` | OpenAI-compatible `chat/completions` (OpenAI, vLLM, Ollama, LM Studio, OpenRouter) | One `assistant` step; `reasoning_content` and tool calls show up |
| `createLangGraphAdapter` | LangGraph `updates` stream mode | Each update is a finished step; `mapUpdate` / `extractAnswer` shape it. Based on the documented stream shape; check it against your server |

All HTTP adapters take `baseUrl`, `headers` (an object or a function, for tokens), and `retry`
(`{ attempts, baseMs }`, applied only while nothing has arrived: a run that already showed its work is never
silently restarted).

## Writing your own

```ts
const adapter: AgentAdapter = {
  async ask({ prompt, onEvent, signal }) {
    const socket = await openMySocket(prompt, signal);
    for await (const message of socket) {
      onEvent(toKitEvent(message));            // step.start, tool.end, text.delta …
      if (message.done) return { type: "final", text: message.answer, meta: { verified: true } };
    }
    throw new StreamError("closed before the answer", true);
  },
};
```

Throw `StreamError(message, receivedEvent, status?, detail?)` for failures and let `AbortError` through for a
stop, so the screen can tell the two apart. Any decoder can be reused through `streamRun({ decoder })`.

## Mapping a legacy stream

```ts
createNdjsonAdapter({
  baseUrl: "/api", runPath: "/chat/ask",
  mapLine: (raw) =>
    raw.type === "stepper"
      ? { type: raw.status === "node_active" ? "step.start" : "step.end", node: raw.node, details: raw.details }
      : raw.type === "content" ? { type: "text.delta", text: raw.content }
      : raw.type === "final"   ? { type: "final", text: raw.content, meta: { verified: raw.metadata?.is_verified } }
      : null,
});
```
