import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import type { AgentEvent } from "@agent-kit/core";

import { pickScenario, SCENARIOS, type Beat, type Lang } from "./scenarios.ts";

export interface MockOptions {
  port?: number;
  /** 1 plays in real time, 5 five times faster. */
  speed?: number;
  lang?: Lang;
  /** Milliseconds to wait for an approval before treating it as rejected. */
  approvalTimeoutMs?: number;
}

interface StoredSession {
  session_id: string;
  title: string;
  messages: unknown[];
  created_at: string;
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });

/**
 * A backend for the demo kit that needs no model, no database and no network.
 *
 *   POST /api/run                   NDJSON events (or SSE with `Accept: text/event-stream`)
 *   POST /api/v1/chat/completions   OpenAI-compatible stream (a single assistant step)
 *   POST /api/approvals/:id         { decision: "approved" | "rejected" }
 *   GET  /api/health                { status, ready, busy }
 *   *    /api/sessions[/:id]        in-memory sessions
 */
export function createMockServer(options: MockOptions = {}): Server {
  const speed = options.speed ?? 1;
  const lang: Lang = options.lang ?? "tr";
  const sessions = new Map<string, StoredSession>();
  const approvals = new Map<string, (decision: "approved" | "rejected") => void>();

  async function play(
    question: string,
    write: (event: AgentEvent) => void,
    cut: () => void,
    signal: AbortSignal,
  ): Promise<void> {
    const scenario = SCENARIOS[pickScenario(question)];
    const context = {
      question,
      lang,
      approval: (id: string) =>
        new Promise<"approved" | "rejected">((resolve) => {
          const timer = setTimeout(() => resolve("rejected"), options.approvalTimeoutMs ?? 120_000);
          approvals.set(id, (decision) => {
            clearTimeout(timer);
            resolve(decision);
          });
          signal.addEventListener("abort", () => resolve("rejected"));
        }),
    };
    for await (const beat of scenario(context) as AsyncIterable<Beat>) {
      await sleep(beat.wait / speed, signal);
      if (signal.aborted) return;
      if ("cut" in beat) {
        cut();
        return;
      }
      write(beat.event);
    }
  }

  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const path = url.pathname.replace(/^\/api(?=\/)/, "");

    try {
      if (request.method === "GET" && path === "/health") {
        return json(response, 200, { status: "ok", ready: true, busy: false });
      }

      if (request.method === "POST" && path === "/run") {
        const body = JSON.parse((await readBody(request)) || "{}") as { prompt?: string };
        const sse = (request.headers.accept ?? "").includes("text/event-stream");
        response.writeHead(200, {
          "Content-Type": sse ? "text/event-stream" : "application/x-ndjson",
          "Cache-Control": "no-cache",
          "X-Accel-Buffering": "no",
        });
        const controller = new AbortController();
        response.on("close", () => controller.abort());
        await play(
          body.prompt ?? "",
          (event) => response.write(sse ? `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n` : `${JSON.stringify(event)}\n`),
          () => response.destroy(),
          controller.signal,
        );
        if (!response.destroyed) response.end();
        return;
      }

      if (request.method === "POST" && path === "/v1/chat/completions") {
        const body = JSON.parse((await readBody(request)) || "{}") as { messages?: { role: string; content: string }[] };
        const question = [...(body.messages ?? [])].reverse().find((message) => message.role === "user")?.content ?? "";
        response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
        const controller = new AbortController();
        response.on("close", () => controller.abort());
        const chunk = (delta: object, finish: string | null = null) =>
          response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`);
        await play(
          question,
          (event) => {
            if (event.type === "reasoning.delta") chunk({ reasoning_content: event.text });
            else if (event.type === "text.delta") chunk({ content: event.text });
          },
          () => response.destroy(),
          controller.signal,
        );
        if (!response.destroyed) {
          chunk({}, "stop");
          response.write("data: [DONE]\n\n");
          response.end();
        }
        return;
      }

      const approval = /^\/approvals\/([^/]+)$/.exec(path);
      if (request.method === "POST" && approval) {
        const body = JSON.parse((await readBody(request)) || "{}") as { decision?: string };
        const resolve = approvals.get(decodeURIComponent(approval[1]));
        if (!resolve) return json(response, 404, { detail: "no such approval" });
        approvals.delete(decodeURIComponent(approval[1]));
        resolve(body.decision === "approved" ? "approved" : "rejected");
        return json(response, 200, { status: "ok" });
      }

      if (path === "/sessions" && request.method === "GET") {
        return json(
          response,
          200,
          [...sessions.values()]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map(({ session_id, title, created_at }) => ({ session_id, title, created_at })),
        );
      }
      const session = /^\/sessions\/([^/]+)$/.exec(path);
      if (session) {
        const id = decodeURIComponent(session[1]);
        if (request.method === "GET") {
          const found = sessions.get(id);
          return found ? json(response, 200, found) : json(response, 404, { detail: "not found" });
        }
        if (request.method === "POST") {
          const body = JSON.parse((await readBody(request)) || "{}") as { title?: string; messages?: unknown[] };
          sessions.set(id, {
            session_id: id,
            title: body.title ?? "",
            messages: body.messages ?? [],
            created_at: sessions.get(id)?.created_at ?? new Date().toISOString(),
          });
          return json(response, 200, { status: "saved" });
        }
        if (request.method === "DELETE") {
          sessions.delete(id);
          return json(response, 200, { status: "deleted" });
        }
      }

      json(response, 404, { detail: "not found" });
    } catch (error) {
      if (!response.headersSent) json(response, 500, { detail: error instanceof Error ? error.message : String(error) });
      else response.end();
    }
  });
}
