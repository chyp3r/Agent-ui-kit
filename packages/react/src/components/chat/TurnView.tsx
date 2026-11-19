import { chartOf, foldTurn, traceJson, traceMarkdown, type PanelTab, type Turn } from "@agent-kit/core";
import { useMemo } from "react";

import { useKit } from "../../context/KitContext";
import { downloadText, fileSafe } from "../../lib/download";
import { AgentPortrait } from "../agents/AgentPortrait";
import { AnswerBody } from "./AnswerBody";
import { AnswerMeta } from "./AnswerMeta";
import { ApprovalCard } from "./ApprovalCard";
import { MessageActions } from "./MessageActions";
import { PanelHandle } from "./PanelHandle";
import { TraceStrip } from "./TraceStrip";


/** One completed exchange: the question as asked, the answer as returned, and how it was reached. */
export function TurnView({
  turn,
  onOpenPanel,
  onRegenerate,
  onEdit,
  onFeedback,
  exportable = true,
}: {
  turn: Turn;
  onOpenPanel: (tab: PanelTab, tag?: string) => void;
  /** Given only on the last turn. */
  onRegenerate?: () => void;
  onEdit?: () => void;
  onFeedback?: (value: "up" | "down" | null) => void;
  exportable?: boolean;
}) {
  const { kit, locale } = useKit();
  const flow = useMemo(() => foldTurn(turn, kit), [turn, kit]);
  const sources = turn.meta?.sources ?? [];
  const chart = useMemo(() => chartOf(turn.meta?.chart, turn.answer, kit.config.answer), [turn.meta, turn.answer, kit]);
  const talk = kit.isSmallTalk(turn.meta?.category);
  return (
    <article className="turn-in turn" data-turn>
      <div className="user-bubble">{turn.question}</div>
      <div className="answer-signature">
        <AgentPortrait avatar="mascot" label={kit.brand.name} size={34} />
        <strong>{kit.brand.name}</strong>
      </div>
      <AnswerBody text={turn.answer} onTag={sources.length ? (tag) => onOpenPanel("sources", tag) : undefined} />
      {flow.approvals.map((approval) => (
        <ApprovalCard key={approval.id} approval={approval} />
      ))}
      {!talk && <PanelHandle sources={sources} chart={chart} onOpen={onOpenPanel} />}
      <AnswerMeta meta={turn.meta} />
      <MessageActions
        answer={turn.answer}
        feedback={turn.feedback}
        onRegenerate={onRegenerate}
        onEdit={onEdit}
        onFeedback={onFeedback}
        onExportJson={exportable ? () => downloadText(`${fileSafe(turn.question)}.trace.json`, traceJson(turn), "application/json") : undefined}
        onExportMarkdown={exportable ? () => downloadText(`${fileSafe(turn.question)}.md`, traceMarkdown(turn, kit, locale), "text/markdown") : undefined}
      />
      <TraceStrip flow={flow} elapsedMs={turn.elapsedMs} onOpenFlow={() => onOpenPanel("flow")} />
    </article>
  );
}
