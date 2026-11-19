import type { Flow } from "@agent-kit/core";
import { CircleAlert, OctagonPause, RotateCcw } from "lucide-react";

import { useKit } from "../../context/KitContext";
import { AnswerBody } from "./AnswerBody";
import { ThoughtStream } from "./ThoughtStream";

/**
 * A question that did not end in an answer keeps its place on screen, along with
 * however far the run got and whatever of the report had been written: a stop is the
 * reader's own act and reads as one, a failure says what went wrong. Nothing here
 * retries on its own, since each attempt spends model time.
 */
export function TurnError({
  question,
  message,
  detail,
  stopped = false,
  flow,
  partial,
  onRetry,
}: {
  question: string;
  message: string;
  detail?: string;
  stopped?: boolean;
  flow?: Flow;
  /** The report as far as it had arrived. */
  partial?: string;
  onRetry?: () => void;
}) {
  const { t } = useKit();
  const Icon = stopped ? OctagonPause : CircleAlert;
  return (
    <article className="turn-in turn">
      {question && <div className="user-bubble">{question}</div>}
      {flow && flow.visits.length > 0 && (
        <section className="thought-panel">
          <div className="thought-toggle" aria-hidden="true">
            <span className="section-eyebrow">{t("thought.title")}</span>
          </div>
          <ThoughtStream flow={flow} />
        </section>
      )}
      {partial && <AnswerBody text={partial} />}
      <div className="turn-error" data-stopped={stopped || undefined} role={stopped ? "status" : "alert"}>
        <Icon size={18} aria-hidden="true" />
        <div>
          <strong>{message}</strong>
          {detail && <p>{detail}</p>}
          {onRetry && (
            <button type="button" onClick={onRetry}>
              <RotateCcw size={13} aria-hidden="true" />
              {t("error.retry")}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
