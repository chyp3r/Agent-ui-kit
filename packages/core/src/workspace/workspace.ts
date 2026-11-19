export type PanelTab = "flow" | "sources" | "chart";

/**
 * What the side panel is showing, owned by the screen.
 *
 * One turn at a time. `turnIndex` is null while a question is in flight: the panel is
 * then showing the work, not a result. A reader who steps back to an earlier turn
 * stays there when the running one lands.
 */
export interface Workspace {
  turnIndex: number | null;
  tab: PanelTab;
  /** A source tag the reader followed here from the answer. */
  tag?: string;
  /** Bumped by every way in from the answer: following the same tag again is a new start. */
  pick?: number;
  open: boolean;
}

export const CLOSED: Workspace = { turnIndex: null, tab: "flow", open: false };

export function startTurn(openImmediately: boolean): Workspace {
  return { turnIndex: null, tab: "flow", open: openImmediately };
}

/** A specialist started, so there is work to watch. It opens once: closing it stays closed. */
export function openForWork(current: Workspace): Workspace {
  return { ...current, open: true };
}

/** The answer landed. A reader who stepped back to an earlier turn stays where they were. */
export function settleWithAnswer(current: Workspace, turnIndex: number): Workspace {
  return { ...current, turnIndex: current.turnIndex ?? turnIndex };
}

export function openTurn(current: Workspace, turnIndex: number, tab: PanelTab = current.tab, tag?: string): Workspace {
  return { turnIndex, tab, tag, pick: (current.pick ?? 0) + 1, open: true };
}

/** Back to the question still being worked on. */
export function showLive(current: Workspace): Workspace {
  return { ...current, turnIndex: null, tag: undefined, open: true };
}

export function setTab(current: Workspace, tab: PanelTab): Workspace {
  return { ...current, tab, tag: tab === "sources" ? current.tag : undefined };
}

export function closePanel(current: Workspace): Workspace {
  return { ...current, open: false };
}

/** A panel may not name a turn that is no longer on screen. */
export function clampToTurns(current: Workspace, turnCount: number): Workspace {
  if (current.turnIndex === null) return current;
  return current.turnIndex < turnCount ? current : CLOSED;
}
