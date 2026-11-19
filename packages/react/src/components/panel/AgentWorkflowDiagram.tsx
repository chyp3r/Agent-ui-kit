import { Check, CircleAlert, LoaderCircle, LocateFixed, Minus, Plus, RotateCcw, X } from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { visitDuration, type Flow, type Handoff, type RunState, type ToolCall, type Visit } from "@agent-kit/core";

import { useKit } from "../../context/KitContext";
import type { MessageKey } from "@agent-kit/core";
import { AgentPortrait } from "../agents/AgentPortrait";
import { PlanList, StepDetail } from "./StepDetail";
import { toolIcon } from "./toolIcons";
import { WorkflowCircuit } from "./WorkflowCircuit";

function stateKey(state: RunState): MessageKey {
  return state === "running" ? "state.running" : state === "done" ? "state.done" : "state.warning";
}

function StateIcon({ state, size = 13 }: { state: RunState; size?: number }) {
  if (state === "done") return <Check className="workflow-tool-state" size={size} aria-hidden="true" />;
  if (state === "failed") return <CircleAlert className="workflow-tool-state" size={size} aria-hidden="true" />;
  return <LoaderCircle className="workflow-tool-state" size={size} aria-hidden="true" />;
}

interface ViewState {
  x: number;
  y: number;
  scale: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

interface Selection {
  visitId: string;
  callId: string | null;
}

const INITIAL_VIEW: ViewState = { x: 0, y: 0, scale: 1 };

function ToolCard({
  call,
  duration,
  selected,
  index,
  onSelect,
}: {
  call: ToolCall;
  duration: number | null;
  selected: boolean;
  index: number;
  onSelect: () => void;
}) {
  const { t, tool, fmt } = useKit();
  const info = tool(call.tool);
  const Icon = toolIcon(info.icon);
  const stateWord = t(stateKey(call.state));
  return (
    <li data-state={call.state} style={{ "--tool-index": index } as CSSProperties}>
      <button
        type="button"
        className="workflow-tool-node"
        aria-pressed={selected}
        aria-label={t("flow.openTool", { label: info.label, state: stateWord })}
        onClick={onSelect}
      >
        {call.state === "running" && <span aria-hidden="true" className="tool-sweep" />}
        <span className="workflow-tool-icon">
          <Icon size={15} aria-hidden="true" />
        </span>
        <span className="workflow-tool-copy">
          <strong>{info.label}</strong>
          <small>{call.state === "running" ? t("state.runningDots") : call.interrupted ? t("flow.interrupted") : (call.summary ?? stateWord)}</small>
        </span>
        {duration !== null && call.state !== "running" && (
          <span className="workflow-tool-time" data-numeric>
            {fmt.duration(duration)}
          </span>
        )}
        <StateIcon state={call.state} />
      </button>
    </li>
  );
}

function Stage({
  visit,
  index,
  handoff,
  selection,
  onSelect,
}: {
  visit: Visit;
  index: number;
  handoff?: Handoff & { label?: string };
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
}) {
  const { t, agent: agentOf, transition, kit } = useKit();
  const agent = agentOf(visit.node, visit.title);
  const duration = visitDuration(visit);
  const running = visit.state === "running";
  return (
    <li
      className="workflow-stage"
      data-state={running ? "running" : visit.state === "failed" ? "failed" : "visited"}
      data-node={visit.node}
      style={{ "--stage-index": Math.min(index, 3) } as CSSProperties}
    >
      {visit.loop > 0 && visit.node === kit.entryNode && (
        <div className="workflow-loop" aria-label={t("flow.loop", { n: visit.loop + 1 })}>
          <RotateCcw size={11} aria-hidden="true" />
          {t("flow.loop", { n: visit.loop + 1 })}
        </div>
      )}
      <div className="workflow-stage-row">
        <article className="workflow-agent">
          <button
            type="button"
            className="workflow-agent-orb"
            aria-label={t("flow.openDetail", { name: agent.name })}
            aria-pressed={selection?.visitId === visit.id && selection.callId === null}
            onClick={() => onSelect({ visitId: visit.id, callId: null })}
          >
            <AgentPortrait avatar={kit.avatarOf(visit.node)} label={agent.name} active={running} />
            <span className="workflow-agent-state" aria-hidden="true" />
          </button>
          <div className="workflow-agent-name">
            <strong>{agent.name}</strong>
            <span>{agent.role}</span>
          </div>
        </article>

        <div className="workflow-work">
          <p className={["workflow-thought", running ? "text-shimmer" : ""].join(" ")} key={visit.thought}>
            {visit.thought}
          </p>
          {visit.plan.length > 0 && <PlanList plan={visit.plan} />}
          {visit.calls.length > 0 && (
            <div className="workflow-tool-branch">
              <ol aria-label={t("flow.toolsOf", { name: agent.name })}>
                {visit.calls.map((call, callIndex) => (
                  <ToolCard
                    key={call.id}
                    call={call}
                    index={callIndex}
                    duration={visit.calls.length === 1 || callIndex === 0 ? duration : null}
                    selected={selection?.callId === call.id}
                    onSelect={() => onSelect({ visitId: visit.id, callId: call.id })}
                  />
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      {handoff && (
        <div className="workflow-handoff" data-active={handoff.active} data-replan={handoff.replan || undefined}>
          <div className="workflow-handoff-label">
            <strong>
              {agentOf(handoff.from).name} → {handoff.to === "answer" ? t("flow.answer") : agentOf(handoff.to).name}
            </strong>
            <small>{handoff.label ?? transition(handoff.from, handoff.to)}</small>
          </div>
        </div>
      )}
    </li>
  );
}

/** The run's last stop: the report on its way to the reader, then the answer. */
function AnswerStage({ flow, words }: { flow: Flow; words: number }) {
  const { t, fmt } = useKit();
  const writing = flow.phase === "writing";
  return (
    <li className="workflow-stage" data-state={writing ? "running" : "visited"} data-node="answer" style={{ "--stage-index": 3 } as CSSProperties}>
      <div className="workflow-stage-row">
        <article className="workflow-agent">
          <div className="workflow-agent-orb" aria-hidden="true">
            <AgentPortrait avatar="mascot" label={t("flow.answer")} active={writing} />
            <span className="workflow-agent-state" />
          </div>
          <div className="workflow-agent-name">
            <strong>{t("flow.answer")}</strong>
            <span>{writing ? t("flow.streaming") : t("flow.delivered")}</span>
          </div>
        </article>
        <div className="workflow-work">
          <p className={["workflow-thought", writing ? "text-shimmer" : ""].join(" ")}>
            {writing
              ? words > 0
                ? t("flow.writingWords", { n: fmt.count(words) })
                : t("flow.preparing")
              : t("flow.written")}
          </p>
        </div>
      </div>
    </li>
  );
}

/**
 * The run as a live map: every visit an agent made, the handoffs between them and
 * the tools each one used, in the order the stream reported them. It reads top to
 * bottom like a process map and grows while it is watched; a verifier that sends
 * the plan back shows up as the next pass rather than as an edit to the first.
 *
 * Drag to pan, buttons or ctrl+wheel to zoom, wheel to scroll. Once the reader has
 * moved it, it stops following the run until they recentre it.
 */
export function AgentWorkflowDiagram({
  flow,
  words = 0,
  label,
}: {
  flow: Flow;
  /** Words of the report received so far, for the last stage. */
  words?: number;
  label?: string;
}) {
  const { t, agent, tool } = useKit();
  const showsAnswer = flow.phase === "writing" || flow.phase === "done";
  const revision = useMemo(
    () => `${flow.visits.map((visit) => `${visit.node}:${visit.calls.length}:${visit.state}`).join("|")}|${showsAnswer}`,
    [flow.visits, showsAnswer],
  );
  const [selection, setSelection] = useState<Selection | null>(null);
  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const [panning, setPanning] = useState(false);
  // Bumped by the recentre button: follow the run again from where it is now.
  const [follow, setFollow] = useState(0);
  const drag = useRef<DragState | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const held = useRef(false);
  const stageCount = flow.visits.length + (showsAnswer ? 1 : 0);
  const running = flow.current ? flow.current.index : flow.phase === "writing" ? flow.visits.length : -1;

  const beginPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    // A pointer that goes down on a control is that control's: capturing it here
    // would retarget the pointerup and the click would never arrive.
    if ((event.target as HTMLElement).closest("button, summary, a, .workflow-inspector")) return;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanning(true);
  };

  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    // Only a real move makes the map the reader's: a click on its background does not
    // stop it following the run.
    if (Math.abs(event.clientX - current.startX) + Math.abs(event.clientY - current.startY) > 3) {
      held.current = true;
    }
    setView((previous) => ({
      ...previous,
      x: current.originX + event.clientX - current.startX,
      y: current.originY + event.clientY - current.startY,
    }));
  };

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setPanning(false);
  };

  // The run grows downward past the fold, and the stage at work is the one worth
  // looking at. The canvas carries the move on its own eased transition.
  useEffect(() => {
    if (held.current || running < 0) return;
    const frame = viewport.current;
    const stage = frame?.querySelectorAll<HTMLElement>(".workflow-stage")[running];
    if (!frame || !stage) return;
    const centre = stage.offsetTop + stage.offsetHeight / 2;
    setView((previous) => {
      const next = Math.min(0, frame.clientHeight / 2 - centre * previous.scale);
      return Math.abs(next - previous.y) < 8 ? previous : { ...previous, y: next };
    });
  }, [running, stageCount, follow]);

  // A wheel over the map moves the map, and it has to be a native listener: React
  // attaches its own wheel handler passively, which cannot stop the panel scrolling.
  useEffect(() => {
    const frame = viewport.current;
    if (!frame) return;
    const onWheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest(".workflow-inspector")) return;
      event.preventDefault();
      held.current = true;
      setView((previous) => {
        if (event.ctrlKey) {
          return { ...previous, scale: clampScale(previous.scale - event.deltaY * 0.004) };
        }
        // Stops with the last stage still on screen: a map scrolled off its own edge
        // reads as an empty one.
        const height = frame.querySelector<HTMLElement>(".workflow-canvas")?.offsetHeight ?? 0;
        const floor = Math.min(0, frame.clientHeight - height * previous.scale);
        return {
          ...previous,
          x: previous.x - event.deltaX,
          y: Math.min(0, Math.max(floor, previous.y - event.deltaY)),
        };
      });
    };
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  }, [flow.visits.length > 0]);

  useEffect(() => {
    if (!selection) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelection(null);
    };
    document.addEventListener("keyup", onKey);
    return () => document.removeEventListener("keyup", onKey);
  }, [selection]);

