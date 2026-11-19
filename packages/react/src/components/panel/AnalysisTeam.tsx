import { Check, ChevronDown, CircleAlert, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { visitDuration, type Flow } from "@agent-kit/core";

import { useKit } from "../../context/KitContext";
import { AgentWorkflowDiagram } from "./AgentWorkflowDiagram";
import { StepDetail } from "./StepDetail";
import { toolIcon } from "./toolIcons";

/** The map, and under it the same run as a list a reader can go through in order. */
export function AnalysisTeam({ flow, words = 0 }: { flow: Flow; words?: number }) {
  const { t, tool, agent, fmt } = useKit();
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const rows = flow.visits.flatMap((visit) => visit.calls.map((call, order) => ({ visit, call, order })));

  return (
    <section className="analysis-team" aria-label={t("team.label")}>
      <AgentWorkflowDiagram flow={flow} words={words} label={t("flow.liveMap")} />

      {rows.length > 0 && (
        <details
          className="agent-tool-log"
          open={logOpen}
          onToggle={(event) => setLogOpen(event.currentTarget.open)}
        >
          <summary className="agent-tool-log-heading">
            <div>
              <span className="section-eyebrow">{t("log.eyebrow")}</span>
              <h3>{t("log.title")}</h3>
            </div>
            <span className="agent-tool-log-summary">
              <span className="agent-tool-log-count" data-numeric>
                {t("thought.steps", { n: rows.length })}
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </span>
          </summary>
          <ol className="agent-tool-log-list">
            {rows.map(({ visit, call, order }, index) => {
              const info = tool(call.tool);
              const Icon = toolIcon(info.icon);
              const open = selectedCallId === call.id;
              const duration = order === 0 ? visitDuration(visit) : null;
              return (
                <li key={call.id} data-state={call.state} className="agent-tool-log-item">
                  <button
                    className="agent-tool-log-row"
                    type="button"
                    aria-expanded={open}
                    aria-label={t("flow.openDetail", { name: info.label })}
                    onClick={() => setSelectedCallId(open ? null : call.id)}
                  >
                    <span className="agent-tool-log-index" data-numeric>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="agent-tool-log-icon" aria-hidden="true">
                      <Icon size={15} />
                    </span>
                    <span className="agent-tool-log-copy">
                      <strong>{info.label}</strong>
                      <small>
                        {agent(visit.node, visit.title).name}
                        {visit.loop > 0 && ` · ${t("flow.loop", { n: visit.loop + 1 })}`}
                        {call.summary ? ` · ${call.summary}` : ""}
                      </small>
                    </span>
                    {duration !== null && (
                      <span className="agent-tool-log-time" data-numeric>
                        {fmt.duration(duration)}
                      </span>
                    )}
                    {call.state === "done" ? (
                      <Check className="agent-tool-log-status" size={16} aria-label={t("state.doneLower")} />
                    ) : call.state === "failed" ? (
                      <CircleAlert className="agent-tool-log-status" size={16} aria-label={t("state.failedLower")} />
                    ) : (
                      <LoaderCircle className="agent-tool-log-status agent-tool-log-spin" size={16} aria-label={t("state.runningLower")} />
                    )}
                    <ChevronDown className="agent-tool-log-chevron" size={16} aria-hidden="true" />
                  </button>
                  {open && (
                    <div className="agent-tool-log-detail">
                      <StepDetail visit={visit} toolCall={call} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </details>
      )}
    </section>
  );
}
