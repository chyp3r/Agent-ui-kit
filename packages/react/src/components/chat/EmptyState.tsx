import { ArrowUpRight, BarChart3, Clock3, Search, ShieldCheck, type LucideIcon } from "lucide-react";

import { useKit } from "../../context/KitContext";
import { AgentPortrait } from "../agents/AgentPortrait";

export interface Suggestion {
  question: string;
  title: string;
  hint: string;
  icon?: LucideIcon;
}

/**
 * The first viewport. Whoever opens this does not yet know what it can be asked, so
 * the examples are the interface teaching itself. Pass your own `suggestions`.
 */
export function EmptyState({
  onPick,
  disabled,
  suggestions,
  title,
  subtitle,
}: {
  onPick: (question: string) => void;
  disabled?: boolean;
  suggestions?: Suggestion[];
  title?: string;
  subtitle?: string;
}) {
  const { t, kit, agent } = useKit();
  const examples = suggestions ?? [
    { icon: Search, question: t("empty.q1"), title: t("empty.t1"), hint: t("empty.h1") },
    { icon: Clock3, question: t("empty.q2"), title: t("empty.t2"), hint: t("empty.h2") },
    { icon: BarChart3, question: t("empty.q3"), title: t("empty.t3"), hint: t("empty.h3") },
    { icon: ShieldCheck, question: t("empty.q4"), title: t("empty.t4"), hint: t("empty.h4") },
  ];
  const team = kit.config.agents.slice(0, 7);
  return (
    <div className="empty-state">
      <div className="enter-1 empty-hero">
        <AgentPortrait avatar="mascot" label={kit.brand.name} size={124} active className="empty-mascot" />
        <div>
          <p>{t("empty.hello")}</p>
          <h2>{title ?? t("empty.title")}</h2>
          <span>{subtitle ?? t("empty.subtitle")}</span>
        </div>
      </div>

      {team.length > 0 && (
        <div className="enter-2 empty-team" aria-hidden="true">
          {team.map((def) => (
            <AgentPortrait key={def.node} avatar={kit.avatarOf(def.node)} label={agent(def.node).name} size={40} />
          ))}
          <span>{team.map((def) => agent(def.node).name).join(" · ")}</span>
        </div>
      )}

      <div className="enter-3 empty-examples">
        {examples.map(({ icon: Icon = Search, question, title: label, hint }) => (
          <button key={question} type="button" disabled={disabled} onClick={() => onPick(question)} title={question}>
            <span className="empty-example-icon" aria-hidden="true">
              <Icon size={16} />
            </span>
            <span className="empty-example-copy">
              <strong>{label}</strong>
              <small>{hint}</small>
            </span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
