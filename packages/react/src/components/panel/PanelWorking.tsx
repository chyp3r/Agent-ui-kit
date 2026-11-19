import type { Flow } from "@agent-kit/core";
import { X } from "lucide-react";

import { useKit } from "../../context/KitContext";
import { AnalysisTeam } from "./AnalysisTeam";

/**
 * The panel while a question is being worked on, and after one that ended without an
 * answer: however far that run got is still the reader's to go through. The header
 * names the column, not the question: that is a few centimetres to the left, and what
 * is happening is said once, by the map below.
 */
export function PanelWorking({
  question,
  flow,
  words = 0,
  seconds,
  live = true,
  onClose,
}: {
  question: string;
  flow: Flow;
  words?: number;
  /** The running clock. Absent once the run is over. */
  seconds?: number;
  live?: boolean;
  onClose: () => void;
}) {
  const { t, fmt } = useKit();
  return (
    <aside aria-label={t("panel.label")} aria-busy={live} className="panel-swap workspace-panel">
      <div className="workspace-heading" title={question}>
        <h2>{t("panel.title")}</h2>
        {live ? (
          <span className="live-badge">
            <span className="live-dot" aria-hidden="true" />
            {t("panel.live")}
          </span>
        ) : (
          <span className="ended-badge">{flow.phase === "stopped" ? t("panel.stopped") : t("panel.interrupted")}</span>
        )}
        <span className="workspace-heading-meta" data-numeric>
          {seconds !== undefined && fmt.clock(seconds)}
          {seconds !== undefined && flow.replans > 0 && " · "}
          {flow.replans > 0 && t("panel.replans", { n: flow.replans })}
        </span>
        <button type="button" aria-label={t("panel.close")} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="workspace-scroll">
        <header className="workflow-tab-head">
          <h2>{t("flow.heading")}</h2>
          <p>{live ? t("flow.liveHint") : t("flow.endedHint")}</p>
        </header>
        <AnalysisTeam flow={flow} words={words} />
      </div>
    </aside>
  );
}
