import {
  createLocalSessionStore,
  demoKit,
  type AgentAdapter,
  type AgentKit,
  type Locale,
  type Messages,
  type SessionStore,
} from "@agent-kit/core";
import { ArrowDown } from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

import { EmptyState, type Suggestion } from "./components/chat/EmptyState";
import { AnchorToAnswer } from "./components/chat/AnchorToAnswer";
import { PendingTurn } from "./components/chat/PendingTurn";
import { QuestionForm } from "./components/chat/QuestionForm";
import { ScrollEdges } from "./components/chat/ScrollEdges";
import { TurnError } from "./components/chat/TurnError";
import { TurnView } from "./components/chat/TurnView";
import { PanelWorking } from "./components/panel/PanelWorking";
import { WorkspacePanel } from "./components/panel/WorkspacePanel";
import { AppShell } from "./components/shell/AppShell";
import { Sidebar } from "./components/shell/Sidebar";
import { AgentKitProvider, useKit } from "./context/KitContext";
import { useAgentChat } from "./hooks/useAgentChat";
import type { Renderers } from "./renderers/registry";

function ScrollDown() {
  const { t } = useKit();
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  if (isAtBottom) return null;
  return (
    <button type="button" className="scroll-down" aria-label={t("scroll.down")} onClick={() => void scrollToBottom()}>
      <ArrowDown size={16} aria-hidden="true" />
    </button>
  );
}

/**
 * A question was sent: bring its card into view and follow the run from there.
 * `AnchorToAnswer` let go of the bottom when the last answer landed so that it could
 * be read from its top, and nothing else would pick it up again.
 */
function FollowNewQuestion({ question }: { question: string | null }) {
  const { scrollToBottom } = useStickToBottomContext();
  useEffect(() => {
    if (question !== null) void scrollToBottom();
  }, [question, scrollToBottom]);
  return null;
}

export interface AgentAppProps {
  /** How to talk to your backend. See the adapters in @agent-kit/core. */
  adapter: AgentAdapter;
  /** Where conversations live. Default: this browser (IndexedDB), no backend needed. */
  store?: SessionStore;
  kit?: AgentKit;
  locale?: Locale;
  /** Override any UI string. */
  messages?: Partial<Messages>;
  renderers?: Partial<Renderers>;
  suggestions?: Suggestion[];
  placeholder?: string;
  /** Headline and sub-line of the empty screen. */
  emptyTitle?: string;
  emptySubtitle?: string;
  /** Sent with every question: a model name, a mode. */
  askOptions?: Record<string, unknown>;
  /** Keep the open session in the URL hash. Default true. */
  syncAddress?: boolean;
  /** Extra content above the composer (a disclaimer, a model picker). */
  composerSlot?: ReactNode;
}

