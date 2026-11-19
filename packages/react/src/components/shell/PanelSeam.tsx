import { useCallback, type PointerEvent as ReactPointerEvent } from "react";

import { useKit } from "../../context/KitContext";
import { MIN_ROOM } from "../../lib/layout";

/** One arrow key's worth. Coarse enough to get somewhere, fine enough to aim. */
const STEP = 24;

/**
 * The seam between two panes, as something to drag.
 *
 * How much room a table needs is not a thing this side of the screen can know:
 * three columns of monthly figures and a twelve-column comparison want
 * different splits, and the reader can see which they have. So the split is
 * theirs to set.
 *
 * It is a `separator` with a value, which is what a screen reader needs to say
 * what dragging it would do, and it answers the arrow keys for anyone not
 * holding a pointer. The same seam can lie across the screen (`orientation`).
 */
export function PanelSeam({
  width,
  max,
  min = MIN_ROOM,
  label,
  edge = false,
  orientation = "vertical",
  trailing = false,
  onResize,
  onCommit,
}: {
  /** The pane's current size — the value this separator carries. */
  width: number;
  /** The largest that pane may get before its neighbour is squeezed. */
  max: number;
  /** The smallest it may get. Defaults to the reading column's floor. */
  min?: number;
  /** What a screen reader says this separator sits between. */
  label?: string;
  /** On a hairline between two surfaces: the line is the handle, and nothing
      is drawn until the pointer is on it. */
  edge?: boolean;
  /** Which way the seam lies: `vertical` sizes a column, `horizontal` a row. */
  orientation?: "vertical" | "horizontal";
  /** The pane being sized lies *after* the seam (below it, or right of it), so
      dragging toward that pane makes it smaller rather than larger. */
  trailing?: boolean;
  /** `edge` has no bar of its own: it lights the hairline it sits on. */
  onResize: (width: number) => void;
  /** The drag or the key press is over: somewhere to remember the result. It
      is handed the size that was landed on, which a key press cannot read off
      the prop it just changed. */
  onCommit: (width: number) => void;
}) {
  const { t } = useKit();
  const vertical = orientation === "vertical";
  const sign = trailing ? -1 : 1;

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      // Only the primary button, and never a second drag inside the first.
      if (event.button !== 0) return;
      event.preventDefault();
      const handle = event.currentTarget;
      const start = vertical ? event.clientX : event.clientY;
      const startWidth = width;
      handle.setPointerCapture(event.pointerId);

      let landed = startWidth;

      const move = (moved: PointerEvent) => {
        const now = vertical ? moved.clientX : moved.clientY;
        landed = startWidth + sign * (now - start);
        onResize(landed);
      };
      const done = () => {
        globalThis.removeEventListener("pointermove", move);
        globalThis.removeEventListener("pointerup", done);
        globalThis.removeEventListener("pointercancel", done);
        onCommit(landed);
      };
      // On the window rather than the handle: the capture above keeps the
      // events coming in every browser that honours it, and the ones that do
      // not still deliver them here once the pointer has left the 10px strip.
      globalThis.addEventListener("pointermove", move);
      globalThis.addEventListener("pointerup", done);
      globalThis.addEventListener("pointercancel", done);
    },
    [width, onResize, onCommit, vertical, sign],
  );

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={label ?? t("seam.label")}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onDoubleClick={() => onCommit(width)}
      onKeyDown={(event) => {
        const back = vertical ? "ArrowLeft" : "ArrowUp";
        const forth = vertical ? "ArrowRight" : "ArrowDown";
        const step = event.key === back ? -STEP : event.key === forth ? STEP : 0;
        if (!step) return;
        event.preventDefault();
        onResize(width + sign * step);
        onCommit(width + sign * step);
      }}
      className={[
        "panel-seam",
        edge ? "panel-seam-edge" : "",
        vertical ? "" : "panel-seam-horizontal",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span aria-hidden="true" />
    </div>
  );
}
