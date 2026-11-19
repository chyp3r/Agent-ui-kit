import { describe, expect, it } from "vitest";

import { createNdjsonAdapter, ndjsonDecoder } from "../adapters/ndjson";
import { sseDecoder } from "../adapters/sse";
import { openAiDecoder, createOpenAiAdapter } from "../adapters/openai";
import { langGraphDecoder } from "../adapters/langgraph";
import type { AgentEvent } from "./events";
import { LineDecoder, SseDecoder, StreamError } from "./stream";

function streamOf(chunks: (string | Uint8Array)[], status = 200): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
        controller.close();
      },
    }),
    { status },
  );
}

const line = (event: AgentEvent) => `${JSON.stringify(event)}\n`;

describe("decoders", () => {
  it("LineDecoder keeps the tail of a cut line for the next chunk", () => {
    const decoder = new LineDecoder();
    expect(decoder.push('{"a":1}\n{"b"')).toEqual(['{"a":1}']);
    expect(decoder.push(':2}\n')).toEqual(['{"b":2}']);
    expect(decoder.push("tail", true)).toEqual(["tail"]);
  });

  it("SseDecoder frames on blank lines and skips comments", () => {
    const decoder = new SseDecoder();
    expect(decoder.push(": ping\n\nevent: x\ndata: 1\ndata: 2\n\ndata: ")).toEqual([{ event: "x", data: "1\n2" }]);
    expect(decoder.push("3\n\n")).toEqual([{ event: null, data: "3" }]);
  });

  it("ndjsonDecoder skips bad lines and unknown types", () => {
    const decoder = ndjsonDecoder();
    const events = decoder.push('garbage\n{"type":"mystery"}\n{"type":"text.delta","text":"hi"}\n[1]\n', false);
    expect(events).toEqual([{ type: "text.delta", text: "hi" }]);
  });

  it("sseDecoder takes the event name as the type when the data has none", () => {
    const events = sseDecoder().push('event: text.delta\ndata: {"text":"x"}\n\n', false);
    expect(events).toEqual([{ type: "text.delta", text: "x" }]);
  });

  it("openAiDecoder turns chat.completions chunks into a step, text, reasoning and a final", () => {
    const decoder = openAiDecoder();
    const sse = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`;
    const events = [
      ...decoder.push(sse({ choices: [{ delta: { reasoning_content: "hm" } }] })),
      ...decoder.push(sse({ choices: [{ delta: { content: "Hel" } }] })),
      ...decoder.push(sse({ choices: [{ delta: { content: "lo" }, finish_reason: "stop" }] })),
      ...decoder.push("data: [DONE]\n\n", true),
    ];
    expect(events.map((event) => event.type)).toEqual([
      "run.start",
      "step.start",
      "reasoning.delta",
      "text.delta",
      "text.delta",
      "step.end",
      "final",
    ]);
    expect(events.at(-1)).toMatchObject({ type: "final", text: "Hello" });
  });

  it("langGraphDecoder maps updates to steps and ends with the last assistant message", () => {
    const decoder = langGraphDecoder();
    const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const events = [
      ...decoder.push(frame("updates", { agent: { messages: [{ type: "ai", content: "answer" }] } })),
      ...decoder.push(frame("end", null), true),
    ];
    expect(events.map((event) => event.type)).toEqual(["run.start", "step.start", "step.end", "text.delta", "final"]);
    expect(events.at(-1)).toMatchObject({ type: "final", text: "answer" });
  });
});

describe("createNdjsonAdapter", () => {
  it("delivers events as they are decoded and resolves with the final one, across cut chunks and a split multi-byte character", async () => {
    const bytes = new TextEncoder().encode(line({ type: "text.delta", text: "çay" }));
    const cut = bytes.indexOf(0xc3) + 1; // inside "ç"
    const fetchImpl = (async () =>
      streamOf([bytes.slice(0, cut), bytes.slice(cut), line({ type: "final", text: "çay" })])) as typeof fetch;
    const seen: AgentEvent[] = [];
    const adapter = createNdjsonAdapter({ baseUrl: "http://x", fetchImpl, retry: false });
    const final = await adapter.ask({ prompt: "q", history: [], onEvent: (event) => seen.push(event) });
    expect(final.text).toBe("çay");
    expect(seen[0]).toEqual({ type: "text.delta", text: "çay" });
  });

  it("raises a StreamError that knows whether anything arrived", async () => {
    const early = createNdjsonAdapter({
      baseUrl: "http://x",
      retry: false,
      fetchImpl: (async () => streamOf([line({ type: "text.delta", text: "a" })])) as typeof fetch,
    });
    await expect(early.ask({ prompt: "q", history: [], onEvent: () => undefined })).rejects.toMatchObject({
      name: "StreamError",
      receivedEvent: true,
    });
    const none = createNdjsonAdapter({
      baseUrl: "http://x",
      retry: false,
      fetchImpl: (async () => streamOf([])) as typeof fetch,
    });
    await expect(none.ask({ prompt: "q", history: [], onEvent: () => undefined })).rejects.toMatchObject({ receivedEvent: false });
  });

  it("turns an error event into a StreamError with the backend's message", async () => {
    const adapter = createNdjsonAdapter({
      baseUrl: "http://x",
      retry: false,
      fetchImpl: (async () => streamOf([line({ type: "error", message: "boom", status: 502 })])) as typeof fetch,
    });
    await expect(adapter.ask({ prompt: "q", history: [], onEvent: () => undefined })).rejects.toMatchObject({
      detail: "boom",
      status: 502,
    });
  });

  it("retries a connection that failed before anything arrived, but not twice past the policy", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls < 3) return new Response("{}", { status: 503 });
      return streamOf([line({ type: "final", text: "ok" })]);
    }) as typeof fetch;
    const adapter = createNdjsonAdapter({ baseUrl: "http://x", fetchImpl, retry: { attempts: 2, baseMs: 1 } });
    expect((await adapter.ask({ prompt: "q", history: [], onEvent: () => undefined })).text).toBe("ok");
    expect(calls).toBe(3);
  });

  it("rethrows an abort as AbortError, not as a failure", async () => {
    const controller = new AbortController();
    const fetchImpl = (async (_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        const abort = () => reject(new DOMException("Aborted", "AbortError"));
        if (init?.signal?.aborted) abort();
        init?.signal?.addEventListener("abort", abort);
      })) as unknown as typeof fetch;
    const adapter = createNdjsonAdapter({ baseUrl: "http://x", fetchImpl, retry: false });
    const pending = adapter.ask({ prompt: "q", history: [], onEvent: () => undefined, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await expect(pending).rejects.not.toBeInstanceOf(StreamError);
  });

  it("sends the question, the history and the auth header", async () => {
    let seen: { body?: string; headers?: Record<string, string> } = {};
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      seen = { body: init?.body as string, headers: init?.headers as Record<string, string> };
      return streamOf([line({ type: "final", text: "" })]);
    }) as unknown as typeof fetch;
    const adapter = createNdjsonAdapter({ baseUrl: "http://x", fetchImpl, headers: () => ({ Authorization: "Bearer t" }) });
    await adapter.ask({ prompt: "hello", history: [{ role: "user", content: "a" }], onEvent: () => undefined });
    expect(JSON.parse(seen.body!)).toMatchObject({ prompt: "hello", history: [{ role: "user", content: "a" }] });
    expect(seen.headers?.Authorization).toBe("Bearer t");
  });
});

describe("createOpenAiAdapter", () => {
  it("posts messages with stream:true and resolves with the text", async () => {
    let body: { messages: unknown[]; stream: boolean; model: string } | null = null;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      body = JSON.parse(init?.body as string);
      return streamOf(['data: {"choices":[{"delta":{"content":"hi"},"finish_reason":"stop"}]}\n\n', "data: [DONE]\n\n"]);
    }) as unknown as typeof fetch;
    const adapter = createOpenAiAdapter({ baseUrl: "http://x", model: "m", fetchImpl, systemPrompt: "be brief" });
    const final = await adapter.ask({ prompt: "q", history: [], onEvent: () => undefined });
    expect(final.text).toBe("hi");
    expect(body).toMatchObject({ model: "m", stream: true });
    expect((body as unknown as { messages: { role: string }[] }).messages.map((m) => m.role)).toEqual(["system", "user"]);
  });
});
