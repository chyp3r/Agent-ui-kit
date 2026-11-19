import { describe, expect, it } from "vitest";

import type { AgentEvent, TimedEvent } from "../protocol/events";
import { demoKit } from "../presets/demoKit";
import { foldFlow, visitDuration } from "./fold";

const at = (events: AgentEvent[], step = 100): TimedEvent[] => events.map((event, index) => ({ at: index * step, event }));

const START = (node: string, loop = 0): AgentEvent => ({ type: "step.start", node, loop, details: `${node} starts` });
const END = (node: string, output?: Extract<AgentEvent, { type: "step.end" }>["output"], loop = 0): AgentEvent => ({
  type: "step.end",
  node,
  loop,
  details: `${node} done`,
  output,
});

describe("foldFlow", () => {
  it("shows a running step with its main tool inferred", () => {
    const flow = foldFlow(at([START("planner")]), {}, demoKit);
    expect(flow.current?.node).toBe("planner");
    expect(flow.current?.calls).toMatchObject([{ tool: "make_plan", state: "running", inferred: true }]);
    expect(flow.phase).toBe("working");
  });

  it("is connecting before any step arrived", () => {
    expect(foldFlow([], {}, demoKit).phase).toBe("connecting");
  });

  it("keeps a node that ran twice as two visits and marks the way back as a replan", () => {
    const flow = foldFlow(
      at([
        START("planner"),
        END("planner"),
        START("researcher"),
        END("researcher"),
        START("reviewer"),
        END("reviewer", { verdict: { passed: false, critique: "missing" } }),
        START("planner", 1),
        END("planner", undefined, 1),
      ]),
      { final: true },
      demoKit,
    );
    expect(flow.visits.map((visit) => visit.node)).toEqual(["planner", "researcher", "reviewer", "planner"]);
    expect(flow.replans).toBe(1);
    expect(flow.handoffs.find((handoff) => handoff.replan)).toMatchObject({ from: "reviewer", to: "planner" });
    expect(flow.visits[2].state).toBe("failed");
    expect(flow.visits[2].verdict?.critique).toBe("missing");
  });

  it("replaces the inferred call with real tool events and settles them on step end", () => {
    const flow = foldFlow(
      at([
        START("researcher"),
        { type: "tool.start", callId: "c1", tool: "search", args: { q: "x" } },
        { type: "tool.end", callId: "c1", summary: "3 results", records: [{ text: "a" }] },
      ]),
      {},
      demoKit,
    );
    const [call] = flow.current!.calls;
    expect(call).toMatchObject({ id: "c1", tool: "search", state: "done", summary: "3 results", args: { q: "x" }, inferred: false });
    expect(call.records).toHaveLength(1);
  });

  it("lets step.end output.calls override what was streamed", () => {
    const flow = foldFlow(
      at([START("analyst"), END("analyst", { calls: [{ tool: "run_query", input: "SELECT 1", inputLanguage: "sql", output: "| a |\n|---|\n| 1 |", outputKind: "markdown" }] })]),
      {},
      demoKit,
    );
    expect(flow.visits[0].calls[0]).toMatchObject({ tool: "run_query", input: "SELECT 1", outputKind: "markdown", state: "done" });
  });

  it("ticks plan steps against the visits after the plan", () => {
    const flow = foldFlow(
      at([
        START("planner"),
        END("planner", { plan: [{ agent: "researcher", instruction: "find" }, { agent: "reviewer", instruction: "check" }] }),
        START("researcher"),
        END("researcher"),
        START("reviewer"),
      ]),
      {},
      demoKit,
    );
    expect(flow.visits[0].plan.map((step) => step.state)).toEqual(["done", "running"]);
  });

  it("fails what was still running when the stream stopped", () => {
    const flow = foldFlow(at([START("researcher")]), { stopped: true }, demoKit);
    expect(flow.phase).toBe("stopped");
    expect(flow.visits[0].state).toBe("failed");
    expect(flow.visits[0].calls[0].interrupted).toBe(true);
  });

  it("is writing once the reviewer passed and nothing else is running", () => {
    const flow = foldFlow(at([START("reviewer"), END("reviewer", { verdict: { passed: true } })]), {}, demoKit);
    expect(flow.phase).toBe("writing");
  });

  it("waits on an approval and records the decision", () => {
    const base: AgentEvent[] = [START("analyst"), END("analyst"), { type: "approval.request", id: "a1", title: "Send?" }];
    expect(foldFlow(at(base), {}, demoKit).phase).toBe("waiting");
    const resolved = foldFlow(at([...base, { type: "approval.resolved", id: "a1", decision: "approved" }]), {}, demoKit);
    expect(resolved.approvals[0].state).toBe("approved");
    expect(resolved.phase).not.toBe("waiting");
  });

  it("collects streamed reasoning", () => {
    const flow = foldFlow(at([{ type: "reasoning.delta", text: "think " }, { type: "reasoning.delta", text: "more" }]), {}, demoKit);
    expect(flow.reasoning).toBe("think more");
  });

  it("renders a node the kit does not know under the server's title", () => {
    const flow = foldFlow(at([{ type: "step.start", node: "newcomer", title: "Newcomer" }]), {}, demoKit);
    expect(demoKit.agent(flow.visits[0].node, flow.visits[0].title).name).toBe("Newcomer");
  });

  it("measures durations only for settled steps with known times", () => {
    const settled = foldFlow(at([START("planner"), END("planner")], 250), {}, demoKit).visits[0];
    expect(visitDuration(settled)).toBe(250);
    const unknown = foldFlow([{ at: NaN, event: START("planner") }, { at: NaN, event: END("planner") }], {}, demoKit).visits[0];
    expect(visitDuration(unknown)).toBeNull();
  });

  it("completes a partial stream whose step start never arrived", () => {
    const flow = foldFlow(at([END("reviewer")]), {}, demoKit);
    expect(flow.visits).toHaveLength(1);
    expect(flow.visits[0].state).toBe("done");
  });
});
