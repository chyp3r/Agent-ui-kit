import {
  ApiError,
  CLOSED,
  SessionNotFound,
  StreamError,
  clampToTurns,
  closePanel,
  compactEvents,
  foldFlow,
  historyOf,
  messagesOf,
  newSessionId,
  openForWork,
  openTurn,
  sessionTitle,
  setTab,
  settleWithAnswer,
  showLive,
  startTurn,
  turnsOf,
  type AgentAdapter,
  type AgentEvent,
  type ApprovalDecision,
  type Flow,
  type PanelTab,
  type SessionStore,
  type SessionSummary,
  type TimedEvent,
  type Turn,
  type Workspace,
} from "@agent-kit/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useKit } from "../context/KitContext";
import { useHealth, type SystemStatus } from "./useHealth";

export interface Failure {
  question: string;
  message: string;
  detail?: string;
  stopped?: boolean;
  flow?: Flow;
  /** The report as far as it had arrived. */
  partial?: string;
  /** Unset: ask the question again. `null`: nothing a retry could bring back. */
  retry?: (() => void) | null;
}

export interface UseAgentChatOptions {
  adapter: AgentAdapter;
  store: SessionStore;
  /** Extra fields passed to the adapter with every question (a model, a mode). */
  askOptions?: Record<string, unknown>;
  /** Keep the open session in the URL hash, so a reload or a shared link finds it again. */
  syncAddress?: boolean;
  /** Where the panel is a column beside the conversation. Below this it would cover it. */
  sideBySide?: string;
}

/** A busy report is written at about twenty words a second; the screen need not repaint for each. */
const FLUSH_MS = 90;
const SIDE_BY_SIDE = "(min-width: 1280px)";

function sessionFromAddress(): string | null {
  return globalThis.location?.hash.slice(1) || null;
}

