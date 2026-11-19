import { visitDuration, type Flow } from "@agent-kit/core";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";

import { useKit } from "../../context/KitContext";
import { AgentPortrait } from "../agents/AgentPortrait";
import { PlanList } from "../panel/StepDetail";
import { toolIcon } from "../panel/toolIcons";

/**
 * The run in the conversation: who worked, what they said and which tools they
 * reached for, one line per visit. It is the same run the panel draws as a map,
 * told as a story, so that the reasoning is on screen even with the panel closed.
 *
 * What it quotes is the backend's own wording; a planner's line is the model's
 * reasoning for its plan, the others report what the step did.
 */
export function ThoughtStream({
  flow,
  onOpenFlow,
}: {
  flow: Flow;
  /** Opens the same step on the map. */
  onOpenFlow?: () => void;
}) {
  const { t, kit, agent, tool, fmt } = useKit();
  if (!flow.visits.length) return null;
  return (
    <ol className="thought-stream" aria-label={t("thought.title")}>
      {flow.visits.map((visit) => {
        const duration = visitDuration(visit);
        const running = visit.state === "running";
        return (
          <li key={visit.id} data-state={visit.state} className="thought-item">
            <span className="thought-rail" aria-hidden="true">
              <AgentPortrait avatar={kit.avatarOf(visit.node)} active={running} size={28} />
            </span>
            <div className="thought-body">
              <header>
                <strong>{agent(visit.node, visit.title).name}</strong>
                {visit.loop > 0 && <span className="thought-loop">{t("flow.loop", { n: visit.loop + 1 })}</span>}
                {duration !== null && (
                  <time data-numeric title={t("flow.measured")}>
                    {fmt.duration(duration)}
                  </time>
                )}
              </header>
              <p className={running ? "thought-text text-shimmer" : "thought-text"} key={visit.thought}>
                {visit.thought}
              </p>
              {visit.plan.length > 0 && <PlanList plan={visit.plan} />}
              {visit.calls.length > 0 && (
                <div className="thought-tools">
                  {visit.calls.map((call) => {
                    const Icon = toolIcon(tool(call.tool).icon);
                    const info = tool(call.tool);
                    const title = `${info.label}${call.summary ? `: ${call.summary}` : ""}`;
                    const body = (
                      <>
                        <Icon size={12} aria-hidden="true" />
                        <span>{info.short}</span>
                        {call.state === "running" ? (
                          <LoaderCircle size={12} className="tool-chip-spin" aria-label={t("state.running")} />
                        ) : call.state === "failed" ? (
                          <CircleAlert size={12} aria-label={t("state.warning")} />
                        ) : (
                          <Check size={12} aria-label={t("state.done")} />
                        )}
                      </>
                    );
                    return onOpenFlow ? (
                      <button key={call.id} type="button" data-state={call.state} className="tool-chip" title={title} onClick={onOpenFlow}>
                        {body}
                      </button>
                    ) : (
                      <span key={call.id} data-state={call.state} className="tool-chip" title={title}>
                        {body}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
