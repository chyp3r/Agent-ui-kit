import type { ChartData, Source } from "@agent-kit/core";
import type { PanelTab } from "@agent-kit/core";
import { ChartNoAxesCombined, Route, ScanSearch } from "lucide-react";

import { useKit } from "../../context/KitContext";

/**
 * The one line between the argument and what stands behind it. What the reader
 * cannot see from the prose is how much there is to check and where it came from,
 * so that is what it says.
 */
export function PanelHandle({
  sources,
  chart,
  onOpen,
}: {
  sources: Source[];
  chart: ChartData | null;
  onOpen: (tab: PanelTab) => void;
}) {
  const { t, fmt } = useKit();
  const tags = new Set(sources.map((source) => source.tag).filter(Boolean)).size;
  return (
    <section className="analysis-entry">
      <p>
        {sources.length > 0 ? (
          <>
            <span data-numeric>{fmt.count(sources.length)}</span> {t("handle.sources")}
            {tags > 0 && (
              <>
                {" · "}
                <span data-numeric>{tags}</span> {t("handle.tags")}
              </>
            )}
            . {t("handle.inspect")}
          </>
        ) : (
          t("handle.howReached")
        )}
      </p>
      <div className="analysis-entry-actions">
        {sources.length > 0 && (
          <button type="button" onClick={() => onOpen("sources")}>
            <ScanSearch size={15} aria-hidden="true" />
            {t("handle.openSources")}
          </button>
        )}
        {chart && (
          <button type="button" onClick={() => onOpen("chart")}>
            <ChartNoAxesCombined size={15} aria-hidden="true" />
            {t("handle.openChart")}
          </button>
        )}
        <button type="button" onClick={() => onOpen("flow")}>
          <Route size={15} aria-hidden="true" />
          {t("handle.openFlow")}
        </button>
      </div>
    </section>
  );
}
