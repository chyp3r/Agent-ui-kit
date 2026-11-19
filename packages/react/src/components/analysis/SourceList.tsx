import type { Source } from "@agent-kit/core";
import { Database, FileText, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { useKit } from "../../context/KitContext";

/**
 * The sources behind one answer, as the backend listed them. A source with no tag or
 * time says which agent found it instead of inventing either.
 */
export function SourceList({ sources, tag }: { sources: Source[]; tag?: string }) {
  const { t, agent, fmt } = useKit();
  const [query, setQuery] = useState("");
  // The panel remounts this for each turn and each tag followed from the answer,
  // so a filter from one never hides another's sources.
  const [selected, setSelected] = useState<string | null>(tag ?? null);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const source of sources) {
      if (source.tag) counts.set(source.tag, (counts.get(source.tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [sources]);

  const needle = fmt.fold(query.trim());
  const shown = sources.filter(
    (source) =>
      (!selected || source.tag === selected) && (!needle || fmt.fold(`${source.text} ${source.tag ?? ""}`).includes(needle)),
  );

  return (
    <section className="sources">
      <header className="sources-head">
        <h2>{t("sources.title")}</h2>
        <p>
          <span data-numeric>{fmt.count(sources.length)}</span> {t("sources.records")}
          {tags.length > 0 && (
            <>
              {" · "}
              <span data-numeric>{tags.length}</span> {t("sources.tags")}
            </>
          )}
        </p>
      </header>

      {sources.length > 5 && (
        <div className="sources-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder={t("sources.search")}
            aria-label={t("sources.search")}
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button type="button" aria-label={t("search.clear")} onClick={() => setQuery("")}>
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {tags.length > 1 && (
        <div className="sources-tags" role="group" aria-label={t("sources.filter")}>
          <button type="button" aria-pressed={selected === null} onClick={() => setSelected(null)}>
            {t("sources.all")}
          </button>
          {tags.map(([name, count]) => (
            <button key={name} type="button" aria-pressed={selected === name} onClick={() => setSelected(selected === name ? null : name)}>
              {name} <span data-numeric>{count}</span>
            </button>
          ))}
        </div>
      )}

      <ol className="sources-list">
        {shown.map((source) => {
          const confidence = fmt.percent(source.confidence);
          const Icon = source.agent === "analyst" ? Database : FileText;
          return (
            <li key={source.id}>
              <div className="sources-line">
                {source.tag ? (
                  <span className="tag-chip">{source.tag}</span>
                ) : (
                  <span className="sources-source">
                    <Icon size={13} aria-hidden="true" />
                    {agent(source.agent).name}
                  </span>
                )}
                {source.time && <time data-numeric>{source.time}</time>}
                {confidence && (
                  <span className="sources-confidence" title={t("sources.confidence")} data-numeric>
                    {confidence}
                  </span>
                )}
              </div>
              {source.text ? <p>{source.text}</p> : <p className="sources-empty">{t("sources.noText")}</p>}
            </li>
          );
        })}
        {shown.length === 0 && <li className="sources-none">{t("sources.none")}</li>}
      </ol>
    </section>
  );
}
