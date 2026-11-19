import { useEffect, useRef } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";

/**
 * When a turn completes, show the answer under its question.
 *
 * The conversation sticks to the bottom while a turn is running so the live
 * tool stream stays in view. The finished turn is much taller than the
 * viewport (answer, table, chart, figures, sources), so sticking to the bottom
 * would land the reader at the end of the analysis panel. Once the turn count
 * grows, the stick is released and the newest turn's top is brought into view;
 * the reader scrolls down into the evidence at their own pace.
 */
export function AnchorToAnswer({ turns }: { turns: number }) {
  const { stopScroll, contentRef } = useStickToBottomContext();
  const seen = useRef(turns);

  useEffect(() => {
    const grew = turns > seen.current;
    seen.current = turns;
    if (!grew) return;
    const articles = contentRef.current?.querySelectorAll<HTMLElement>("article[data-turn]");
    const latest = articles?.[articles.length - 1];
    // Guarded because jsdom has no scrollIntoView.
    if (latest && typeof latest.scrollIntoView === "function") {
      stopScroll();
      latest.scrollIntoView({ block: "start" });
    }
  }, [turns, contentRef, stopScroll]);

  return null;
}
