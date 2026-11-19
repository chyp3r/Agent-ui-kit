import type { Flow } from "@agent-kit/core";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { useKit } from "../../context/KitContext";
import { ReasoningBlock } from "./ReasoningBlock";
import { ThoughtStream } from "./ThoughtStream";

/**
 * What the answer took, and the thinking behind it, one click away. The run does
 * not disappear when the answer lands: this is where it folds to.
 */
export function TraceStrip({
  flow,
  elapsedMs,
  onOpenFlow,
}: {
  flow: Flow;
  elapsedMs: number | null;
  onOpenFlow: () => void;
}) {
  const { t, fmt } = useKit();
  const [open, setOpen] = useState(false);
  if (!flow.visits.length && !flow.reasoning) return null;
  const agents = new Set(flow.visits.map((visit) => visit.node)).size;
  return (
    <section className="run-footer" aria-label={t("trace.label")}>
      <button type="button" className="run-summary-trigger" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <strong>{t("trace.label")}</strong>
        {elapsedMs !== null && <span data-numeric>{fmt.duration(elapsedMs)}</span>}
        <span>
          <b data-numeric>{agents}</b> {t("trace.agents")}
        </span>
        <span>
          <b data-numeric>{flow.calls.length}</b> {t("trace.tools")}
        </span>
        {flow.replans > 0 && (
          <span className="run-warning">
            <b data-numeric>{flow.replans}</b> {t("trace.replans")}
          </span>
        )}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <>
          <ReasoningBlock text={flow.reasoning} />
          <ThoughtStream flow={flow} onOpenFlow={onOpenFlow} />
        </>
      )}
    </section>
  );
}
