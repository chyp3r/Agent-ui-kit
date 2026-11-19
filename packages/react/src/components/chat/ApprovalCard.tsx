import type { Approval } from "@agent-kit/core";
import { Check, ShieldQuestion, X } from "lucide-react";

import { useKit } from "../../context/KitContext";

function valueText(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * The run is waiting on a person: an action it will not take on its own. Approve or
 * reject goes back to the backend through `adapter.respond`; without that method the
 * card only informs.
 */
export function ApprovalCard({
  approval,
  onRespond,
}: {
  approval: Approval;
  onRespond?: (id: string, decision: "approved" | "rejected") => void;
}) {
  const { t } = useKit();
  const pending = approval.state === "pending";
  const entries = Object.entries(approval.payload);
  return (
    <section className="approval-card" data-state={approval.state} role={pending ? "alertdialog" : "status"} aria-label={approval.title}>
      <header>
        <ShieldQuestion size={18} aria-hidden="true" />
        <div>
          <strong>{approval.title}</strong>
          {approval.description && <p>{approval.description}</p>}
        </div>
      </header>
      {entries.length > 0 && (
        <dl className="detail-args">
          {entries.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{valueText(value)}</dd>
            </div>
          ))}
        </dl>
      )}
      {pending && onRespond ? (
        <div className="approval-actions">
          <button type="button" data-approve onClick={() => onRespond(approval.id, "approved")}>
            <Check size={14} aria-hidden="true" />
            {t("approval.approve")}
          </button>
          <button type="button" onClick={() => onRespond(approval.id, "rejected")}>
            <X size={14} aria-hidden="true" />
            {t("approval.reject")}
          </button>
        </div>
      ) : (
        <p className="approval-state">
          {pending ? t("approval.waiting") : approval.state === "approved" ? t("approval.approved") : t("approval.rejected")}
        </p>
      )}
    </section>
  );
}
