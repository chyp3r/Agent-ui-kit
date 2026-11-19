/**
 * The kit's own event protocol: what any backend (through an adapter) tells the UI.
 *
 * One run is a sequence of these events. The UI never invents state: every step,
 * tool call, approval and word of text on screen comes from one of them. Timing is
 * the one thing the browser adds, by stamping when each event arrived.
 */

export type RunState = "running" | "done" | "failed";

/** How a tool's `output` is drawn. Open-ended: register a renderer for your own kind. */
export type OutputKind = "text" | "markdown" | "code" | "json" | "table" | (string & {});

/** A source the answer rests on: a document, a row, a page, a record. */
export interface Source {
  id: string;
  /** A short tag the reader can filter by: a file, a table, a host, a channel. */
  tag: string | null;
  /** Display-ready time or date, if the source has one. */
  time: string | null;
  /** The node that found it. */
  agent: string;
  /** 0..1, if the source carries one. */
  confidence: number | null;
  text: string;
}

/** One line of sample data a tool found. */
export interface RecordItem {
  tag?: string | null;
  time?: string | null;
  text?: string | null;
}

export interface ToolCallPayload {
  /** Defaults to an id derived from the step and the call's order. */
  callId?: string;
  tool: string;
  state?: RunState;
  /** The result in one short line. */
  summary?: string | null;
  args?: Record<string, unknown> | null;
  /** What was sent to the tool as text: a query, a command, a prompt. */
  input?: string | null;
  inputLanguage?: string | null;
  output?: string | null;
  outputKind?: OutputKind;
  records?: RecordItem[];
}

export interface PlanStepPayload {
  id?: number | string;
  /** A node name. */
  agent: string;
  instruction: string;
}

export interface Verdict {
  passed: boolean;
  /** 0..1 */
  confidence?: number | null;
  critique?: string | null;
  missing?: string[];
}

/** What a finished step reports. Every field is optional: a node only fills its own. */
export interface StepOutput {
  calls?: ToolCallPayload[];
  plan?: PlanStepPayload[];
  verdict?: Verdict;
  /** Lines about the run that are not tool calls. */
  notes?: string[];
  /** Anything else; shown raw under "system record". */
  data?: Record<string, unknown>;
}

export interface StepInfo {
  node: string;
  /** A title for a node the kit's registry does not know. */
  title?: string;
  /** Which pass this is: the second plan after a rejected review is loop 1. */
  loop?: number;
  details?: string;
}

export interface ChartData {
  type: "bar" | "line" | "pie" | "table";
  title: string;
  labels: string[];
  values: number[];
  yLabel?: string;
}

export interface RunMeta {
  category?: string | null;
  verified?: boolean;
  /** 0..1 */
  confidence?: number | null;
  loops?: number;
  agents?: string[];
  planHistory?: string[];
  sources?: Source[];
  chart?: ChartData | null;
  /** Free-form, passed through to the host app. */
  extra?: Record<string, unknown>;
}

export type AgentEvent =
  | { type: "run.start"; runId?: string }
  | ({ type: "step.start" } & StepInfo)
  | ({ type: "step.end" } & StepInfo & { output?: StepOutput })
  | {
      type: "tool.start";
      callId: string;
      tool: string;
      /** The step it belongs to; the latest running one if omitted. */
      node?: string;
      args?: Record<string, unknown> | null;
      input?: string | null;
    }
  | ({ type: "tool.end"; callId: string } & Partial<Omit<ToolCallPayload, "callId">>)
  | { type: "text.delta"; text: string }
  | { type: "reasoning.delta"; text: string }
  | {
      type: "approval.request";
      id: string;
      title: string;
      description?: string;
      /** Shown as a key/value list. */
      payload?: Record<string, unknown>;
    }
  | { type: "approval.resolved"; id: string; decision: "approved" | "rejected" }
  | { type: "final"; text: string; meta?: RunMeta }
  | { type: "error"; message: string; status?: number };

export type AgentEventType = AgentEvent["type"];

export const EVENT_TYPES: ReadonlySet<string> = new Set<AgentEventType>([
  "run.start",
  "step.start",
  "step.end",
  "tool.start",
  "tool.end",
  "text.delta",
  "reasoning.delta",
  "approval.request",
  "approval.resolved",
  "final",
  "error",
]);

export type FinalEvent = Extract<AgentEvent, { type: "final" }>;

/** An event as it reached this browser. */
export interface TimedEvent {
  /** Milliseconds since the question left, on this browser's clock. NaN when unknown. */
  at: number;
  event: AgentEvent;
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export function isAgentEvent(value: unknown): value is AgentEvent {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    EVENT_TYPES.has((value as { type?: unknown }).type as string)
  );
}
