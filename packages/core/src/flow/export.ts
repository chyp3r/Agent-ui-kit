import { formatDuration } from "../format";
import type { Locale } from "../i18n";
import type { AgentKit } from "../registry/kit";
import { emptyKit } from "../registry/kit";
import type { Turn } from "../session/turn";
import { compactEvents } from "../session/turn";
import { foldFlow, visitDuration } from "./fold";

/** A run as a file: enough to open it again in any kit-based UI. */
export function traceJson(turn: Turn): string {
  return JSON.stringify(
    {
      format: "agent-kit-trace",
      version: 1,
      question: turn.question,
      answer: turn.answer,
      meta: turn.meta,
      reasoning: turn.reasoning,
      elapsedMs: turn.elapsedMs,
      events: compactEvents(turn.events),
    },
    null,
    2,
  );
}

/** Reads a file written by `traceJson`. Returns null for anything else. */
export function parseTrace(text: string): Turn | null {
  try {
    const raw = JSON.parse(text) as Partial<Turn> & { format?: string; events?: unknown };
    if (raw.format !== "agent-kit-trace" || typeof raw.question !== "string" || !Array.isArray(raw.events)) return null;
    return {
      question: raw.question,
      answer: typeof raw.answer === "string" ? raw.answer : "",
      meta: raw.meta ?? null,
      events: raw.events as Turn["events"],
      reasoning: typeof raw.reasoning === "string" ? raw.reasoning : "",
      elapsedMs: typeof raw.elapsedMs === "number" ? raw.elapsedMs : null,
    };
  } catch {
    return null;
  }
}

/** A run as a readable report: who ran, what they called, in order. */
export function traceMarkdown(turn: Turn, kit: AgentKit = emptyKit, locale: Locale = "tr"): string {
  const flow = foldFlow(turn.events, { final: true }, kit);
  const lines = [`# ${turn.question}`, ""];
  flow.visits.forEach((visit, index) => {
    const agent = kit.agent(visit.node, visit.title, locale);
    const duration = visitDuration(visit);
    lines.push(`## ${index + 1}. ${agent.name}${duration !== null ? ` (${formatDuration(duration, locale)})` : ""}`);
    if (visit.thought) lines.push("", visit.thought);
    for (const call of visit.calls) {
      const info = kit.tool(call.tool, locale);
      lines.push("", `- **${info.label}** — ${call.state}${call.summary ? `: ${call.summary}` : ""}`);
      if (call.input) lines.push("", "  ```", ...call.input.split("\n").map((line) => `  ${line}`), "  ```");
    }
    lines.push("");
  });
  lines.push("---", "", turn.answer);
  return lines.join("\n");
}
