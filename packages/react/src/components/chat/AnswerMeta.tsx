import type { RunMeta } from "@agent-kit/core";

import { useKit } from "../../context/KitContext";

/**
 * How far to trust this answer, in one line: the reviewer's verdict, its confidence
 * and what kind of answer it is. The dot reads first, the word is there because a
 * colour alone is not an accessible signal.
 */
export function AnswerMeta({ meta }: { meta: RunMeta | null }) {
  const { t, kit, category: categoryLabel, fmt } = useKit();
  const talk = kit.isSmallTalk(meta?.category);
  const verified = meta?.verified;
  const confidence = fmt.percent(meta?.confidence);
  const category = categoryLabel(meta?.category);
  if (talk || (verified === undefined && !category)) return null;
  return (
    <div className="answer-meta">
      {verified !== undefined && (
        <span className="answer-trust" data-verified={verified}>
          <span className="answer-dot" aria-hidden="true" />
          <span>{verified ? t("meta.verified") : t("meta.unverified")}</span>
          {confidence && <span data-numeric>{confidence}</span>}
        </span>
      )}
      {category && <span className="answer-category">{category}</span>}
    </div>
  );
}
