import type { AgentAdapter, AskRequest, Decoder } from "../protocol/stream";
import { SseDecoder, streamRun } from "../protocol/stream";
import { isAgentEvent, type AgentEvent } from "../protocol/events";
import { httpExtras, resolveHeaders, type HttpOptions } from "./http";

/**
 * Server-sent events whose `data` is a kit event (JSON). A frame's `event:` name,
 * when it is a kit event type and the data has no `type`, supplies it.
 */
export function sseDecoder(map?: (frame: { event: string | null; data: unknown }) => AgentEvent | AgentEvent[] | null): Decoder {
  const frames = new SseDecoder();
  return {
    push(chunk, final) {
      const events: AgentEvent[] = [];
      for (const frame of frames.push(chunk, final)) {
        let data: unknown;
        try {
          data = JSON.parse(frame.data);
        } catch {
          continue;
        }
        let mapped: AgentEvent | AgentEvent[] | null;
        if (map) mapped = map({ event: frame.event, data });
        else if (isAgentEvent(data)) mapped = data;
        else if (frame.event && data && typeof data === "object" && !Array.isArray(data)) {
          const candidate = { type: frame.event, ...(data as object) };
          mapped = isAgentEvent(candidate) ? candidate : null;
        } else mapped = null;
        if (Array.isArray(mapped)) events.push(...mapped);
        else if (mapped) events.push(mapped);
      }
      return events;
    },
  };
}

export interface SseAdapterOptions extends HttpOptions {
  runPath?: string;
  healthPath?: string;
  approvalPath?: (id: string) => string;
  buildBody?: (request: AskRequest) => unknown;
  mapFrame?: (frame: { event: string | null; data: unknown }) => AgentEvent | AgentEvent[] | null;
}

export function createSseAdapter(options: SseAdapterOptions): AgentAdapter {
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
            Accept: "text/event-stream",
            "Content-Type": "application/json",
            ...(await resolveHeaders(options.headers)),
          },
        },
        decoder: sseDecoder(options.mapFrame),
        onEvent: request.onEvent,
        signal: request.signal,
        retry: options.retry,
        fetchImpl: options.fetchImpl,
      });
    },
    ...httpExtras(options, { health: options.healthPath, approval: options.approvalPath }),
  };
}
