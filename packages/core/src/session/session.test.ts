import { describe, expect, it } from "vitest";

import { createMemorySessionStore } from "./memory";
import { SessionNotFound } from "./store";
import { historyOf, messagesOf, sessionTitle, turnsOf, type Turn } from "./turn";
import { traceJson, parseTrace, traceMarkdown } from "../flow/export";
import { demoKit } from "../presets/demoKit";

const turn: Turn = {
  question: "How many?",
  answer: "Three.",
  meta: { category: "numbers", verified: true },
  events: [
    { at: 0, event: { type: "step.start", node: "analyst" } },
    { at: 50, event: { type: "text.delta", text: "Thr" } },
    { at: 120, event: { type: "step.end", node: "analyst", output: { calls: [{ tool: "run_query", input: "SELECT 3" }] } } },
  ],
  reasoning: "count rows",
  elapsedMs: 130.4,
};

describe("session", () => {
  it("round-trips turns through stored messages without the text deltas", () => {
    const messages = messagesOf([turn]);
    expect(messages).toHaveLength(2);
    const [back] = turnsOf(messages);
    expect(back.events.map((entry) => entry.event.type)).toEqual(["step.start", "step.end"]);
    expect(back).toMatchObject({ question: "How many?", answer: "Three.", reasoning: "count rows", elapsedMs: 130 });
  });

  it("drops a question nobody answered", () => {
    expect(turnsOf([{ role: "user", content: "a" }, { role: "user", content: "b" }])).toEqual([]);
  });

  it("tells the agent the conversation so far", () => {
    expect(historyOf([turn])).toEqual([
      { role: "user", content: "How many?" },
      { role: "assistant", content: "Three." },
    ]);
  });

  it("shortens a long title", () => {
    expect(sessionTitle("  a   b  ")).toBe("a b");
    expect(sessionTitle("x".repeat(100))).toHaveLength(64);
  });

  it("stores, lists newest first, and says when a session is gone", async () => {
    const store = createMemorySessionStore();
    await store.save("a", "first", messagesOf([turn]));
    await new Promise((resolve) => setTimeout(resolve, 2));
    await store.save("b", "second", []);
    expect((await store.list()).map((row) => row.session_id)).toEqual(["b", "a"]);
    await store.remove("a");
    await expect(store.get("a")).rejects.toBeInstanceOf(SessionNotFound);
  });
});

describe("trace export", () => {
  it("writes a trace file that reads back as the same run", () => {
    const back = parseTrace(traceJson(turn));
    expect(back?.question).toBe("How many?");
    expect(back?.events).toHaveLength(2);
    expect(parseTrace("{}")).toBeNull();
    expect(parseTrace("not json")).toBeNull();
  });

  it("writes a readable report of the run", () => {
    const markdown = traceMarkdown(turn, demoKit, "en");
    expect(markdown).toContain("# How many?");
    expect(markdown).toContain("Analyst");
    expect(markdown).toContain("SELECT 3");
    expect(markdown).toContain("Three.");
  });
});
