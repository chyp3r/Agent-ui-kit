import { PanelLeft, Search, SquarePen, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { SessionSummary } from "@agent-kit/core";

import { useKit } from "../../context/KitContext";
import { ThemeToggle } from "../primitives/ThemeToggle";
import { BrandMark } from "./BrandMark";

export type SystemStatus = "checking" | "online" | "busy" | "offline";

type Band = "today" | "yesterday" | "week" | "older";

const DAY = 86_400_000;

function bucketOf(createdAt: string, now: number): Band {
  const stamp = Date.parse(createdAt);
  if (Number.isNaN(stamp)) return "older";
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  if (stamp >= midnight) return "today";
  if (stamp >= midnight - DAY) return "yesterday";
  if (stamp >= midnight - 7 * DAY) return "week";
  return "older";
}

const BAND_ORDER: Band[] = ["today", "yesterday", "week", "older"];

function groupByRecency(sessions: SessionSummary[]): { band: Band; rows: SessionSummary[] }[] {
  const now = Date.now();
  const bands = new Map<Band, SessionSummary[]>();
  for (const session of sessions) {
    const band = bucketOf(session.created_at, now);
    bands.set(band, [...(bands.get(band) ?? []), session]);
  }
  return BAND_ORDER.filter((band) => bands.has(band)).map((band) => ({ band, rows: bands.get(band) ?? [] }));
}

/**
 * The edge of the workspace: the mark, a new analysis, a way to find an old one and
 * whether the system answered. There is no account: every browser on this stack
 * sees the same history, as it always has.
 */
export function Sidebar({
  status,
  started,
  busy,
  sessions,
  activeId,
  onNew,
  onSelect,
  onDelete,
  onClose,
}: {
  status: SystemStatus;
  started: boolean;
  busy: boolean;
  sessions: SessionSummary[];
  activeId: string;
  onNew: () => void;
  onSelect: (session: SessionSummary) => void;
  onDelete: (session: SessionSummary) => void;
  onClose: () => void;
}) {
  const { t, kit, fmt } = useKit();
  const [query, setQuery] = useState("");
  // Deleting cannot be undone, so the row asks in its own place first.
  const [confirming, setConfirming] = useState<string | null>(null);
  const needle = fmt.fold(query.trim());
  const matches = useMemo(
    () => (needle ? sessions.filter((row) => fmt.fold(row.title).includes(needle)) : sessions),
    [sessions, needle],
  );
  const bands = groupByRecency(matches);

  return (
    <aside aria-label={t("sidebar.workspace")} className="sidebar">
      <div className="sidebar-head">
        <BrandMark className="sidebar-mark" />
        <span className="sidebar-wordmark">
          {kit.brand.name}
          {kit.brand.subtitle && <small>{kit.brand.subtitle}</small>}
        </span>
        <button type="button" onClick={onClose} aria-label={t("sidebar.close")} title={t("sidebar.close")} className="sidebar-icon-button ml-auto">
          <PanelLeft size={18} aria-hidden="true" />
        </button>
      </div>

      <button type="button" onClick={onNew} disabled={!started} className="sidebar-action">
        <SquarePen size={16} aria-hidden="true" />
        {t("sidebar.new")}
      </button>

      {sessions.length > 0 && (
        <div className="sidebar-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("sidebar.search")}
            aria-label={t("sidebar.search")}
            spellCheck={false}
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label={t("search.clear")} title={t("search.clear")}>
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <nav className="sidebar-history" aria-label={t("sidebar.history")}>
        {bands.map(({ band, rows }) => (
          <section key={band}>
            <h2>{t(`band.${band}` as const)}</h2>
            <ol>
              {rows.map((session) => (
                <li key={session.session_id} data-confirming={confirming === session.session_id || undefined}>
                  {confirming === session.session_id ? (
                    <div className="sidebar-confirm" role="group" aria-label={t("sidebar.confirmFor", { title: session.title })}>
                      <span>{t("sidebar.confirm")}</span>
                      <button
                        type="button"
                        data-danger
                        onClick={() => {
                          setConfirming(null);
                          onDelete(session);
                        }}
                      >
                        {t("sidebar.delete")}
                      </button>
                      <button type="button" onClick={() => setConfirming(null)}>
                        {t("sidebar.cancel")}
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        aria-current={session.session_id === activeId ? "page" : undefined}
                        onClick={() => onSelect(session)}
                        title={session.title}
                      >
                        <span>{session.title}</span>
                      </button>
                      <button
                        type="button"
                        className="sidebar-history-delete"
                        aria-label={t("sidebar.deleteFor", { title: session.title })}
                        title={t("sidebar.deleteTitle")}
                        disabled={busy}
                        onClick={() => setConfirming(session.session_id)}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}
        {sessions.length > 0 && matches.length === 0 && (
          <p className="sidebar-history-empty">{t("sidebar.noMatch", { query: query.trim() })}</p>
        )}
        {sessions.length === 0 && <p className="sidebar-history-empty">{t("sidebar.empty")}</p>}
      </nav>

      <div className="sidebar-foot" role="status">
        <span className="status-dot" data-status={status} aria-hidden="true" />
        <span>{t(`status.${status}` as const)}</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
