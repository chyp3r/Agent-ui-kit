import { demoKit, foldFlow, type AgentEvent, type Approval, type Locale, type TimedEvent } from "@agent-kit/core";
import {
  AgentKitProvider,
  AgentPortrait,
  AVATARS,
  AgentWorkflowDiagram,
  AnswerBody,
  ApprovalCard,
  ChartPanel,
  CodeBlock,
  MessageActions,
  PlanList,
  ReasoningBlock,
  ThemeToggle,
  ThoughtStream,
} from "@agent-kit/react";
import type { ReactNode } from "react";

/** Every component in every state, with no backend: the place to restyle from. */
const at = (events: AgentEvent[]): TimedEvent[] => events.map((event, index) => ({ at: index * 400, event }));

const REPLAN = at([
  { type: "step.start", node: "planner" },
  { type: "step.end", node: "planner", details: "Plan hazır.", output: { plan: [{ agent: "researcher", instruction: "Veriyi topla." }, { agent: "reviewer", instruction: "Denetle." }] } },
  { type: "step.start", node: "researcher" },
  { type: "tool.start", callId: "a", tool: "search", args: { query: "son 30 gün" } },
  { type: "tool.end", callId: "a", summary: "0 kayıt" },
  { type: "step.end", node: "researcher" },
  { type: "step.start", node: "reviewer" },
  { type: "step.end", node: "reviewer", details: "Eksik bulundu.", output: { verdict: { passed: false, critique: "Hiç kayıt yok." } } },
  { type: "step.start", node: "planner", loop: 1 },
]);

const RUNNING = at([
  { type: "step.start", node: "planner" },
  { type: "step.end", node: "planner", details: "Soru analiz edildi." },
  { type: "step.start", node: "analyst", details: "Sorgu çalışıyor." },
]);

const APPROVALS: Approval[] = (["pending", "approved", "rejected"] as const).map((state, index) => ({
  id: `a${index}`,
  title: "E-posta gönderilsin mi?",
  description: "Sonuç ekibe iletilecek.",
  payload: { to: "team@example.com", attachments: 1 },
  state,
  at: 0,
}));

const MARKDOWN = [
  "Bir paragraf, **kalın** ve `satır içi kod`.",
  "",
  "- 20/10/2026 09:15 - [wiki] - Örnek kayıt bir",
  "- 21/10/2026 10:40 - [crm] - Örnek kayıt iki",
  "",
  "```sql",
  "SELECT category, COUNT(*) FROM records GROUP BY category; -- sayım",
  "```",
  "",
  '```chart\n{"type":"pie","title":"Dağılım","labels":["a","b","c"],"values":[5,3,2]}\n```',
].join("\n");

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 12 }}>{title}</h2>
      {children}
    </section>
  );
}

export function Gallery({ locale }: { locale: Locale }) {
  return (
    <AgentKitProvider kit={demoKit} locale={locale}>
      <div style={{ height: "100dvh", overflow: "auto", background: "var(--background)", color: "var(--foreground)" }}>
        <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px 80px" }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
            <h1 style={{ fontSize: 22 }}>Agent Kit · Gallery</h1>
            <ThemeToggle />
          </header>

          <Section title="Portraits">
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {AVATARS.map((avatar) => (
                <figure key={avatar} style={{ margin: 0, textAlign: "center", fontSize: 11 }}>
                  <AgentPortrait avatar={avatar} label={avatar} size={64} active />
                  <figcaption>{avatar}</figcaption>
                </figure>
              ))}
            </div>
          </Section>

          <Section title="Flow map · running">
            <div style={{ height: 460 }}>
              <AgentWorkflowDiagram flow={foldFlow(RUNNING, {}, demoKit)} />
            </div>
          </Section>

          <Section title="Flow map · replan loop">
            <div style={{ height: 520 }}>
              <AgentWorkflowDiagram flow={foldFlow(REPLAN, {}, demoKit)} />
            </div>
          </Section>

          <Section title="Thought stream">
            <ThoughtStream flow={foldFlow(REPLAN, {}, demoKit)} />
          </Section>

          <Section title="Plan">
            <PlanList plan={foldFlow(REPLAN, {}, demoKit).visits[0].plan} />
          </Section>

          <Section title="Reasoning">
            <ReasoningBlock text="Önce kayıtları bulmalıyım, sonra en yenisini seçmeliyim." live />
          </Section>

          <Section title="Approval">
            {APPROVALS.map((approval) => (
              <ApprovalCard key={approval.id} approval={approval} onRespond={() => undefined} />
            ))}
          </Section>

          <Section title="Answer blocks">
            <AnswerBody text={MARKDOWN} />
          </Section>

          <Section title="Code">
            <CodeBlock language="ts" code={'const kit = defineAgentKit({ agents: [] }); // your team\nconsole.log("hi", 42);'} />
          </Section>

          <Section title="Chart">
            <ChartPanel chart={{ type: "bar", title: "Kategoriye göre kayıt", labels: ["reports", "tickets", "notes", "other"], values: [42, 31, 18, 7] }} />
          </Section>

          <Section title="Message actions">
            <MessageActions answer="x" feedback="up" onRegenerate={() => undefined} onEdit={() => undefined} onFeedback={() => undefined} onExportJson={() => undefined} onExportMarkdown={() => undefined} />
          </Section>
        </main>
      </div>
    </AgentKitProvider>
  );
}
