import { emptyKit, type AgentKit } from "../registry/kit";
import type { Turn } from "../session/turn";
import { foldFlow, type Flow } from "./fold";

/** A finished turn's flow: its stored events, closed, with the stored reasoning. */
export function foldTurn(turn: Turn, kit: AgentKit = emptyKit): Flow {
  const events = turn.reasoning
    ? [...turn.events, { at: Number.NaN, event: { type: "reasoning.delta" as const, text: turn.reasoning } }]
    : turn.events;
  return foldFlow(events, { final: true }, kit);
}