function Screen({
  adapter,
  store,
  suggestions,
  placeholder,
  emptyTitle,
  emptySubtitle,
  askOptions,
  syncAddress,
  composerSlot,
}: Omit<AgentAppProps, "kit" | "locale" | "messages" | "renderers" | "store"> & { store: SessionStore }) {
  const { t } = useKit();
  const chat = useAgentChat({ adapter, store, askOptions, syncAddress });
  const { workspace: shown, turns, failure, busy, pending } = chat;
  const failedFlow = failure?.flow;
  const openedTurn = shown.turnIndex !== null ? turns[shown.turnIndex] : undefined;
  const lastTurn = turns.length - 1;
  const panelAvailable = busy || lastTurn >= 0 || Boolean(failedFlow?.visits.length);

  const panel =
    shown.open && busy && shown.turnIndex === null && pending !== null ? (
      <PanelWorking key={chat.run} question={pending} flow={chat.liveFlow} words={chat.words} seconds={chat.seconds} onClose={chat.closePanel} />
    ) : shown.open && shown.turnIndex === null && failure && failedFlow?.visits.length ? (
      <PanelWorking key={chat.run} question={failure.question} flow={failedFlow} live={false} onClose={chat.closePanel} />
    ) : (
      shown.open &&
      openedTurn && (
        <WorkspacePanel
          key={`turn-${shown.turnIndex}`}
          turn={openedTurn}
          workspace={shown}
          onTab={chat.changeTab}
          onClose={chat.closePanel}
          expanded={chat.expanded}
          onToggleExpanded={() => chat.setExpanded((current) => !current)}
        />
      )
    );

  const togglePanel = () => {
    if (busy || failedFlow?.visits.length) chat.showLivePanel();
    else if (lastTurn >= 0) chat.openPanel(shown.turnIndex ?? lastTurn, shown.tab);
  };

  const lockedNote = useMemo(
    () => (chat.status === "busy" ? t("lock.busy") : chat.loadingSession ? t("lock.opening") : null),
    [chat.status, chat.loadingSession, t],
  );

  return (
    <AppShell
      started={chat.started}
      panel={panel || null}
      panelAvailable={panelAvailable}
      panelExpanded={chat.expanded && shown.open}
      onTogglePanel={togglePanel}
      onClosePanel={chat.closePanel}
      onNew={chat.startOver}
      sidebar={(close) => (
        <Sidebar
          status={chat.status}
          started={chat.started}
          busy={busy}
          sessions={chat.sessions}
          activeId={chat.sessionId}
          onNew={chat.startOver}
          onSelect={(session) => void chat.openSession(session)}
          onDelete={(session) => void chat.deleteSession(session)}
          onClose={close}
        />
      )}
    >
      <main className="room-main">
        <StickToBottom className="conversation" resize="smooth" initial={false}>
          <ScrollEdges />
          <StickToBottom.Content
            scrollClassName="conversation-scroll"
            className={["conversation-content", chat.started ? "" : "conversation-empty"].join(" ")}
          >
            {!chat.started && (
              <EmptyState
                onPick={(question) => void chat.ask(question)}
                disabled={chat.status === "busy"}
                suggestions={suggestions}
                title={emptyTitle}
                subtitle={emptySubtitle}
              />
            )}

            {chat.loadingSession && (
              <div className="session-loading" role="status">
                <div className="pending-orbit" aria-hidden="true" />
                {t("lock.opening")}
              </div>
            )}

            {turns.map((turn, index) => (
              <TurnView
                key={`${index}-${turn.question}`}
                turn={turn}
                onOpenPanel={(tab, tag) => chat.openPanel(index, tab, tag)}
                onRegenerate={index === lastTurn && !busy ? chat.regenerate : undefined}
                onEdit={index === lastTurn && !busy ? chat.editLast : undefined}
                onFeedback={(value) => chat.setFeedback(index, value)}
              />
            ))}

            <AnchorToAnswer turns={turns.length} />
            <FollowNewQuestion question={pending} />

            {pending !== null && (
              <PendingTurn
                question={pending}
                flow={chat.liveFlow}
                text={chat.liveText}
                seconds={chat.seconds}
                onCancel={chat.cancel}
                onOpenPanel={chat.showLivePanel}
                onApproval={chat.respondApproval}
              />
            )}

            {failure && (
              <TurnError
                question={failure.question}
                message={failure.message}
                detail={failure.detail}
                stopped={failure.stopped}
                flow={failure.flow}
                partial={failure.partial}
                onRetry={
                  failure.retry === null || chat.status === "busy"
                    ? undefined
                    : (failure.retry ?? (() => void chat.ask(failure.question)))
                }
              />
            )}

            {chat.saveFailed && (
              <p className="save-note" role="status">
                {t("save.failed")}
              </p>
            )}
          </StickToBottom.Content>
          <ScrollDown />
        </StickToBottom>
      </main>

      <div className="enter-2 composer-dock">
        {composerSlot}
        <QuestionForm
          onSubmit={(question) => void chat.ask(question)}
          onCancel={chat.cancel}
          busy={busy}
          lockedNote={lockedNote}
          placeholder={placeholder ?? (turns.length ? t("composer.followUp") : t("composer.placeholder"))}
          prefill={chat.prefill}
        />
      </div>
    </AppShell>
  );
}

/**
 * The whole screen: sidebar, conversation, composer and the analysis panel. Give it
 * an adapter and, if you like, a kit, a locale and renderers; everything else is
 * already wired. To change how it looks, edit the tokens in `styles/tokens.css`; to
 * change what it does, copy this file and take only the parts you need.
 */
export function AgentApp({ adapter, store, kit = demoKit, locale = "tr", messages, renderers, ...rest }: AgentAppProps) {
  const sessionStore = useMemo(() => store ?? createLocalSessionStore(), [store]);
  return (
    <AgentKitProvider kit={kit} locale={locale} messages={messages} renderers={renderers}>
      <Screen adapter={adapter} store={sessionStore} {...rest} />
    </AgentKitProvider>
  );
}
