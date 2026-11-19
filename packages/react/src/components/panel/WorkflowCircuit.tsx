import { useEffect, useRef } from "react";

/**
 * The connective tissue of the agent workflow, drawn as a live circuit.
 *
 * The stages, the agents and the tool nodes are DOM; everything *between* them
 * is this canvas. It measures the laid-out positions of those elements, draws
 * the traces that join them, and sends a charge down a trace only while the
 * step it belongs to is actually running — the handoff the stream marked
 * active, the tool call that has not come back yet. Nothing here invents
 * activity: every lit path is a `data-state` the React tree already rendered.
 *
 * Positions are read from the offset chain rather than `getBoundingClientRect`,
 * so the entrance animations and the viewport's own pan/zoom transform cannot
 * drag the traces off their nodes.
 */

interface Cubic {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;
}

type TraceKind = "spine" | "branch" | "lead";

interface Trace {
  curve: Cubic;
  kind: TraceKind;
  /** The element whose data attributes say whether this path is carrying work. */
  source: HTMLElement | null;
  /** Where the charge starts along the path, so packets do not march in lockstep. */
  offset: number;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Layout position within `root`, ignoring every transform on the way up. */
function offsetBox(element: HTMLElement, root: HTMLElement): Box {
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = element;
  while (node && node !== root) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { left, top, width: element.offsetWidth, height: element.offsetHeight };
}

const centerX = (box: Box) => box.left + box.width / 2;
const centerY = (box: Box) => box.top + box.height / 2;

function straight(x0: number, y0: number, x3: number, y3: number): Cubic {
  return {
    x0,
    y0,
    x1: x0 + (x3 - x0) / 3,
    y1: y0 + (y3 - y0) / 3,
    x2: x0 + ((x3 - x0) * 2) / 3,
    y2: y0 + ((y3 - y0) * 2) / 3,
    x3,
    y3,
  };
}

/** An L-shaped join, rounded the way a drawn trace turns rather than a mitre. */
function elbow(x0: number, y0: number, x3: number, y3: number): Cubic {
  const bend = Math.min(Math.abs(x3 - x0) * 0.55, 26);
  return {
    x0,
    y0,
    x1: x0 + bend,
    y1: y0,
    x2: x3 - bend,
    y2: y3,
    x3,
    y3,
  };
}

function pointAt(curve: Cubic, t: number): [number, number] {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * curve.x0 + b * curve.x1 + c * curve.x2 + d * curve.x3,
    a * curve.y0 + b * curve.y1 + c * curve.y2 + d * curve.y3,
  ];
}

type TraceState = "idle" | "done" | "failed" | "live";

function traceState(trace: Trace): TraceState {
  const source = trace.source;
  if (!source) return "idle";
  if (trace.kind === "spine") {
    return source.dataset.active === "true" ? "live" : "done";
  }
  const state = source.dataset.state;
  if (state === "running") return "live";
  if (state === "failed") return "failed";
  // `visited` is an agent that finished, `done` a tool call that came back.
  if (state === "done" || state === "visited") return "done";
  return "idle";
}

interface Palette {
  primary: string;
  accent: string;
  border: string;
  destructive: string;
  card: string;
}

function readPalette(element: HTMLElement): Palette {
  const styles = getComputedStyle(element);
  const value = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  return {
    primary: value("--primary", "#1f2937"),
    accent: value("--accent", "#f97316"),
    border: value("--border", "#e5e7eb"),
    destructive: value("--destructive", "#dc2626"),
    card: value("--card", "#ffffff"),
  };
}

/** How far into its journey a packet is, given the clock and the trace. */
function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

// Slow enough to read as a current rather than a flicker: the diagram is
// background to the answer, not the thing being watched.
const SPINE_MS = 2300;
const LEAD_MS = 1700;
const TAIL = 5;
/** The single charge that runs the finished spine once the answer is in. */
const ARRIVAL_MS = 1300;

