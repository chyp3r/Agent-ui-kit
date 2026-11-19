import { Download, FileText, Pencil, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";

import { useKit } from "../../context/KitContext";
import { CopyButton } from "../primitives/CopyButton";

/**
 * What a reader can do with one answer: copy it, ask again, edit the question,
 * rate it, take the run away as a file. Every action is optional: leave a handler
 * out and its button is not drawn.
 */
export function MessageActions({
  answer,
  feedback,
  onRegenerate,
  onEdit,
  onFeedback,
  onExportJson,
  onExportMarkdown,
}: {
  answer: string;
  feedback?: "up" | "down";
  onRegenerate?: () => void;
  onEdit?: () => void;
  onFeedback?: (value: "up" | "down" | null) => void;
  onExportJson?: () => void;
  onExportMarkdown?: () => void;
}) {
  const { t } = useKit();
  return (
    <div className="message-actions" role="toolbar" aria-label={t("actions.label")}>
      <CopyButton label={t("actions.copyAnswer")} text={() => answer} />
      {onRegenerate && (
        <button type="button" onClick={onRegenerate} title={t("actions.regenerate")}>
          <RefreshCw size={14} aria-hidden="true" />
          <span>{t("actions.regenerate")}</span>
        </button>
      )}
      {onEdit && (
        <button type="button" onClick={onEdit} title={t("actions.edit")}>
          <Pencil size={14} aria-hidden="true" />
          <span>{t("actions.edit")}</span>
        </button>
      )}
      {onFeedback && (
        <span className="message-rating" role="group" aria-label={t("actions.rate")}>
          <button
            type="button"
            aria-pressed={feedback === "up"}
            aria-label={t("actions.good")}
            title={t("actions.good")}
            onClick={() => onFeedback(feedback === "up" ? null : "up")}
          >
            <ThumbsUp size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-pressed={feedback === "down"}
            aria-label={t("actions.bad")}
            title={t("actions.bad")}
            onClick={() => onFeedback(feedback === "down" ? null : "down")}
          >
            <ThumbsDown size={14} aria-hidden="true" />
          </button>
        </span>
      )}
      {onExportMarkdown && (
        <button type="button" onClick={onExportMarkdown} title={t("actions.exportMd")}>
          <FileText size={14} aria-hidden="true" />
          <span>{t("actions.exportMd")}</span>
        </button>
      )}
      {onExportJson && (
        <button type="button" onClick={onExportJson} title={t("actions.exportJson")}>
          <Download size={14} aria-hidden="true" />
          <span>{t("actions.exportJson")}</span>
        </button>
      )}
    </div>
  );
}
