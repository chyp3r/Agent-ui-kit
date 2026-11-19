import type {
  AgentEvent,
  OutputKind,
  PlanStepPayload,
  RecordItem,
  RunState,
  StepOutput,
  TimedEvent,
  ToolCallPayload,
  Verdict,
} from "../protocol/events";
import { emptyKit, type AgentKit } from "../registry/kit";

/**
 * The stream, folded into what the screen shows while a question runs.
 *
 * It lives outside the components so that the chat card and the panel read the same
 * events the same way, and so the folding can be tested without a DOM. Every state
 * here is reported by the backend. Timing is the one thing this browser adds: it
 * measures when an event reached it, and says so where it shows.
 *
 * A node that runs twice is two visits. The reviewer sending a question back to the
 * planner is the most interesting thing a graph does; folding the passes into one row
 * would hide it.
 */

export type { RunState };

export interface ToolCall {
  id: string;
  tool: string;
  state: RunState;
  /** The result in one short line, as the backend worded it. */
  summary: string | null;
  args: Record<string, unknown> | null;
  input: string | null;
  inputLanguage: string | null;
  output: string | null;
  outputKind: OutputKind;
  records: RecordItem[];
  /** True while the call is only inferred from the node being active. */
  inferred: boolean;
  /** The stream ended while this call was still running. */
  interrupted: boolean;
}

export interface PlanStep {
  id: string;
  agent: string;
  instruction: string;
  state: "pending" | RunState;
}

export interface Visit {
  id: string;
  index: number;
  node: string;
  /** The title the backend sent, for a node the kit does not know. */
  title: string | undefined;
  loop: number;
  state: RunState;
  /** What the backend last said about this step. */
  thought: string;
  /** What it said while starting, before the step had a result. */
  activeThought: string;
  startedAt: number;
  endedAt: number | null;
  calls: ToolCall[];
  /** Set on a visit that produced a plan: how far its steps have come. */
  plan: PlanStep[];
  notes: string[];
  verdict: Verdict | null;
  /** The step's raw `data`, shown under "system record". */
  data: Record<string, unknown>;
}

export interface Handoff {
  id: string;
  from: string;
  to: string;
  active: boolean;
  /** The work went back to the entry node: the one edge that points up the page. */
  replan: boolean;
}

export interface Approval {
  id: string;
  title: string;
  description: string | null;
  payload: Record<string, unknown>;
  state: "pending" | "approved" | "rejected";
  at: number;
}

export type Phase = "connecting" | "working" | "waiting" | "writing" | "done" | "failed" | "stopped";

export interface Flow {
  visits: Visit[];
  handoffs: Handoff[];
  current: Visit | null;
  calls: ToolCall[];
  approvals: Approval[];
  /** The model's reasoning as it streamed, if the backend sent any. */
  reasoning: string;
  /** How many times the work went back to the entry node. */
  replans: number;
  phase: Phase;
}

export interface Ending {
  final?: boolean;
  failed?: boolean;
  stopped?: boolean;
  /** Text of the answer has started to arrive. */
  writing?: boolean;
}

function makeCall(visitId: string, order: number, payload: Partial<ToolCallPayload> & { tool: string }, state: RunState, inferred = false): ToolCall {
  return {
    id: payload.callId ?? `${visitId}-${order}`,
    tool: payload.tool,
    state: payload.state ?? state,
    summary: payload.summary ?? null,
    args: payload.args ?? null,
    input: payload.input ?? null,
    inputLanguage: payload.inputLanguage ?? null,
    output: payload.output ?? null,
    outputKind: payload.outputKind ?? "text",
    records: payload.records ?? [],
    inferred,
    interrupted: false,
  };
}

function planOf(visit: Visit, steps: PlanStepPayload[], visits: Visit[]): PlanStep[] {
  const after = visits.filter((other) => other.index > visit.index);
  const nextPlanner = after.find((other) => other.node === visit.node);
  const reach = nextPlanner ? after.filter((other) => other.index < nextPlanner.index) : after;
  const seen = new Map<string, number>();
  return steps.map((step, order) => {
    const nth = seen.get(step.agent) ?? 0;
    seen.set(step.agent, nth + 1);
    const run = reach.filter((other) => other.node === step.agent)[nth];
    return {
      id: `${visit.id}-s${step.id ?? order}`,
      agent: step.agent,
      instruction: step.instruction,
      state: run ? run.state : "pending",
    };
  });
}

function newVisit(visits: Visit[], event: Extract<AgentEvent, { node: string }>, at: number, kit: AgentKit): Visit {
  const id = `v${visits.length}`;
  const visit: Visit = {
    id,
    index: visits.length,
    node: event.node,
    title: event.title,
    loop: event.loop ?? 0,
    state: "running",
    thought: event.details ?? "",
    activeThought: event.details ?? "",
    startedAt: at,
    endedAt: null,
    calls: [makeCall(id, 0, { tool: kit.mainTool(event.node) }, "running", true)],
    plan: [],
    notes: [],
    verdict: null,
    data: {},
  };
  visits.push(visit);
  return visit;
}

