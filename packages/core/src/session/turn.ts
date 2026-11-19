import type { HistoryMessage, RunMeta, TimedEvent } from "../protocol/events";

/** One answered question, as the conversation holds it. */
export interface Turn {
  question: string;
  answer: string;
  meta: RunMeta | null;
  /** The run's step, tool and approval events: enough to draw the flow again. */
  events: TimedEvent[];
  /** The model's reasoning, if the backend streamed any. */
  reasoning: string;
  /** On this browser's clock; unknown for a turn saved by another client. */
  elapsedMs: number | null;
  feedback?: "up" | "down";
}

/** Text deltas are the answer's own words and the answer is stored whole. */
const KEPT = new Set(["run.start", "step.start", "step.end", "tool.start", "tool.end", "approval.request", "approval.resolved"]);

export function compactEvents(events: TimedEvent[]): TimedEvent[] {
  return events.filter(({ event }) => KEPT.has(event.type));
}

/** A session id. `crypto.randomUUID` needs a secure origin; this works over plain http. */
export function newSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function sessionTitle(question: string): string {
  const line = question.trim().replace(/\s+/g, " ");
  return line.length > 64 ? `${line.slice(0, 63)}…` : line;
}

/** What the agent is told of the conversation so far. */
export function historyOf(turns: Turn[]): HistoryMessage[] {
  return turns.flatMap((turn): HistoryMessage[] => [
    { role: "user", content: turn.question },
    { role: "assistant", content: turn.answer },
  ]);
}

/** One stored message. The shape the stores read and write. */
export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  events?: TimedEvent[];
  reasoning?: string;
  meta?: RunMeta | null;
  elapsed_ms?: number;
  feedback?: "up" | "down";
}

export function messagesOf(turns: Turn[]): StoredMessage[] {
  return turns.flatMap((turn): StoredMessage[] => [
    { role: "user", content: turn.question },
    {
      role: "assistant",
      content: turn.answer,
      events: compactEvents(turn.events),
      ...(turn.reasoning ? { reasoning: turn.reasoning } : {}),
      meta: turn.meta,
      ...(turn.elapsedMs !== null ? { elapsed_ms: Math.round(turn.elapsedMs) } : {}),
      ...(turn.feedback ? { feedback: turn.feedback } : {}),
    },
  ]);
}

/** Every assistant message pairs with the user message before it; an unanswered question is not a turn. */
export function turnsOf(messages: StoredMessage[]): Turn[] {
  const turns: Turn[] = [];
  let question: string | null = null;
  for (const message of messages) {
    if (message.role === "user") {
      question = message.content;
    } else if (question !== null) {
      turns.push({
        question,
        answer: message.content ?? "",
        meta: message.meta ?? null,
        events: message.events ?? [],
        reasoning: message.reasoning ?? "",
        elapsedMs: message.elapsed_ms ?? null,
        ...(message.feedback ? { feedback: message.feedback } : {}),
      });
      question = null;
    }
  }
  return turns;
}