function keepSessionInAddress(id: string | null): void {
  const { pathname, search } = globalThis.location;
  globalThis.history.replaceState(null, "", `${pathname}${search}${id ? `#${id}` : ""}`);
}

/**
 * The conversation: sessions, turns, the request in flight and the panel beside it.
 * Everything a chat screen needs and nothing it draws: `<AgentApp>` is one way to put
 * it on screen, and you can write another against the same hook.
 */
export function useAgentChat({ adapter, store, askOptions, syncAddress = true, sideBySide = SIDE_BY_SIDE }: UseAgentChatOptions) {
  const { t, kit } = useKit();
  const status = useHealth(adapter);
  const panelFitsBeside = useCallback(() => globalThis.matchMedia?.(sideBySide).matches ?? true, [sideBySide]);

  const [sessionId, setSessionId] = useState(newSessionId);
  // The session on screen, for work that finishes after the screen may have moved on.
  const sessionNow = useRef(sessionId);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [events, setEvents] = useState<TimedEvent[]>([]);
  const [liveText, setLiveText] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [workspace, setWorkspace] = useState<Workspace>(CLOSED);
  const [expanded, setExpanded] = useState(false);
  const [loadingSession, setLoadingSession] = useState(() => syncAddress && sessionFromAddress() !== null);
  const [saveFailed, setSaveFailed] = useState(false);
  // A new run is a new map: its position and open step are not the last run's.
  const [run, setRun] = useState(0);
  const [prefill, setPrefill] = useState<{ text: string; key: number } | null>(null);

  const inFlight = useRef<AbortController | null>(null);
  const opening = useRef<AbortController | null>(null);
  const openedThisTurn = useRef(false);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;

  const switchSession = useCallback((id: string) => {
    sessionNow.current = id;
    setSessionId(id);
  }, []);

  const refreshSessions = useCallback(
    (signal?: AbortSignal) => {
      store
        .list(signal)
        .then(setSessions)
        .catch(() => undefined);
    },
    [store],
  );

  useEffect(() => {
    const controller = new AbortController();
    refreshSessions(controller.signal);
    return () => controller.abort();
  }, [refreshSessions]);

  // A live request must not outlive the screen.
  useEffect(() => () => inFlight.current?.abort(), []);

  useEffect(() => {
    if (pending === null) return;
    const started = Date.now();
    setSeconds(0);
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [pending]);

  const save = useCallback(
    (askedIn: string, all: Turn[]) => {
      store
        .save(askedIn, sessionTitle(all[0].question), messagesOf(all))
        .then(() => {
          if (sessionNow.current === askedIn) {
            if (syncAddress) keepSessionInAddress(askedIn);
            setSaveFailed(false);
          }
          refreshSessions();
        })
        .catch(() => {
          if (sessionNow.current === askedIn) setSaveFailed(true);
        });
    },
    [store, refreshSessions, syncAddress],
  );

  const ask = useCallback(
    async (question: string, base: Turn[] = turnsRef.current) => {
      setFailure(null);
      setRun((current) => current + 1);
      const askedIn = sessionNow.current;
      const opensAtOnce = kit.shouldOpenImmediately(question) && panelFitsBeside();
      setWorkspace(startTurn(opensAtOnce));
      openedThisTurn.current = opensAtOnce;
      setPending(question);
      setEvents([]);
      setLiveText("");
      if (base !== turnsRef.current) setTurns(base);

      const controller = new AbortController();
      inFlight.current = controller;
      const started = performance.now();
      const collected: TimedEvent[] = [];
      let buffered = "";
      let reasoning = "";
      let flushTimer = 0;

      const flush = () => {
        flushTimer = 0;
        setLiveText(buffered);
        setEvents([...collected]);
      };
      const schedule = () => {
        if (!flushTimer) flushTimer = window.setTimeout(flush, FLUSH_MS);
      };

      const onEvent = (event: AgentEvent) => {
        if (event.type === "text.delta") {
          buffered += event.text;
          schedule();
          return;
        }
        if (event.type === "final" || event.type === "error" || event.type === "run.start") return;
        const timed = { at: performance.now() - started, event };
        if (event.type === "reasoning.delta") {
          reasoning += event.text;
          // Coalesce: a long thought is one entry, not thousands.
          const last = collected[collected.length - 1];
          if (last?.event.type === "reasoning.delta") last.event = { type: "reasoning.delta", text: last.event.text + event.text };
          else collected.push(timed);
          schedule();
          return;
        }
        collected.push(timed);
        window.clearTimeout(flushTimer);
        flush();
        // The panel opens once for a specialist at work. A reader who closes it
        // mid-run is not overruled by the next step.
        if (event.type === "step.start" && !openedThisTurn.current && !kit.isQuiet(event.node) && panelFitsBeside()) {
          openedThisTurn.current = true;
          setWorkspace(openForWork);
        }
      };

      try {
        const final = await adapter.ask({
          prompt: question,
          history: historyOf(base),
          onEvent,
          signal: controller.signal,
          options: askOptions,
        });
        window.clearTimeout(flushTimer);
        if (inFlight.current !== controller) return;

        const turn: Turn = {
          question,
          answer: final.text || buffered,
          meta: final.meta ?? null,
          events: compactEvents(collected),
          reasoning,
          elapsedMs: performance.now() - started,
        };
        const nextTurns = [...base, turn];
        setTurns(nextTurns);
        setWorkspace((current) => settleWithAnswer(current, nextTurns.length - 1));
        // The conversation is saved after every answer. A failed save does not get in
        // the way of the answer on screen, but the reader is told it will not survive.
        save(askedIn, nextTurns);
      } catch (error) {
        window.clearTimeout(flushTimer);
        // The screen has moved on (a new analysis): this run's end is nobody's business.
        if (inFlight.current !== controller) return;
        const stopped = controller.signal.aborted;
        const flow = foldFlow(collected, stopped ? { stopped: true } : { failed: true }, kit);
        const partial = buffered || undefined;
        if (stopped) {
          setFailure({ question, stopped: true, flow, partial, message: t("error.stopped"), detail: t("error.stoppedDetail") });
        } else if (error instanceof StreamError && error.status >= 500) {
          setFailure({ question, flow, partial, message: t("error.agentFailed"), detail: error.detail ?? t("error.serviceStatus", { status: error.status }) });
        } else if (error instanceof StreamError && error.status > 0) {
          setFailure({ question, flow, partial, message: t("error.rejected"), detail: error.detail ?? t("error.serviceStatus", { status: error.status }) });
        } else {
          setFailure({
            question,
            flow,
            partial,
            message: error instanceof StreamError && error.receivedEvent ? t("error.cut") : t("error.unreachable"),
            detail: t("error.retryLater"),
          });
        }
      } finally {
        if (inFlight.current === controller) {
          inFlight.current = null;
          setPending(null);
          setEvents([]);
          setLiveText("");
        }
      }
    },
    [adapter, askOptions, kit, panelFitsBeside, save, t],
  );

  const cancel = useCallback(() => {
    inFlight.current?.abort();
  }, []);

  const startOver = useCallback(() => {
    const running = inFlight.current;
    inFlight.current = null;
    running?.abort();
    opening.current?.abort();
    opening.current = null;
    switchSession(newSessionId());
    setTurns([]);
    setPending(null);
    setEvents([]);
    setLiveText("");
    setFailure(null);
    setWorkspace(CLOSED);
    setExpanded(false);
    setLoadingSession(false);
    setSaveFailed(false);
    if (syncAddress) keepSessionInAddress(null);
  }, [switchSession, syncAddress]);

  const openSession = useCallback(
    async function open(session: SessionSummary): Promise<void> {
      opening.current?.abort();
      const controller = new AbortController();
      opening.current = controller;
      switchSession(session.session_id);
      setTurns([]);
      setFailure(null);
      setWorkspace(CLOSED);
      setExpanded(false);
      setSaveFailed(false);
      setLoadingSession(true);
      try {
        const detail = await store.get(session.session_id, controller.signal);
        if (controller.signal.aborted) return;
        setTurns(turnsOf(detail.messages ?? []));
        if (syncAddress) keepSessionInAddress(session.session_id);
        setLoadingSession(false);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadingSession(false);
        // Its turns did not arrive, so this screen must not be able to save over them: a
        // question asked from here starts a session of its own.
        switchSession(newSessionId());
        if (error instanceof SessionNotFound || (error instanceof ApiError && error.status === 404)) {
          setSessions((previous) => previous.filter((row) => row.session_id !== session.session_id));
          if (syncAddress) keepSessionInAddress(null);
          setFailure({ question: session.title, message: t("session.gone"), detail: t("session.goneDetail"), retry: null });
          return;
        }
        setFailure({ question: session.title, message: t("session.failed"), detail: t("session.failedDetail"), retry: () => void open(session) });
      }
    },
    [store, switchSession, syncAddress, t],
  );

  // A reload, or a link someone sent, comes back to the session it was on. A link
  // followed in this tab does the same, unless a question is running here.
  useEffect(() => {
    if (!syncAddress) return;
    const follow = () => {
      const id = sessionFromAddress();
      if (id && id !== sessionNow.current && !inFlight.current) {
        void openSession({ session_id: id, title: "", created_at: "" });
      }
    };
    follow();
    globalThis.addEventListener("hashchange", follow);
    return () => globalThis.removeEventListener("hashchange", follow);
  }, [openSession, syncAddress]);

  const deleteSession = useCallback(
    async (session: SessionSummary) => {
      try {
        await store.remove(session.session_id);
      } catch {
        refreshSessions();
        return;
      }
      setSessions((previous) => previous.filter((row) => row.session_id !== session.session_id));
      if (session.session_id === sessionNow.current) startOver();
    },
    [store, startOver, refreshSessions],
  );

  const respondApproval = useCallback(
    (id: string, decision: ApprovalDecision) => {
      void adapter.respond?.(id, decision, inFlight.current?.signal);
    },
    [adapter],
  );

  /** Asks the last question again, in place of its answer. */
  const regenerate = useCallback(() => {
    const all = turnsRef.current;
    const last = all[all.length - 1];
    if (!last || inFlight.current) return;
    void ask(last.question, all.slice(0, -1));
  }, [ask]);

  /** Takes the last question back into the composer, dropping its answer, to be edited and sent. */
  const editLast = useCallback(() => {
    const all = turnsRef.current;
    const last = all[all.length - 1];
    if (!last || inFlight.current) return;
    const rest = all.slice(0, -1);
    setTurns(rest);
    setWorkspace((current) => clampToTurns(current, rest.length));
    setPrefill({ text: last.question, key: Date.now() });
  }, []);

  const setFeedback = useCallback(
    (index: number, value: "up" | "down" | null) => {
      const all = turnsRef.current.map((turn, at) => {
        if (at !== index) return turn;
        const { feedback: _old, ...rest } = turn;
        void _old;
        return value ? { ...rest, feedback: value } : rest;
      });
      setTurns(all);
      if (all.length) save(sessionNow.current, all);
    },
    [save],
  );

  const busy = pending !== null;
  const started = turns.length > 0 || busy || failure !== null || loadingSession;
  const shown = clampToTurns(workspace, turns.length);
  const liveFlow = useMemo(() => foldFlow(events, { writing: liveText.length > 0 }, kit), [events, liveText.length > 0, kit]);
  const words = useMemo(() => (liveText ? liveText.trim().split(/\s+/).length : 0), [liveText]);

  const closeThePanel = useCallback(() => {
    setExpanded(false);
    setWorkspace(closePanel);
  }, []);
  const openPanel = useCallback((index: number, tab: PanelTab, tag?: string) => setWorkspace((current) => openTurn(current, index, tab, tag)), []);
  const showLivePanel = useCallback(() => setWorkspace(showLive), []);
  const changeTab = useCallback((tab: PanelTab) => setWorkspace((current) => setTab(current, tab)), []);

  return {
    status: status as SystemStatus,
    sessionId,
    sessions,
    turns,
    pending,
    liveFlow,
    liveText,
    words,
    seconds,
    failure,
    saveFailed,
    loadingSession,
    busy,
    started,
    workspace: shown,
    expanded,
    setExpanded,
    run,
    prefill,
    ask: (question: string) => ask(question),
    retry: ask,
    cancel,
    startOver,
    openSession,
    deleteSession,
    respondApproval: adapter.respond ? respondApproval : undefined,
    regenerate,
    editLast,
    setFeedback,
    closePanel: closeThePanel,
    openPanel,
    showLivePanel,
    changeTab,
    setTurns,
  };
}
