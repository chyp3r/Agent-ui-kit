import type { PlanStep, RecordItem, ToolCall, Visit } from "@agent-kit/core";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";

import { useKit } from "../../context/KitContext";
import { CodeBlock } from "../primitives/CodeBlock";

function argValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function Args({ args }: { args: Record<string, unknown> }) {
  const { t } = useKit();
  const entries = Object.entries(args).filter(([, value]) => value !== null && value !== "");
  if (!entries.length) return null;
  return (
    <section className="detail-block">
      <h4>{t("detail.args")}</h4>
      <dl className="detail-args">
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt title={key}>{key}</dt>
            <dd>{argValue(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Records({ records }: { records: RecordItem[] }) {
  const { t } = useKit();
  if (!records.length) return null;
  return (
    <section className="detail-block">
      <h4>{t("detail.records")}</h4>
      <ul className="detail-records">
        {records.map((record, index) => (
          <li key={`${record.tag}-${record.time}-${index}`}>
            {record.tag && <span className="tag-chip">{record.tag}</span>}
            {record.time && <time data-numeric>{record.time}</time>}
            <p>{record.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StepIcon({ state }: { state: PlanStep["state"] }) {
  const { t } = useKit();
  if (state === "running") return <LoaderCircle size={13} className="detail-spin" aria-label={t("state.runningLower")} />;
  if (state === "failed") return <CircleAlert size={13} aria-label={t("state.failedLower")} />;
  if (state === "done") return <Check size={13} aria-label={t("state.doneLower")} />;
  return <span className="plan-pending" aria-label={t("state.pendingLower")} />;
}

export function PlanList({ plan }: { plan: PlanStep[] }) {
  const { agent } = useKit();
  if (!plan.length) return null;
  return (
    <ol className="plan-list">
      {plan.map((step) => (
        <li key={step.id} data-state={step.state}>
          <span className="plan-state">
            <StepIcon state={step.state} />
          </span>
          <p>
            <strong>{agent(step.agent).name}</strong> {step.instruction}
          </p>
        </li>
      ))}
    </ol>
  );
}

function Verdict({ visit }: { visit: Visit }) {
  const { t, fmt } = useKit();
  const verdict = visit.verdict;
  if (!verdict) return null;
  const confidence = fmt.percent(verdict.confidence);
  return (
    <section className="detail-block">
      <h4>{t("detail.verdict")}</h4>
      <dl className="detail-args">
        <div>
          <dt>{t("detail.decision")}</dt>
          <dd>{verdict.passed ? t("detail.approved") : t("detail.rejected")}</dd>
        </div>
        {confidence && (
          <div>
            <dt>{t("detail.confidence")}</dt>
            <dd data-numeric>{confidence}</dd>
          </div>
        )}
      </dl>
      {!verdict.passed && verdict.critique && <p className="detail-critique">{verdict.critique}</p>}
      {(verdict.missing ?? []).length > 0 && (
        <p className="detail-note">
          {t("detail.missing")}: {verdict.missing?.join(", ")}
        </p>
      )}
    </section>
  );
}

function Output({ call }: { call: ToolCall }) {
  const { t, renderers } = useKit();
  if (!call.output) return null;
  const render = renderers.outputs[call.outputKind] ?? renderers.outputs.text;
  return (
    <section className="detail-block">
      <h4>{t("detail.output")}</h4>
      {render({ call })}
    </section>
  );
}

/**
 * Everything the backend reported about one step, in reading order: why it ran, what
 * it was given and what it found. The raw record stays one fold away, because an
 * operator who doubts the sentence above it should be able to see the source.
 */
export function StepDetail({ visit, toolCall }: { visit: Visit; toolCall?: ToolCall }) {
  const { t, tool, kit } = useKit();
  const call = toolCall ?? visit.calls[0];
  const info = call ? tool(call.tool) : null;
  return (
    <div className="step-detail">
      {info && (
        <section className="detail-block">
          <h4>{t("detail.why")}</h4>
          <p>{info.reason}</p>
        </section>
      )}

      {visit.thought && (
        <section className="detail-block">
          <h4>{visit.node === kit.entryNode ? t("detail.thought") : t("detail.note")}</h4>
          <p>{visit.thought}</p>
        </section>
      )}

      {visit.plan.length > 0 && (
        <section className="detail-block">
          <h4>{t("detail.plan")}</h4>
          <PlanList plan={visit.plan} />
        </section>
      )}

      {call?.args && <Args args={call.args} />}

      {call?.input && (
        <section className="detail-block">
          <h4>{t("detail.input")}</h4>
          <CodeBlock code={call.input} language={call.inputLanguage} />
        </section>
      )}

      {call && <Output call={call} />}

      {call && call.state !== "running" && visit.verdict && <Verdict visit={visit} />}

      {call?.records && call.records.length > 0 && <Records records={call.records} />}

      {visit.notes.length > 0 && (
        <section className="detail-block">
          <h4>{t("detail.notes")}</h4>
          {visit.notes.map((note) => (
            <p className="detail-note" key={note}>
              {note}
            </p>
          ))}
        </section>
      )}

      {Object.keys(visit.data).length > 0 && (
        <details className="detail-raw">
          <summary>{t("detail.raw")}</summary>
          {call && <code>{call.tool}</code>}
          <pre>{JSON.stringify(visit.data, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
