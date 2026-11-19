import { demoKit, foldFlow, type AgentEvent, type TimedEvent } from "@agent-kit/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AgentKitProvider } from "../../context/KitContext";
import { AgentWorkflowDiagram } from "./AgentWorkflowDiagram";

const at = (events: AgentEvent[]): TimedEvent[] => events.map((event, index) => ({ at: index * 300, event }));

const RUNNING = at([
  { type: "step.start", node: "planner" },
  { type: "step.end", node: "planner", details: "Plan hazır." },
  { type: "step.start", node: "analyst", details: "Sorgu çalışıyor." },
]);

const REPLAN = at([
  { type: "step.start", node: "planner" },
  { type: "step.end", node: "planner" },
  { type: "step.start", node: "reviewer" },
  { type: "step.end", node: "reviewer", output: { verdict: { passed: false, critique: "Eksik." } } },
  { type: "step.start", node: "planner", loop: 1 },
  { type: "step.end", node: "planner", loop: 1 },
  { type: "step.start", node: "reviewer", loop: 1 },
  { type: "step.end", node: "reviewer", loop: 1, output: { verdict: { passed: true } } },
]);

const QUERY = at([
  { type: "step.start", node: "analyst" },
  {
    type: "step.end",
    node: "analyst",
    output: { calls: [{ tool: "run_query", input: "SELECT 1", inputLanguage: "sql", output: "| n |\n|---|\n| 279 |", outputKind: "markdown" }] },
  },
]);

const view = (flow: ReturnType<typeof foldFlow>) =>
  render(
    <AgentKitProvider kit={demoKit} locale="tr">
      <AgentWorkflowDiagram flow={flow} />
    </AgentKitProvider>,
  );

describe("AgentWorkflowDiagram", () => {
  it("says it is waiting before the first step", () => {
    view(foldFlow([], {}, demoKit));
    expect(screen.getByRole("status")).toHaveTextContent("İlk adım bekleniyor");
  });

  it("marks the running stage, its tool and its handoff; only the agent at work moves", () => {
    const { container } = view(foldFlow(RUNNING, {}, demoKit));
    const stages = container.querySelectorAll(".workflow-stage");
    expect(stages).toHaveLength(2);
    expect(stages[0]).toHaveAttribute("data-state", "visited");
    expect(stages[1]).toHaveAttribute("data-state", "running");
    expect(stages[1].querySelector(".workflow-tool-branch li")).toHaveAttribute("data-state", "running");
    expect(container.querySelector(".workflow-handoff")).toHaveAttribute("data-active", "true");
    expect(stages[0].querySelector(".agent-portrait")).not.toHaveAttribute("data-active");
    expect(stages[1].querySelector(".agent-portrait")).toHaveAttribute("data-active");
  });

  it("draws every pass of a replan, and the handoff that sent it back", () => {
    const { container } = view(foldFlow(REPLAN, { final: true }, demoKit));
    expect(container.querySelectorAll('.workflow-stage[data-node="planner"]')).toHaveLength(2);
    expect(screen.getByLabelText("Döngü 2")).toBeInTheDocument();
    expect(container.querySelectorAll(".workflow-handoff[data-replan]")).toHaveLength(1);
    expect(screen.getByText("Eksik bulundu, yeniden planlanıyor")).toBeInTheDocument();
  });

  it("ends a finished run at the answer", () => {
    const { container } = view(foldFlow(REPLAN, { final: true }, demoKit));
    expect(container.querySelector('.workflow-stage[data-node="answer"]')).toBeInTheDocument();
    expect(screen.getByText("Denetçi → Yanıt")).toBeInTheDocument();
    expect(screen.getByText("Teslim edildi")).toBeInTheDocument();
  });

  it("opens a tool's input and result, and closes with Escape or the button", async () => {
    const user = userEvent.setup();
    view(foldFlow(QUERY, { final: true }, demoKit));
    await user.click(screen.getByRole("button", { name: /Veri sorgusu/ }));

    const inspector = screen.getByRole("complementary");
    expect(within(inspector).getByText("SELECT")).toBeInTheDocument();
    expect(within(inspector).getByRole("cell", { name: "279" })).toBeInTheDocument();
    expect(within(inspector).getByText("Neden çağrıldı?")).toBeInTheDocument();

    await user.click(within(inspector).getByRole("button", { name: "Ayrıntıyı kapat" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("speaks English when asked to", () => {
    render(
      <AgentKitProvider kit={demoKit} locale="en">
        <AgentWorkflowDiagram flow={foldFlow([], {}, demoKit)} />
      </AgentKitProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for the first step");
  });
});
