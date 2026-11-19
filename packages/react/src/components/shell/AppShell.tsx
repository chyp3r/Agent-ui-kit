import { PanelLeft, PanelRight, SquarePen } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { useKit } from "../../context/KitContext";
import {
  clampRoom,
  clampSidebar,
  loadRoomWidth,
  loadSidebarWidth,
  MAX_SIDEBAR,
  MIN_ROOM,
  MIN_SIDEBAR,
  saveRoomWidth,
  saveSidebarWidth,
} from "../../lib/layout";
import { BrandMark } from "./BrandMark";
import { PanelSeam } from "./PanelSeam";

const DESKTOP = "(min-width: 1024px)";

/** The seam, and the gap the analysis floats in: chrome, not column. */
const CHROME = 20;

/**
 * Three columns: the edge, the conversation and the evidence. There is no title bar:
 * the conversation reaches the top of the window, and the third column has no width
 * until something opens it, so a reader who never does never pays for it in measure.
 */
export function AppShell({
  started,
  sidebar,
  panel,
  panelAvailable,
  panelExpanded,
  onTogglePanel,
  onClosePanel,
  onNew,
  children,
}: {
  started: boolean;
  sidebar: (close: () => void) => ReactNode;
  panel: ReactNode;
  panelAvailable: boolean;
  panelExpanded: boolean;
  onTogglePanel: () => void;
  onClosePanel: () => void;
  onNew: () => void;
  children: ReactNode;
}) {
  const { t } = useKit();
  const [open, setOpen] = useState(() => globalThis.matchMedia?.(DESKTOP).matches ?? true);
  const frame = useRef<HTMLDivElement>(null);
  const [roomWidth, setRoomWidth] = useState(loadRoomWidth);
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const [resizing, setResizing] = useState(false);
  const sidebarNow = useRef(sidebarWidth);
  const room = useRef(roomWidth);

  // The stored split is a wish, not a fact: it may come from a wider window than this
  // one, and the panel must never be pushed off the screen by it.
  const [frameWidth, setFrameWidth] = useState(() => globalThis.innerWidth ?? 1440);
  useEffect(() => {
    const measure = () => setFrameWidth(frame.current?.clientWidth ?? globalThis.innerWidth ?? 1440);
    measure();
    globalThis.addEventListener("resize", measure);
    return () => globalThis.removeEventListener("resize", measure);
  }, []);
  const shownRoom = clampRoom(roomWidth, frameWidth - (open ? sidebarWidth : 52) - CHROME);

  const available = () =>
    (frame.current?.clientWidth ?? globalThis.innerWidth ?? 1440) - (open ? sidebarNow.current : 52) - CHROME;

  const resize = useCallback(
    (width: number) => {
      setRoomWidth((current) => {
        const next = clampRoom(width, available());
        room.current = next;
        return next === current ? current : next;
      });
    },
    [open],
  );

  const resizeSidebar = useCallback((width: number) => {
    const next = clampSidebar(width);
    sidebarNow.current = next;
    setResizing(true);
    setSidebarWidth(next);
  }, []);

  return (
    <div
      ref={frame}
      className="app-frame"
      style={{ "--room-w": `${shownRoom}px`, "--sidebar-w": `${sidebarWidth}px` } as CSSProperties}
    >
      {open && <div aria-hidden="true" onClick={() => setOpen(false)} className="scrim-in scrim lg:hidden" />}

      {!open && (
        <nav
          aria-label={t("sidebar.workspace")}
          className="sidebar-rail rail-in"
          onClick={(event) => {
            if (!(event.target as HTMLElement).closest("button")) setOpen(true);
          }}
        >
          <BrandMark className="sidebar-mark" />
          <button type="button" onClick={() => setOpen(true)} aria-label={t("sidebar.open")} title={t("sidebar.open")} className="sidebar-icon-button">
            <PanelLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onNew();
            }}
            disabled={!started}
            aria-label={t("sidebar.new")}
            title={t("sidebar.new")}
            className="sidebar-icon-button"
          >
            <SquarePen size={18} aria-hidden="true" />
          </button>
        </nav>
      )}

      <div
        aria-hidden={open ? undefined : "true"}
        inert={open ? undefined : true}
        data-resizing={resizing || undefined}
        data-open={open}
        className="sidebar-slot"
      >
        <div className="sidebar-slot-inner">{sidebar(() => setOpen(false))}</div>
      </div>

      {open && (
        <div className="hidden lg:flex">
          <PanelSeam
            width={sidebarWidth}
            min={MIN_SIDEBAR}
            max={MAX_SIDEBAR}
            label={t("sidebar.width")}
            edge
            onResize={resizeSidebar}
            onCommit={() => {
              setResizing(false);
              saveSidebarWidth(sidebarNow.current);
            }}
          />
        </div>
      )}

      <div className="room" data-panel={panel ? true : undefined} data-expanded={panelExpanded || undefined}>
        {panelAvailable && !panel && (
          <div className="room-actions">
            <button type="button" onClick={onTogglePanel} aria-label={t("panel.open")} title={t("panel.open")}>
              <PanelRight size={18} aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="room-column">{children}</div>
      </div>

      {panel && (
        <>
          <div aria-hidden="true" onClick={onClosePanel} className="scrim-in scrim-panel xl:hidden" />
          <div className={panelExpanded ? "hidden" : "hidden xl:flex"}>
            <PanelSeam
              width={shownRoom}
              max={Math.max(MIN_ROOM, available() - 400)}
              onResize={resize}
              onCommit={() => saveRoomWidth(room.current)}
            />
          </div>
          <div data-expanded={panelExpanded || undefined} className="panel-in panel-frame">
            {panel}
          </div>
        </>
      )}
    </div>
  );
}
