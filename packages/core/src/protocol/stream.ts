import type { AgentEvent, FinalEvent, HistoryMessage } from "./events";

/** A request failed with an HTTP status outside a stream (health, sessions). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** A run failed. Tells the UI whether the flow already on screen is real up to here. */
export class StreamError extends Error {
  constructor(
    message: string,
    /** Whether anything arrived before it failed. */
    readonly receivedEvent: boolean,
    readonly status = 0,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "StreamError";
  }
}

/** Turns decoded text into events. Stateful: a chunk may end mid-line. */
export interface Decoder {
  push(chunk: string, final?: boolean): AgentEvent[];
}

export interface AskRequest {
  prompt: string;
  history: HistoryMessage[];
  onEvent: (event: AgentEvent) => void;
  signal?: AbortSignal;
  /** Passed to the adapter's body builder: a model name, a mode, a user id. */
  options?: Record<string, unknown>;
}

export type ApprovalDecision = "approved" | "rejected";

/**
 * The seam between the UI and a backend. Write one to connect anything:
 * it receives a question and a callback, calls the callback with `AgentEvent`s
 * as they happen and resolves with the final event.
 */
export interface AgentAdapter {
  ask(request: AskRequest): Promise<FinalEvent>;
  /** Answers an `approval.request`. Without it the UI hides the approval buttons. */
  respond?(id: string, decision: ApprovalDecision, signal?: AbortSignal): Promise<void>;
  /** Whether the backend can be asked anything. Without it the UI assumes yes. */
  health?(signal?: AbortSignal): Promise<{ ready: boolean; busy?: boolean }>;
}

export interface RetryPolicy {
  /** Extra tries after the first, only before any byte of the answer arrived. */
  attempts: number;
  baseMs: number;
}

const RETRYABLE = new Set([429, 502, 503, 504]);
export const DEFAULT_RETRY: RetryPolicy = { attempts: 2, baseMs: 400 };

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export interface StreamRunOptions {
  url: string;
  init: RequestInit;
  decoder: Decoder;
  onEvent: (event: AgentEvent) => void;
  signal?: AbortSignal;
  retry?: RetryPolicy | false;
  fetchImpl?: typeof fetch;
}

async function errorDetail(response: Response): Promise<string | undefined> {
  const body = (await response.json().catch(() => null)) as { detail?: unknown; message?: unknown } | null;
  const detail = body?.detail ?? body?.message;
  return typeof detail === "string" ? detail : undefined;
}

/**
 * Sends the request and feeds every decoded event to `onEvent`; resolves with the
 * `final` event. Tells a stop (rethrows `AbortError`) from a failure (`StreamError`).
 * A failed connection is retried with backoff, but only while nothing has arrived:
 * a run that already showed its work is never silently started over.
 */
export async function streamRun(options: StreamRunOptions): Promise<FinalEvent> {
  const { url, init, decoder, onEvent, signal } = options;
  const doFetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const retry = options.retry === false ? { attempts: 0, baseMs: 0 } : (options.retry ?? DEFAULT_RETRY);
  let receivedEvent = false;

  try {
    let response: Response | null = null;
    for (let attempt = 0; ; attempt += 1) {
      try {
        response = await doFetch(url, { ...init, signal });
        if (response.ok || !RETRYABLE.has(response.status) || attempt >= retry.attempts) break;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        if (attempt >= retry.attempts) throw error;
      }
      await sleep(retry.baseMs * 2 ** attempt, signal);
    }

    if (!response.ok) throw new StreamError("run request failed", false, response.status, await errorDetail(response));
    if (!response.body) throw new StreamError("run request returned no body", false, response.status);

    const reader = response.body.getReader();
    const text = new TextDecoder();
    let final: FinalEvent | null = null;
    let failure: { message: string; status?: number } | null = null;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        const events = decoder.push(done ? text.decode() : text.decode(value, { stream: true }), done);
        for (const event of events) {
          receivedEvent = true;
          onEvent(event);
          if (event.type === "final") final = event;
          else if (event.type === "error") failure = { message: event.message, status: event.status };
        }
        if (done) break;
      }
    } finally {
      reader.releaseLock();
    }

    if (failure) throw new StreamError("the agent failed", true, failure.status ?? 500, failure.message);
    if (!final) throw new StreamError("the stream closed before the answer", receivedEvent);
    return final;
  } catch (error) {
    if (error instanceof StreamError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new StreamError("run request failed", receivedEvent, 0, error instanceof Error ? error.message : String(error));
  }
}

/** Lines of text however the network cut them. The tail waits for the next chunk. */
export class LineDecoder {
  private buffer = "";
  push(chunk: string, final = false): string[] {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = final ? "" : (lines.pop() ?? "");
    return lines;
  }
}

export interface SseFrame {
  event: string | null;
  data: string;
}

/** Server-sent-event frames: fields up to a blank line. Comments and unknown fields are skipped. */
export class SseDecoder {
  private buffer = "";
  push(chunk: string, final = false): SseFrame[] {
    this.buffer += chunk;
    const parts = this.buffer.split(/\r?\n\r?\n/);
    this.buffer = final ? "" : (parts.pop() ?? "");
    const frames: SseFrame[] = [];
    for (const part of parts) {
      let event: string | null = null;
      const data: string[] = [];
      for (const line of part.split(/\r?\n/)) {
        if (line.startsWith(":")) continue;
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (data.length) frames.push({ event, data: data.join("\n") });
    }
    return frames;
  }
}
