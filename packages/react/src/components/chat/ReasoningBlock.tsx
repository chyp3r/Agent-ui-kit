import { Brain, ChevronDown } from "lucide-react";
import { useState } from "react";

import { useKit } from "../../context/KitContext";

/**
 * The model's own reasoning, when the backend streams it. Open while it is arriving,
 * folded away once the answer lands; the reader can always unfold it.
 */
export function ReasoningBlock({ text, live = false }: { text: string; live?: boolean }) {
  const { t } = useKit();
  const [open, setOpen] = useState<boolean | null>(null);
  if (!text.trim()) return null;
  const expanded = open ?? live;
  return (
    <section className="reasoning-block" data-live={live || undefined}>
      <button type="button" aria-expanded={expanded} onClick={() => setOpen(!expanded)}>
        <Brain size={14} aria-hidden="true" />
        <span className={live ? "text-shimmer" : undefined}>{live ? t("reasoning.live") : t("reasoning.done")}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {expanded && <p>{text}</p>}
    </section>
  );
}
