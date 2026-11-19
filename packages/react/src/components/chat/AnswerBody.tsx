import { parseAnswer } from "@agent-kit/core";
import { useMemo } from "react";

import { useKit } from "../../context/KitContext";
import { Markdown } from "./Markdown";

/**
 * The report as blocks, each drawn by the renderer registered for its kind. Unknown
 * kinds fall back to markdown of their text, so a block your parser makes but nobody
 * renders yet still shows something.
 */
export function AnswerBody({
  text,
  streaming = false,
  onTag,
}: {
  text: string;
  streaming?: boolean;
  onTag?: (tag: string) => void;
}) {
  const { kit, renderers } = useKit();
  const blocks = useMemo(() => parseAnswer(text, streaming, kit.config.answer), [text, streaming, kit]);
  return (
    <div className="md-prose answer-body">
      {blocks.map((block, index) => {
        const render = renderers.blocks[block.kind];
        if (render) return <div key={index} className="answer-block">{render({ block, streaming, onTag })}</div>;
        const fallback = (block as { text?: string }).text;
        return fallback ? <Markdown key={index} text={fallback} /> : null;
      })}
      {streaming && <span className="answer-caret" aria-hidden="true" />}
    </div>
  );
}
