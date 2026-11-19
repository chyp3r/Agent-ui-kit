import type { AgentAdapter, Decoder } from "../protocol/stream";
import { SseDecoder, streamRun } from "../protocol/stream";
import type { AgentEvent } from "../protocol/events";
import { resolveHeaders, type HttpOptions } from "./http";

interface Delta {
  content?: string | null;
  reasoning_content?: string | null;
  reasoning?: string | null;
  tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[];
}

/**
 * OpenAI-compatible `chat.completions` streaming (OpenAI, vLLM, Ollama, LM Studio,
 * OpenRouter…). It has no graph of agents, so the whole answer is one step named
 * `assistant`; reasoning deltas and tool calls the model makes show up as they come.
 */
export function openAiDecoder(node = "assistant"): Decoder {
  const frames = new SseDecoder();
  let started = false;
  let finished = false;
  let text = "";
  const calls = new Map<number, { id: string; name: string; args: string }>();

  const finish = (events: AgentEvent[]) => {
    if (finished) return;
    finished = true;
    for (const [index, call] of calls) {
      let args: Record<string, unknown> | null = null;
      try {
        args = call.args ? (JSON.parse(call.args) as Record<string, unknown>) : null;
      } catch {
        args = { arguments: call.args };
      }
      events.push({ type: "tool.start", callId: call.id || `call-${index}`, tool: call.name, node, args });
      events.push({ type: "tool.end", callId: call.id || `call-${index}`, state: "done" });
    }
    if (started) events.push({ type: "step.end", node, output: undefined });
    events.push({ type: "final", text });
  };

  return {
    push(chunk, final) {
      const events: AgentEvent[] = [];
      for (const frame of frames.push(chunk, final)) {
        if (frame.data.trim() === "[DONE]") {
          finish(events);
          continue;
        }
        let payload: { choices?: { delta?: Delta; finish_reason?: string | null }[]; error?: { message?: string } };
        try {
          payload = JSON.parse(frame.data);
        } catch {
          continue;
        }
        if (payload.error) {
          events.push({ type: "error", message: payload.error.message ?? "the model failed" });
          continue;
        }
        const choice = payload.choices?.[0];
        if (!choice) continue;
        if (!started) {
          started = true;
          events.push({ type: "run.start" }, { type: "step.start", node });
        }
        const delta = choice.delta ?? {};
        const reasoning = delta.reasoning_content ?? delta.reasoning;
        if (reasoning) events.push({ type: "reasoning.delta", text: reasoning });
        if (delta.content) {
          text += delta.content;
          events.push({ type: "text.delta", text: delta.content });
        }
        for (const part of delta.tool_calls ?? []) {
          const index = part.index ?? 0;
          const call = calls.get(index) ?? { id: "", name: "", args: "" };
          if (part.id) call.id = part.id;
          if (part.function?.name) call.name = part.function.name;
          if (part.function?.arguments) call.args += part.function.arguments;
          calls.set(index, call);
        }
        if (choice.finish_reason) finish(events);
      }
      if (final) finish(events);
      return events;
    },
  };
}

export interface OpenAiAdapterOptions extends HttpOptions {
  model: string;
  /** Default "/chat/completions". */
  path?: string;
  systemPrompt?: string;
  /** Extra body fields: temperature, tools… */
  params?: Record<string, unknown>;
}

export function createOpenAiAdapter(options: OpenAiAdapterOptions): AgentAdapter {
  return {
    async ask(request) {
      const messages = [
        ...(options.systemPrompt ? [{ role: "system", content: options.systemPrompt }] : []),
        ...request.history,
        { role: "user", content: request.prompt },
      ];
      return streamRun({
        url: `${options.baseUrl}${options.path ?? "/chat/completions"}`,
        init: {
          method: "POST",
          body: JSON.stringify({ model: options.model, messages, stream: true, ...options.params, ...(request.options ?? {}) }),
          headers: {
            Accept: "text/event-stream",
            "Content-Type": "application/json",
            ...(await resolveHeaders(options.headers)),
          },
        },
        decoder: openAiDecoder(),
        onEvent: request.onEvent,
        signal: request.signal,
        retry: options.retry,
        fetchImpl: options.fetchImpl,
      });
    },
  };
}
