import { Maximize2, Minimize2, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { chartOf, foldTurn, type PanelTab, type Turn, type Workspace } from "@agent-kit/core";

import { useKit } from "../../context/KitContext";
import { ChartPanel } from "../analysis/ChartPanel";
import { SourceList } from "../analysis/SourceList";
import { AnalysisTeam } from "./AnalysisTeam";

const TABS: { id: PanelTab; key: "tab.flow" | "tab.sources" | "tab.chart" }[] = [
  { id: "flow", key: "tab.flow" },
  { id: "sources", key: "tab.sources" },
  { id: "chart", key: "tab.chart" },
];

/**
 * Where an answer is read down to its source. The conversation column carries the
 * argument; this carries how it was reached, the records behind it and its chart.
 */
export function WorkspacePanel({
  turn,
  workspace,
  onTab,
  onClose,
  expanded,
  onToggleExpanded,
}: {
  turn: Turn;
  workspace: Workspace;
  onTab: (tab: PanelTab) => void;
  onClose: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const { t, kit } = useKit();
  const flow = useMemo(() => foldTurn(turn, kit), [turn, kit]);
  const sources = turn.meta?.sources ?? [];
  const chart = useMemo(() => chartOf(turn.meta?.chart, turn.answer, kit.config.answer), [turn.meta, turn.answer, kit]);

  const available = TABS.filter((tab) => tab.id === "flow" || (tab.id === "sources" ? sources.length > 0 : chart !== null));
  // The reader's tab is kept unless this turn cannot fill it.
  const active: PanelTab = available.some((tab) => tab.id === workspace.tab) ? workspace.tab : "flow";

  const tablist = useRef<HTMLDivElement | null>(null);
  // One underline that travels between the tabs: the same mark throughout, so the
  // eye keeps hold of where the panel just was.
  const [marker, setMarker] = useState<{ x: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const list = tablist.current;
    const selected = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !selected) return;
    setMarker({ x: selected.offsetLeft - list.scrollLeft, width: selected.offsetWidth });
  }, [active, available.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // The open step is a layer above the panel: Escape takes that first.
      if (event.key === "Escape" && !document.querySelector(".workflow-inspector")) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside aria-label={t("panel.label")} className="panel-swap workspace-panel">
      <div className="workspace-heading" title={turn.question}>
        <h2>{t("panel.title")}</h2>
        <span className="workspace-heading-question">{turn.question}</span>
        <button
          type="button"
          className="hidden xl:grid"
          aria-label={expanded ? t("panel.shrink") : t("panel.expand")}
          aria-pressed={expanded}
          onClick={onToggleExpanded}
        >
          {expanded ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
        </button>
        <button type="button" aria-label={t("panel.close")} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div ref={tablist} role="tablist" className="workspace-tabs">
        {marker && (
          <span
            aria-hidden="true"
            className="workspace-tab-marker"
            style={{ width: `${marker.width}px`, transform: `translateX(${marker.x}px)` }}
          />
        )}
        {available.map((tab) => (
          <button key={tab.id} type="button" role="tab" aria-selected={active === tab.id} onClick={() => onTab(tab.id)}>
            {t(tab.key)}
            {tab.id === "sources" && <span data-numeric>{sources.length}</span>}
          </button>
        ))}
      </div>

      <div className="workspace-scroll panel-swap" key={active}>
        {active === "flow" && (
          <>
            <header className="workflow-tab-head">
              <h2>{t("flow.heading")}</h2>
              <p>{t("flow.doneHint")}</p>
            </header>
            <AnalysisTeam flow={flow} />
          </>
        )}
        {active === "sources" && <SourceList key={workspace.pick} sources={sources} tag={workspace.tag} />}
        {active === "chart" && chart && <ChartPanel chart={chart} />}
      </div>
    </aside>
  );
}