export function WorkflowCircuit({ revision }: { revision: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tracesRef = useRef<Trace[]>([]);
  const frameRef = useRef<number | null>(null);
  // The one authored moment: when the last running step goes quiet, a single
  // charge runs the whole spine end to end — the work reaching the answer —
  // and then the graph is still. It fires on the transition, never on a
  // re-measure, so re-opening a finished analysis does not replay it.
  const arrivalRef = useRef<number | null>(null);
  const wasLiveRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = canvas?.parentElement as HTMLElement | null;
    if (!canvas || !root) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let palette = readPalette(root);
    let visible = true;

    const measure = () => {
      const traces: Trace[] = [];
      const stages = [
        ...root.querySelectorAll<HTMLElement>(".workflow-stage"),
      ];

      stages.forEach((stage, stageIndex) => {
        const orb = stage.querySelector<HTMLElement>(".workflow-agent-orb");
        if (!orb) return;
        const orbBox = offsetBox(orb, root);
        const orbX = centerX(orbBox);
        const orbY = centerY(orbBox);
        const radius = orbBox.width / 2;

        // Agent to the agent it handed the work to.
        const handoff = stage.querySelector<HTMLElement>(".workflow-handoff");
        const next = stages[stageIndex + 1];
        const nextOrb = next?.querySelector<HTMLElement>(
          ".workflow-agent-orb",
        );
        if (handoff && nextOrb) {
          const nextBox = offsetBox(nextOrb, root);
          // The name card covers the bottom of the orb, so the spine leaves
          // the agent block rather than starting under a card.
          const name = stage.querySelector<HTMLElement>(".workflow-agent-name");
          const exit = name
            ? offsetBox(name, root).top + name.offsetHeight + 5
            : orbY + radius + 5;
          traces.push({
            curve: straight(
              orbX,
              exit,
              centerX(nextBox),
              centerY(nextBox) - nextBox.height / 2 - 5,
            ),
            kind: "spine",
            source: handoff,
            offset: stageIndex * 0.21,
          });
        }

        // Agent to its own tools: one trunk out to the bus, then a lead per
        // node, chained column by column so later columns do not cross the
        // nodes standing in front of them.
        const list = stage.querySelector<HTMLElement>(
          ".workflow-tool-branch ol",
        );
        if (!list) return;
        const items = [...list.querySelectorAll<HTMLElement>(":scope > li")];
        if (!items.length) return;

        const listBox = offsetBox(list, root);
        const busX = listBox.left - 16;

        const nodes = items.map((item) => {
          const node =
            item.querySelector<HTMLElement>(".workflow-tool-node") ?? item;
          const box = offsetBox(node, root);
          return { item, box, x: centerX(box), y: centerY(box) };
        });

        // Columns, left to right; the bus only feeds the first one.
        const columns = new Map<number, typeof nodes>();
        for (const node of nodes) {
          const key = Math.round(node.x);
          const column = columns.get(key);
          if (column) column.push(node);
          else columns.set(key, [node]);
        }
        const ordered = [...columns.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([, column]) => column);

        const trunkY = ordered[0]?.length
          ? ordered[0].reduce((sum, node) => sum + node.y, 0) /
            ordered[0].length
          : orbY;

        traces.push({
          curve: elbow(orbX + radius + 4, orbY, busX, trunkY),
          kind: "branch",
          source: stage,
          offset: stageIndex * 0.13,
        });

        ordered.forEach((column, columnIndex) => {
          const previous = ordered[columnIndex - 1];
          column.forEach((node, nodeIndex) => {
            const from = previous
              ? previous.reduce((best, candidate) =>
                  Math.abs(candidate.y - node.y) < Math.abs(best.y - node.y)
                    ? candidate
                    : best,
                )
              : null;
            const startX = from
              ? from.x + from.box.width / 2 + 2
              : busX;
            const startY = from ? from.y : node.y;
            traces.push({
              curve: from
                ? straight(startX, startY, node.x - node.box.width / 2 - 2, node.y)
                : elbow(
                    startX,
                    startY,
                    node.x - node.box.width / 2 - 2,
                    node.y,
                  ),
              kind: "lead",
              source: node.item,
              offset: nodeIndex * 0.17 + columnIndex * 0.31,
            });
          });
        });

        // The bus itself: a spine down the first column, drawn as leads
        // between consecutive nodes so it lights with the work.
        const first = ordered[0] ?? [];
        const sorted = [...first].sort((a, b) => a.y - b.y);
        for (let index = 1; index < sorted.length; index += 1) {
          traces.push({
            curve: straight(
              busX,
              sorted[index - 1].y,
              busX,
              sorted[index].y,
            ),
            kind: "branch",
            source: sorted[index].item,
            offset: index * 0.11,
          });
        }
      });

      tracesRef.current = traces;

      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = root.scrollWidth;
      const height = root.scrollHeight;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      palette = readPalette(root);
    };

    const strokeTrace = (trace: Trace, state: TraceState) => {
      const { curve } = trace;
      context.beginPath();
      context.moveTo(curve.x0, curve.y0);
      context.bezierCurveTo(
        curve.x1,
        curve.y1,
        curve.x2,
        curve.y2,
        curve.x3,
        curve.y3,
      );
      if (state === "failed") {
        context.strokeStyle = palette.destructive;
        context.globalAlpha = 0.5;
        context.lineWidth = 1.25;
      } else if (state === "live") {
        context.strokeStyle = palette.accent;
        context.globalAlpha = 0.45;
        context.lineWidth = 1.5;
      } else {
        const spine = trace.kind === "spine";
        context.strokeStyle = palette.primary;
        context.globalAlpha = state === "done" ? (spine ? 0.5 : 0.32) : 0.18;
        context.lineWidth = spine ? 1.25 : 1;
      }
      context.stroke();
      context.globalAlpha = 1;
    };

    const drawArrow = (trace: Trace, state: TraceState) => {
      const [x, y] = pointAt(trace.curve, 1);
      const [px, py] = pointAt(trace.curve, 0.94);
      const angle = Math.atan2(y - py, x - px);
      context.save();
      context.translate(x, y);
      context.rotate(angle);
      context.beginPath();
      context.moveTo(-6, -4.5);
      context.lineTo(0, 0);
      context.lineTo(-6, 4.5);
      context.strokeStyle =
        state === "live" ? palette.accent : palette.primary;
      context.globalAlpha = state === "live" ? 0.85 : 0.6;
      context.lineWidth = 1.6;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.stroke();
      context.restore();
      context.globalAlpha = 1;
    };

    const drawPacket = (trace: Trace, time: number) => {
      const period = trace.kind === "spine" ? SPINE_MS : LEAD_MS;
      const progress = ((time / period + trace.offset) % 1 + 1) % 1;
      for (let step = TAIL; step >= 0; step -= 1) {
        const t = ease(Math.max(0, progress - step * 0.028));
        if (t <= 0) continue;
        const [x, y] = pointAt(trace.curve, t);
        const fade = 1 - step / (TAIL + 1);
        context.beginPath();
        context.arc(x, y, step === 0 ? 2.4 : 1.7 * fade + 0.3, 0, Math.PI * 2);
        context.fillStyle = palette.accent;
        // The head arrives and leaves; the charge never blinks out mid-trace.
        context.globalAlpha =
          fade * 0.55 * Math.min(1, t * 6) * Math.min(1, (1 - t) * 6);
        if (step === 0) {
          context.shadowColor = palette.accent;
          context.shadowBlur = 5;
        }
        context.fill();
        context.shadowBlur = 0;
      }
      context.globalAlpha = 1;
    };

    /** One comet down the spine, stage after stage, once the run is over. */
    const drawArrival = (elapsed: number) => {
      const spines = tracesRef.current
        .filter((trace) => trace.kind === "spine")
        .sort((a, b) => a.curve.y0 - b.curve.y0);
      if (!spines.length) return;
      const progress = ease(Math.min(1, elapsed / ARRIVAL_MS));
      const position = progress * spines.length;
      const index = Math.min(spines.length - 1, Math.floor(position));
      const local = position - index;
      // Everything the charge has already passed is lit behind it, so the
      // sweep reads as one movement across the whole graph rather than a dot
      // hopping between unrelated lines.
      const fade = 1 - progress;
      for (let step = TAIL; step >= 0; step -= 1) {
        const t = local - step * 0.05;
        const spine = t >= 0 ? spines[index] : spines[index - 1];
        if (!spine) continue;
        const [x, y] = pointAt(spine.curve, t >= 0 ? t : 1 + t);
        const head = step === 0;
        context.beginPath();
        context.arc(x, y, head ? 2.8 : 1.9 * (1 - step / (TAIL + 1)) + 0.4, 0, Math.PI * 2);
        context.fillStyle = palette.accent;
        context.globalAlpha = (1 - step / (TAIL + 1)) * (0.2 + 0.4 * fade);
        if (head) {
          context.shadowColor = palette.accent;
          context.shadowBlur = 6;
        }
        context.fill();
        context.shadowBlur = 0;
      }
      context.globalAlpha = 1;
    };

    const draw = (time: number) => {
      context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height,
      );
      context.lineCap = "round";
      let live = false;
      const traces = tracesRef.current;

      for (const trace of traces) {
        const state = traceState(trace);
        if (state === "live") live = true;
        strokeTrace(trace, state);
        if (trace.kind === "spine") drawArrow(trace, state);
      }
      if (!reduced.matches) {
        for (const trace of traces) {
          if (traceState(trace) === "live") drawPacket(trace, time);
        }
      }

      if (!reduced.matches) {
        if (wasLiveRef.current && !live && arrivalRef.current === null) {
          arrivalRef.current = time;
        }
        if (live) arrivalRef.current = null;
        const started = arrivalRef.current;
        if (started !== null) {
          const elapsed = time - started;
          if (elapsed >= ARRIVAL_MS) arrivalRef.current = null;
          else drawArrival(elapsed);
        }
      }
      wasLiveRef.current = live;
      return live || arrivalRef.current !== null;
    };

    const stop = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };

    const tick = (time: number) => {
      const moving = draw(time);
      // A settled graph costs nothing: the loop ends with the last running step
      // and the static traces stay on the canvas until something changes.
      if (moving && visible && !reduced.matches && !document.hidden) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
      }
    };

    const start = () => {
      stop();
      frameRef.current = requestAnimationFrame(tick);
    };

    const refresh = () => {
      measure();
      start();
    };

    refresh();

    const resizeObserver = new ResizeObserver(refresh);
    resizeObserver.observe(root);

    const intersection = new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        if (visible) start();
        else stop();
      },
      { threshold: 0 },
    );
    intersection.observe(canvas);

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    reduced.addEventListener("change", refresh);

    return () => {
      stop();
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", refresh);
    };
  }, [revision]);

  return <canvas aria-hidden="true" className="workflow-circuit" ref={canvasRef} />;
}
