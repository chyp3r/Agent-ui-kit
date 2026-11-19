import type { AddressInfo } from "node:net";

import { createNdjsonAdapter, createSseAdapter, createOpenAiAdapter, type AgentEvent } from "@agent-kit/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createMockServer } from "./server.ts";
import { pickScenario } from "./scenarios.ts";

let server: ReturnType<typeof createMockServer>;
let base = "";

beforeAll(async () => {
  server = createMockServer({ speed: 200, lang: "en" });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const run = async (question: string) => {
  const events: AgentEvent[] = [];
  const adapter = createNdjsonAdapter({ baseUrl: base, retry: false });
  const final = await adapter.ask({ prompt: question, history: [], onEvent: (event) => events.push(event) });
  return { events, final };
};

describe("pickScenario", () => {
  it("maps the words of a question to a path", () => {
    expect(pickScenario("show a chart")).toBe("chart");
    expect(pickScenario("kaç kayıt var")).toBe("numbers");
    expect(pickScenario("hata ver")).toBe("fail");
    expect(pickScenario("Son 30 günün kayıtlarını listele")).toBe("list");
    expect(pickScenario("merhaba")).toBe("chat");
  });
});

describe("mock server", () => {
  it("plays a listing: planner, researcher, reviewer, then sources in the final meta", async () => {
    const { events, final } = await run("list the records");
    const nodes = events.filter((event) => event.type === "step.start").map((event) => (event as { node: string }).node);
    expect(nodes).toEqual(["planner", "researcher", "reviewer"]);
    expect(final.meta?.sources).toHaveLength(8);
    expect(final.text).toContain("- ");
  });

  it("plays a replan: the planner runs twice after a rejected review", async () => {
    const { events } = await run("try again with a replan");
    const nodes = events.filter((event) => event.type === "step.start").map((event) => (event as { node: string }).node);
    expect(nodes.filter((node) => node === "planner")).toHaveLength(2);
  });

  it("ends a failing run with an error event the adapter raises", async () => {
    await expect(run("this will error")).rejects.toMatchObject({ name: "StreamError", status: 502, receivedEvent: true });
  });

  it("drops the connection mid-run", async () => {
    await expect(run("cut the connection")).rejects.toMatchObject({ name: "StreamError", receivedEvent: true });
  });

  it("serves the same run as server-sent events", async () => {
    const events: AgentEvent[] = [];
    const adapter = createSseAdapter({ baseUrl: base, retry: false });
    const final = await adapter.ask({ prompt: "hello", history: [], onEvent: (event) => events.push(event) });
    expect(final.meta?.category).toBe("chat");
    expect(events.some((event) => event.type === "text.delta")).toBe(true);
  });

  it("serves an OpenAI-compatible stream", async () => {
    const adapter = createOpenAiAdapter({ baseUrl: `${base}/v1`, model: "mock" });
    const final = await adapter.ask({ prompt: "hello", history: [], onEvent: () => undefined });
    expect(final.text).toMatch(/Hello|Merhaba/);
  });

  it("waits for an approval and continues once it is given", async () => {
    const events: AgentEvent[] = [];
    const adapter = createNdjsonAdapter({
      baseUrl: base,
      retry: false,
      approvalPath: (id) => `/approvals/${id}`,
    });
    const done = adapter.ask({
      prompt: "send an email",
      history: [],
      onEvent: (event) => {
        events.push(event);
        if (event.type === "approval.request") void adapter.respond?.(event.id, "approved");
      },
    });
    const final = await done;
    expect(events.find((event) => event.type === "approval.resolved")).toMatchObject({ decision: "approved" });
    expect(final.text).toMatch(/sent/);
  });

  it("keeps sessions in memory", async () => {
    const post = await fetch(`${base}/sessions/a`, { method: "POST", body: JSON.stringify({ title: "t", messages: [] }) });
    expect(post.status).toBe(200);
    expect(((await (await fetch(`${base}/sessions`)).json()) as unknown[]).length).toBe(1);
    expect((await fetch(`${base}/sessions/missing`)).status).toBe(404);
  });
});
