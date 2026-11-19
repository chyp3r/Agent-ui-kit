import type { AgentAdapter, AskRequest, Decoder } from "../protocol/stream";
import { LineDecoder, streamRun } from "../protocol/stream";
import { isAgentEvent, type AgentEvent } from "../protocol/events";
import { httpExtras, resolveHeaders, type HttpOptions } from "./http";

/** Decodes one JSON event per line (an optional `data:` prefix is tolerated). */
export function ndjsonDecoder(map?: (raw: Record<string, unknown>) => AgentEvent | AgentEvent[] | null): Decoder {
  const lines = new LineDecoder();
  return {
    push(chunk, final) {
      const events: AgentEvent[] = [];
      for (const line of lines.push(chunk, final)) {
        const text = (line.startsWith("data:") ? line.slice(5) : line).trim();
        if (!text) continue;
        let payload: unknown;
        try {
          payload = JSON.parse(text);
        } catch {
          continue; // one bad line must not cost the reader the answer behind it
        }
        if (payload === null || typeof payload !== "object" || Array.isArray(payload)) continue;
        const mapped = map ? map(payload as Record<string, unknown>) : isAgentEvent(payload) ? payload : null;
        if (Array.isArray(mapped)) events.push(...mapped);
        else if (mapped) events.push(mapped);
      }
      return events;
    },
  };
}

export interface NdjsonAdapterOptions extends HttpOptions {
  /** POST target for a run. Default "/run". */
  runPath?: string;
  healthPath?: string;
  /** Default "/approvals/:id" is not assumed: set it to enable approval buttons. */
  approvalPath?: (id: string) => string;
  /** The request body. Default: { prompt, history, ...options }. */
  buildBody?: (request: AskRequest) => unknown;
  /** Translate a backend's own lines into kit events (a legacy stream). */
  mapLine?: (raw: Record<string, unknown>) => AgentEvent | AgentEvent[] | null;
}

/** The kit's native protocol, or any NDJSON stream you can map line by line. */
export function createNdjsonAdapter(options: NdjsonAdapterOptions): AgentAdapter {
  return {
    async ask(request) {
      const body = options.buildBody
        ? options.buildBody(request)
        : { prompt: request.prompt, history: request.history, ...(request.options ?? {}) };
      return streamRun({
        url: `${options.baseUrl}${options.runPath ?? "/run"}`,
        init: {
          method: "POST",
          body: JSON.stringify(body),
          headers: {
            Accept: "application/x-ndjson",
            "Content-Type": "application/json",
            ...(await resolveHeaders(options.headers)),
          },
        },
        decoder: ndjsonDecoder(options.mapLine),
        onEvent: request.onEvent,
        signal: request.signal,
        retry: options.retry,
        fetchImpl: options.fetchImpl,
      });
    },
    ...httpExtras(options, { health: options.healthPath, approval: options.approvalPath }),
  };
}
