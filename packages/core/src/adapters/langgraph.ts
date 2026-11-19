import type { AgentAdapter, Decoder } from "../protocol/stream";
import { SseDecoder, streamRun } from "../protocol/stream";
import type { AgentEvent, StepOutput } from "../protocol/events";
import { resolveHeaders, type HttpOptions } from "./http";

type Json = Record<string, unknown>;

/** The last assistant message in a state update, if there is one. */
export function lastAssistantText(update: Json): string | undefined {
  const messages = update.messages;
  if (!Array.isArray(messages)) return undefined;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as Json | undefined;
    const kind = String(message?.type ?? message?.role ?? "");
    if ((kind === "ai" || kind === "assistant") && typeof message?.content === "string" && message.content) {
      return message.content;
    }
  }
  return undefined;
}

export interface LangGraphDecoderOptions {
  /** Turn a node's state update into a step output. Default: the raw update as `data`. */
  mapUpdate?: (node: string, update: Json) => StepOutput | undefined;
  /** Pull the answer out of an update. Default: the last assistant message. */
  extractAnswer?: (node: string, update: Json) => string | undefined;
}

/**
 * LangGraph's `updates` stream mode: one frame per node that ran, each a
 * `{ node: stateUpdate }` object. Every update becomes a finished step; the run's
 * answer is the last assistant message seen when the stream ends.
 */
export function langGraphDecoder(options: LangGraphDecoderOptions = {}): Decoder {
  const frames = new SseDecoder();
  let started = false;
  let answer = "";
  let ended = false;
  let closed = false;
  const extract = options.extractAnswer ?? ((_node, update) => lastAssistantText(update));

  return {
    push(chunk, final) {
      const events: AgentEvent[] = [];
      for (const frame of frames.push(chunk, final)) {
        const name = frame.event ?? "message";
        if (name === "error") {
          let message = "the graph failed";
          try {
            const data = JSON.parse(frame.data) as Json;
            message = String(data.message ?? data.error ?? message);
          } catch {
            message = frame.data || message;
          }
          events.push({ type: "error", message });
          continue;
        }
        if (name === "end") {
          ended = true;
          continue;
        }
        if (name !== "updates") continue;
        let data: Json;
        try {
          data = JSON.parse(frame.data) as Json;
        } catch {
          continue;
        }
        if (!started) {
          started = true;
          events.push({ type: "run.start" });
        }
        for (const [node, value] of Object.entries(data)) {
          const update = (value && typeof value === "object" ? value : {}) as Json;
          events.push({ type: "step.start", node });
          events.push({ type: "step.end", node, output: options.mapUpdate ? options.mapUpdate(node, update) : { data: update } });
          const text = extract(node, update);
          if (text) answer = text;
        }
      }
      if ((ended || final) && started && !closed) {
        closed = true;
        events.push({ type: "text.delta", text: answer }, { type: "final", text: answer });
      }
      return events;
    },
  };
}

export interface LangGraphAdapterOptions extends HttpOptions, LangGraphDecoderOptions {
  /** The streaming run endpoint, e.g. "/threads/:id/runs/stream" or "/runs/stream". */
  runPath: string;
  assistantId?: string;
  /** Build the run input from the question. Default: { messages: [...history, user] }. */
  buildInput?: (prompt: string, history: { role: string; content: string }[]) => unknown;
}

export function createLangGraphAdapter(options: LangGraphAdapterOptions): AgentAdapter {
  return {
    async ask(request) {
      const input = options.buildInput
        ? options.buildInput(request.prompt, request.history)
        : { messages: [...request.history, { role: "user", content: request.prompt }] };
      return streamRun({
        url: `${options.baseUrl}${options.runPath}`,
        init: {
          method: "POST",
          body: JSON.stringify({ assistant_id: options.assistantId, input, stream_mode: ["updates"] }),
          headers: {
            Accept: "text/event-stream",
            "Content-Type": "application/json",
            ...(await resolveHeaders(options.headers)),
          },
        },
        decoder: langGraphDecoder(options),
        onEvent: request.onEvent,
        signal: request.signal,
        retry: options.retry,
        fetchImpl: options.fetchImpl,
      });
    },
  };
}