function settle(visit: Visit, output: StepOutput | undefined, kit: AgentKit): void {
  const verdict = output?.verdict ?? null;
  visit.verdict = verdict;
  visit.notes = output?.notes ?? [];
  visit.data = output?.data ?? {};

  if (output?.calls?.length) {
    visit.calls = output.calls.map((call, order) =>
      makeCall(visit.id, order, call, "done"),
    );
  } else if (visit.calls.every((call) => call.inferred)) {
    // Nothing reported, so the inferred call is all there is: it ended with its step.
    const failed = verdict ? !verdict.passed : false;
    visit.calls = [
      {
        ...(visit.calls[0] ?? makeCall(visit.id, 0, { tool: kit.mainTool(visit.node) }, "done", true)),
        state: failed ? "failed" : "done",
        summary: null,
        output: verdict?.critique ?? null,
        inferred: true,
      },
    ];
  } else {
    visit.calls = visit.calls.map((call) => (call.state === "running" ? { ...call, state: "done" as const } : call));
  }
  visit.state = visit.calls.some((call) => call.state === "failed") ? "failed" : "done";
}

export function foldFlow(events: TimedEvent[], ending: Ending = {}, kit: AgentKit = emptyKit): Flow {
  const visits: Visit[] = [];
  const approvals: Approval[] = [];
  const plans = new Map<string, PlanStepPayload[]>();
  let reasoning = "";

  const latestRunning = (node?: string) =>
    [...visits].reverse().find((visit) => visit.state === "running" && (node === undefined || visit.node === node));

  for (const { at, event } of events) {
    switch (event.type) {
      case "step.start":
        newVisit(visits, event, at, kit);
        break;
      case "step.end": {
        // A partial stream: the end of a step whose start never arrived.
        const visit = latestRunning(event.node) ?? newVisit(visits, event, at, kit);
        visit.endedAt = at;
        visit.thought = event.details || visit.thought;
        if (event.title) visit.title = event.title;
        settle(visit, event.output, kit);
        if (event.output?.plan?.length) plans.set(visit.id, event.output.plan);
        break;
      }
      case "tool.start": {
        const visit = latestRunning(event.node) ?? latestRunning();
        if (!visit) break;
        // The first real call replaces the guess made when the step began.
        const calls = visit.calls.filter((call) => !call.inferred);
        calls.push(makeCall(visit.id, calls.length, { ...event, callId: event.callId }, "running"));
        visit.calls = calls;
        break;
      }
      case "tool.end": {
        let found = false;
        for (const visit of visits) {
          const index = visit.calls.findIndex((call) => call.id === event.callId);
          if (index < 0) continue;
          const call = visit.calls[index];
          visit.calls = visit.calls.map((other, at2) =>
            at2 === index
              ? {
                  ...call,
                  state: event.state ?? "done",
                  summary: event.summary ?? call.summary,
                  output: event.output ?? call.output,
                  outputKind: event.outputKind ?? call.outputKind,
                  records: event.records ?? call.records,
                  args: event.args ?? call.args,
                  input: event.input ?? call.input,
                }
              : other,
          );
          found = true;
          break;
        }
        if (!found) {
          const visit = latestRunning();
          if (visit && event.tool) {
            visit.calls = [...visit.calls.filter((call) => !call.inferred), makeCall(visit.id, visit.calls.length, event as ToolCallPayload, "done")];
          }
        }
        break;
      }
      case "reasoning.delta":
        reasoning += event.text;
        break;
      case "approval.request":
        approvals.push({
          id: event.id,
          title: event.title,
          description: event.description ?? null,
          payload: event.payload ?? {},
          state: "pending",
          at,
        });
        break;
      case "approval.resolved": {
        const approval = approvals.find((other) => other.id === event.id);
        if (approval) approval.state = event.decision;
        break;
      }
      default:
        break;
    }
  }

  // A stream that ended leaves nothing running, whatever its last event said.
  const closed = Boolean(ending.final || ending.failed || ending.stopped);
  if (closed) {
    for (const visit of visits) {
      if (visit.state !== "running") continue;
      visit.state = "failed";
      visit.calls = visit.calls.map((call) => (call.state === "running" ? { ...call, state: "failed" as const, interrupted: true } : call));
    }
    for (const approval of approvals) if (approval.state === "pending" && !ending.final) approval.state = "rejected";
  }

  for (const visit of visits) {
    const plan = plans.get(visit.id);
    if (plan) visit.plan = planOf(visit, plan, visits);
  }

  const entry = kit.entryNode;
  const current = visits.find((visit) => visit.state === "running") ?? null;
  const handoffs: Handoff[] = visits.slice(0, -1).map((visit, index) => {
    const next = visits[index + 1];
    return {
      id: `${visit.id}-${next.id}`,
      from: visit.node,
      to: next.node,
      active: next.state === "running",
      replan: next.node === entry && visit.node !== entry,
    };
  });

  const last = visits[visits.length - 1];
  const finishing = !current && last !== undefined && (kit.isEnding(last.node) || last.verdict?.passed === true);
  const waiting = approvals.some((approval) => approval.state === "pending");
  const phase: Phase = ending.stopped
    ? "stopped"
    : ending.failed
      ? "failed"
      : ending.final
        ? "done"
        : waiting
          ? "waiting"
          : current
            ? "working"
            : ending.writing || finishing
              ? "writing"
              : visits.length
                ? "working"
                : "connecting";

  return {
    visits,
    handoffs,
    current,
    calls: visits.flatMap((visit) => visit.calls),
    approvals,
    reasoning,
    replans: handoffs.filter((handoff) => handoff.replan).length,
    phase,
  };
}

/** A settled visit's own time on this browser's clock. Null while it runs or when unknown. */
export function visitDuration(visit: Visit): number | null {
  if (visit.endedAt === null || !Number.isFinite(visit.startedAt) || !Number.isFinite(visit.endedAt)) return null;
  return Math.max(0, visit.endedAt - visit.startedAt);
}
