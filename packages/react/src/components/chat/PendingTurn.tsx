import type { Flow } from "@agent-kit/core";
import { ChevronDown, Clock3, Square } from "lucide-react";
import { useState } from "react";

import { useKit } from "../../context/KitContext";
import { statusLineOf } from "../../lib/status";
import { AnswerBody } from "./AnswerBody";
import { ApprovalCard } from "./ApprovalCard";
import { ReasoningBlock } from "./ReasoningBlock";
import { ThoughtStream } from "./ThoughtStream";

/**
 * The question while it is being worked on.
 *
 * The card's line says what the team is doing, in words, from what the backend
 * reported; the frame's travelling light says that it is still going. Under it the
 * thinking so far, and under that the report as soon as it starts to arrive.
 */
export function PendingTurn({
  question,
  flow,
  text,
  seconds,
  onCancel,
  onOpenPanel,
  onApproval,
}: {
  question: string;
  flow: Flow;
  text: string;
  seconds: number;
  onCancel: () => void;
  onOpenPanel: () => void;
  onApproval?: (id: string, decision: "approved" | "rejected") => void;
}) {
  const { t, fmt } = useKit();
  const status = statusLineOf(flow, useKit());
  const [open, setOpen] = useState(true);
  const thought = flow.current?.thought;
  return (
    <article className="turn-in turn" aria-busy="true">
      <div className="user-bubble">{question}</div>
      <div className="pending-card" aria-live="polite">
        <div className="pending-orbit" aria-hidden="true" />
        <div className="pending-copy">
          <strong className="text-shimmer">{status.title}</strong>
          <span>
            {status.detail}
            {thought ? ` · ${thought}` : ""}
          </span>
        </div>
        <div className="pending-controls">
          <span title={t("pending.sinceSent")}>
            <Clock3 size={13} aria-hidden="true" />
            <span data-numeric>{fmt.clock(seconds)}</span>
          </span>
          <button type="button" onClick={onCancel}>
            <Square size={12} aria-hidden="true" /> {t("pending.stop")}
          </button>
        </div>
      </div>

      <ReasoningBlock text={flow.reasoning} live={!text} />

      {flow.visits.length > 0 && (
        <section className="thought-panel">
          <button type="button" className="thought-toggle" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
            <span className="section-eyebrow">{t("thought.title")}</span>
            <span className="thought-toggle-count" data-numeric>
              {t("thought.steps", { n: flow.visits.length })}
            </span>
            <ChevronDown size={15} aria-hidden="true" />
          </button>
          {open && <ThoughtStream flow={flow} onOpenFlow={onOpenPanel} />}
        </section>
      )}

      {flow.approvals.map((approval) => (
        <ApprovalCard key={approval.id} approval={approval} onRespond={onApproval} />
      ))}

      {text && <AnswerBody text={text} streaming />}
    </article>
  );
}