  const changeScale = useCallback((amount: number) => {
    setView((previous) => ({ ...previous, scale: clampScale(previous.scale + amount) }));
  }, []);

  if (!flow.visits.length) {
    return (
      <div className="workflow-empty" role="status">
        <span />
        <span />
        <span />
        <strong>{t("flow.waitingFirst")}</strong>
      </div>
    );
  }

  const selectedVisit = selection ? flow.visits.find((visit) => visit.id === selection.visitId) : undefined;
  const selectedCall = selection?.callId
    ? selectedVisit?.calls.find((call) => call.id === selection.callId)
    : undefined;

  return (
    <div className="workflow-diagram">
      <div className="workflow-controls" aria-label={t("flow.view")}>
        <button type="button" aria-label={t("flow.zoomIn")} onClick={() => changeScale(0.1)}>
          <Plus size={15} />
        </button>
        <button type="button" aria-label={t("flow.zoomOut")} onClick={() => changeScale(-0.1)}>
          <Minus size={15} />
        </button>
        <button
          type="button"
          aria-label={t("flow.recentre")}
          onClick={() => {
            held.current = false;
            setView(INITIAL_VIEW);
            setFollow((tick) => tick + 1);
          }}
        >
          <LocateFixed size={15} />
        </button>
      </div>

      <div
        ref={viewport}
        className="workflow-viewport"
        aria-label={label ?? t("flow.mapLabel")}
        role="region"
        tabIndex={0}
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <div
          className="workflow-canvas"
          data-panning={panning || undefined}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          <WorkflowCircuit revision={revision} />
          <ol className="workflow-stages">
            {flow.visits.map((visit, index) => (
              <Stage
                key={visit.id}
                visit={visit}
                index={index}
                handoff={
                  flow.handoffs[index] ??
                  (showsAnswer && index === flow.visits.length - 1
                    ? {
                        id: "to-answer",
                        from: visit.node,
                        to: "answer",
                        label: flow.phase === "writing" ? t("flow.answerStreaming") : t("flow.answerDelivered"),
                        active: flow.phase === "writing",
                        replan: false,
                      }
                    : undefined)
                }
                selection={selection}
                onSelect={(next) =>
                  setSelection((current) =>
                    current?.visitId === next.visitId && current.callId === next.callId ? null : next,
                  )
                }
              />
            ))}
            {showsAnswer && <AnswerStage flow={flow} words={words} />}
          </ol>
        </div>
      </div>

      {selectedVisit && (
        <aside className="workflow-inspector" aria-live="polite">
          <button type="button" className="workflow-inspector-close" aria-label={t("flow.closeDetail")} onClick={() => setSelection(null)}>
            <X size={14} />
          </button>
          <span>
            {agent(selectedVisit.node, selectedVisit.title).name} · {t(stateKey((selectedCall ?? selectedVisit).state))}
          </span>
          <h3>{selectedCall ? tool(selectedCall.tool).label : agent(selectedVisit.node, selectedVisit.title).purpose}</h3>
          <StepDetail visit={selectedVisit} toolCall={selectedCall} />
        </aside>
      )}
    </div>
  );
}

function clampScale(scale: number): number {
  return Math.min(1.3, Math.max(0.6, scale));
}
