import type { AgentEvent, RunMeta, Source } from "@agent-kit/core";

/**
 * Scripted runs for the demo team (`demoKit`). Each scenario is an async generator:
 * it yields what happens and how long to wait before it does. A question is mapped to
 * a scenario by its words, so every path of the UI can be walked without a backend:
 * a plain answer, a numeric one with a query, a replan loop, a chart, an action that
 * needs approval, streamed reasoning, an error and a dropped connection.
 */

export type Lang = "tr" | "en";

export type Beat =
  | { wait: number; event: AgentEvent }
  | { wait: number; cut: true };

export interface Context {
  question: string;
  lang: Lang;
  /** Resolves when someone answers the approval request with this id. */
  approval(id: string): Promise<"approved" | "rejected">;
}

export type Scenario = (context: Context) => AsyncGenerator<Beat, void, void>;

const say = (lang: Lang, tr: string, en: string) => (lang === "en" ? en : tr);
const at = (wait: number, event: AgentEvent): Beat => ({ wait, event });

function words(text: string): string[] {
  return text.split(/(\s+)/).filter(Boolean);
}

/** The answer's words, one delta each, at about twenty words a second. */
function* stream(text: string, pace = 45): Generator<Beat> {
  for (const piece of words(text)) yield at(/\s/.test(piece) ? 0 : pace, { type: "text.delta", text: piece });
}

function sources(lang: Lang, count: number): Source[] {
  const tags = ["wiki", "crm", "reports"];
  return Array.from({ length: count }, (_, index) => ({
    id: `s${index + 1}`,
    tag: tags[index % tags.length],
    time: `${String(1 + (index % 28)).padStart(2, "0")}/10/2026 ${String(8 + (index % 9)).padStart(2, "0")}:${String((index * 7) % 60).padStart(2, "0")}`,
    agent: "researcher",
    confidence: 0.92 - (index % 5) * 0.04,
    text: say(lang, `Örnek kayıt ${index + 1}: ${tags[index % tags.length]} kaynağından bulunan bir bulgu.`, `Sample record ${index + 1}: a finding from the ${tags[index % tags.length]} source.`),
  }));
}

function recordLines(found: Source[]): string {
  return found.map((source) => `- ${source.time} - [${source.tag}] - ${source.text}`).join("\n");
}

function* plan(lang: Lang, target: "researcher" | "analyst", category: string, loop = 0): Generator<Beat> {
  yield at(120, { type: "step.start", node: "planner", loop, details: say(lang, "Soru analiz ediliyor.", "Analysing the question.") });
  yield at(650, {
    type: "step.end",
    node: "planner",
    loop,
    details: say(lang, `Soru "${category}" türünde; ${target === "researcher" ? "araştırmacı" : "analist"} çalışacak.`, `The question is "${category}"; the ${target} will work on it.`),
    output: {
      plan: [
        { agent: target, instruction: say(lang, "Gerekli veriyi topla.", "Collect the data that is needed.") },
        { agent: "reviewer", instruction: say(lang, "Bulguları denetle ve raporu yaz.", "Review the findings and write the report.") },
      ],
      data: { category, target },
    },
  });
}

function* research(lang: Lang, found: Source[], loop = 0): Generator<Beat> {
  yield at(150, { type: "step.start", node: "researcher", loop, details: say(lang, "Kaynaklar taranıyor.", "Searching the sources.") });
  yield at(200, { type: "tool.start", callId: `search-${loop}`, tool: "search", node: "researcher", args: { query: "son 30 gün", sources: ["wiki", "crm", "reports"], limit: found.length } });
  yield at(900, {
    type: "tool.end",
    callId: `search-${loop}`,
    summary: say(lang, `${found.length} kayıt`, `${found.length} records`),
    records: found.slice(0, 3).map((source) => ({ tag: source.tag, time: source.time, text: source.text })),
  });
  yield at(100, { type: "step.end", node: "researcher", loop, details: say(lang, `${found.length} kayıt bulundu.`, `Found ${found.length} records.`) });
}

function* query(lang: Lang): Generator<Beat> {
  yield at(150, { type: "step.start", node: "analyst", details: say(lang, "Sorgu hazırlanıyor.", "Preparing the query.") });
  yield at(200, { type: "tool.start", callId: "q1", tool: "run_query", node: "analyst", input: "SELECT category, COUNT(*) AS n\nFROM records\nWHERE created_at >= now() - interval '30 days'\nGROUP BY category\nORDER BY n DESC;" });
  yield at(1100, {
    type: "tool.end",
    callId: "q1",
    summary: say(lang, "4 kategori", "4 categories"),
    output: "| category | n |\n|---|---|\n| reports | 42 |\n| tickets | 31 |\n| notes | 18 |\n| other | 7 |",
    outputKind: "markdown",
  });
  yield at(80, { type: "step.end", node: "analyst", details: say(lang, "Sayımlar alındı.", "Counts retrieved."), output: { calls: [{ tool: "run_query", state: "done", summary: say(lang, "4 kategori", "4 categories"), input: "SELECT category, COUNT(*) AS n\nFROM records\nWHERE created_at >= now() - interval '30 days'\nGROUP BY category\nORDER BY n DESC;", inputLanguage: "sql", output: "| category | n |\n|---|---|\n| reports | 42 |\n| tickets | 31 |\n| notes | 18 |\n| other | 7 |", outputKind: "markdown" }] } });
}

function* review(lang: Lang, passed: boolean, count: number, critique?: string, loop = 0): Generator<Beat> {
  yield at(150, { type: "step.start", node: "reviewer", loop, details: say(lang, "Bulgular denetleniyor.", "Reviewing the findings.") });
  yield at(750, {
    type: "step.end",
    node: "reviewer",
    loop,
    details: passed ? say(lang, "Bulgular sorunun koşullarını karşılıyor.", "The findings meet the question's conditions.") : (critique ?? ""),
    output: {
      verdict: { passed, confidence: passed ? 0.93 : 0.41, critique: passed ? null : critique, missing: passed ? [] : [say(lang, "zaman aralığı", "time range")] },
      calls: passed
        ? [
            { tool: "verify", state: "done", summary: say(lang, "Onaylandı", "Approved") },
            { tool: "write_report", state: "done", summary: say(lang, `${count} kaynaktan`, `from ${count} sources`) },
          ]
        : [{ tool: "verify", state: "failed", summary: say(lang, "Eksik bulundu", "Gaps found"), output: critique }],
    },
  });
}

function meta(overrides: Partial<RunMeta>): RunMeta {
  return { category: "listing", verified: true, confidence: 0.93, loops: 0, agents: ["planner", "researcher", "reviewer"], ...overrides };
}

const list: Scenario = async function* ({ lang }) {
  yield at(0, { type: "run.start" });
  yield* plan(lang, "researcher", "listing");
  const found = sources(lang, 8);
  yield* research(lang, found);
  yield* review(lang, true, found.length);
  const text = `${say(lang, "Son 30 günde sekiz kayıt buldum. Kayıtlar kaynaklarına göre aşağıda.", "I found eight records in the last 30 days. They are listed by source below.")}\n\n${recordLines(found)}\n`;
  yield* stream(text);
  yield at(0, { type: "final", text, meta: meta({ category: "listing", sources: found }) });
};

const numbers: Scenario = async function* ({ lang }) {
  yield at(0, { type: "run.start" });
  yield* plan(lang, "analyst", "numbers");
  yield* query(lang);
  yield* review(lang, true, 4);
  const text = say(
    lang,
    "Son 30 günde toplam **98** kayıt var. En kalabalık kategori **reports** (42).\n\n| Kategori | Kayıt |\n|---|---|\n| reports | 42 |\n| tickets | 31 |\n| notes | 18 |\n| other | 7 |\n\n```sql\nSELECT category, COUNT(*) FROM records GROUP BY category;\n```",
    "There are **98** records in the last 30 days. The largest category is **reports** (42).\n\n| Category | Records |\n|---|---|\n| reports | 42 |\n| tickets | 31 |\n| notes | 18 |\n| other | 7 |\n\n```sql\nSELECT category, COUNT(*) FROM records GROUP BY category;\n```",
  );
  yield* stream(text);
  yield at(0, { type: "final", text, meta: meta({ category: "numbers", agents: ["planner", "analyst", "reviewer"], sources: [{ id: "q1", tag: null, time: null, agent: "analyst", confidence: null, text: say(lang, "Veri sorgusu sonucu: 4 kategori.", "Query result: 4 categories.") }] }) });
};

const replan: Scenario = async function* ({ lang }) {
  yield at(0, { type: "run.start" });
  yield* plan(lang, "researcher", "timeline");
  yield* research(lang, [], 0);
  yield* review(lang, false, 0, say(lang, "Hiç kayıt bulunamadı; zaman aralığı çok dar olabilir.", "No record was found; the time range may be too narrow."));
  yield* plan(lang, "researcher", "timeline", 1);
  const found = sources(lang, 5);
  yield* research(lang, found, 1);
  yield* review(lang, true, found.length, undefined, 1);
  const text = `${say(lang, "İkinci denemede, aralığı genişleterek beş kayıt buldum.", "On the second try, with a wider range, I found five records.")}\n\n${recordLines(found)}\n`;
  yield* stream(text);
  yield at(0, { type: "final", text, meta: meta({ category: "timeline", loops: 1, sources: found }) });
};

const chart: Scenario = async function* ({ lang }) {
  yield at(0, { type: "run.start" });
  yield* plan(lang, "analyst", "chart");
  yield* query(lang);
  yield* review(lang, true, 4);
  yield at(150, { type: "step.start", node: "charter", details: say(lang, "Grafik hazırlanıyor.", "Preparing the chart.") });
  yield at(700, { type: "step.end", node: "charter", details: say(lang, "Çubuk grafik üretildi.", "Bar chart drawn."), output: { calls: [{ tool: "render_chart", state: "done", summary: "bar", output: "4 points" }] } });
  const text = say(
    lang,
    "Kategorilere göre kayıt sayıları:\n\n```chart\n{\"type\":\"bar\",\"title\":\"Kategoriye göre kayıt\",\"labels\":[\"reports\",\"tickets\",\"notes\",\"other\"],\"values\":[42,31,18,7]}\n```\n",
    "Record counts by category:\n\n```chart\n{\"type\":\"bar\",\"title\":\"Records by category\",\"labels\":[\"reports\",\"tickets\",\"notes\",\"other\"],\"values\":[42,31,18,7]}\n```\n",
  );
  yield* stream(text);
  yield at(0, {
    type: "final",
    text,
    meta: meta({
      category: "chart",
      agents: ["planner", "analyst", "reviewer", "charter"],
      chart: { type: "bar", title: say(lang, "Kategoriye göre kayıt", "Records by category"), labels: ["reports", "tickets", "notes", "other"], values: [42, 31, 18, 7] },
    }),
  });
};

const chat: Scenario = async function* ({ lang }) {
  yield at(0, { type: "run.start" });
  yield at(100, { type: "step.start", node: "planner", details: say(lang, "Soru analiz ediliyor.", "Analysing the question.") });
  yield at(350, { type: "step.end", node: "planner", details: say(lang, "Kaynak gerektirmeyen bir soru.", "A question that needs no sources."), output: { data: { category: "chat" } } });
  yield at(100, { type: "step.start", node: "assistant" });
  yield at(300, { type: "step.end", node: "assistant", details: say(lang, "Yanıt yazıldı.", "Reply written.") });
  const text = say(lang, "Merhaba! Kayıtları arayabilir, sayabilir, grafik çizebilir ve onayınızla eylem yürütebilirim. Ne öğrenmek istersiniz?", "Hello! I can search records, count them, draw charts and run actions with your approval. What would you like to know?");
  yield* stream(text, 30);
  yield at(0, { type: "final", text, meta: { category: "chat", verified: true } });
};

const approval: Scenario = async function* ({ lang, approval: waitFor }) {
  yield at(0, { type: "run.start" });
  yield* plan(lang, "analyst", "action");
  yield* query(lang);
  yield at(200, { type: "approval.request", id: "send-mail", title: say(lang, "E-posta gönderilsin mi?", "Send the email?"), description: say(lang, "Sonuç, ekibe geri alınamaz biçimde iletilecek.", "The result will be sent to the team and cannot be recalled."), payload: { to: "team@example.com", subject: say(lang, "Kategori özeti", "Category summary"), attachments: 1 } });
  const decision = await waitFor("send-mail");
  yield at(80, { type: "approval.resolved", id: "send-mail", decision });
  if (decision === "approved") {
    yield at(150, { type: "step.start", node: "reviewer", details: say(lang, "Eylem yürütülüyor.", "Running the action.") });
    yield at(600, { type: "step.end", node: "reviewer", details: say(lang, "E-posta gönderildi.", "The email was sent."), output: { verdict: { passed: true, confidence: 0.99 }, calls: [{ tool: "send_email", state: "done", summary: "team@example.com" }] } });
  }
  const text = decision === "approved" ? say(lang, "E-posta ekibe gönderildi.", "The email was sent to the team.") : say(lang, "E-posta gönderilmedi; onay verilmedi.", "The email was not sent; approval was not given.");
  yield* stream(text);
  yield at(0, { type: "final", text, meta: meta({ category: "action", agents: ["planner", "analyst", "reviewer"] }) });
};

const reasoning: Scenario = async function* ({ lang }) {
  yield at(0, { type: "run.start" });
  const thought = say(
    lang,
    "Soru iki parçalı: önce kayıtları bulmam, sonra aralarındaki en yeniyi seçmem gerekiyor. Araştırmacı arama yapsın, denetçi tarihleri doğrulasın. ",
    "The question has two parts: I need to find the records, then pick the newest. The researcher searches, the reviewer verifies the dates. ",
  );
  for (const piece of words(thought)) yield at(/\s/.test(piece) ? 0 : 40, { type: "reasoning.delta", text: piece });
  yield* plan(lang, "researcher", "listing");
  const found = sources(lang, 3);
  yield* research(lang, found);
  yield* review(lang, true, found.length);
  const text = `${say(lang, "En yeni kayıt aşağıdaki.", "The newest record is below.")}\n\n${recordLines(found.slice(0, 1))}\n`;
  yield* stream(text);
  yield at(0, { type: "final", text, meta: meta({ sources: found }) });
};

const fail: Scenario = async function* ({ lang }) {
  yield at(0, { type: "run.start" });
  yield* plan(lang, "researcher", "listing");
  yield at(150, { type: "step.start", node: "researcher", details: say(lang, "Kaynaklar taranıyor.", "Searching the sources.") });
  yield at(600, { type: "error", message: say(lang, "Arama servisi zaman aşımına uğradı.", "The search service timed out."), status: 502 });
};

const drop: Scenario = async function* ({ lang }) {
  yield at(0, { type: "run.start" });
  yield* plan(lang, "researcher", "listing");
  yield at(150, { type: "step.start", node: "researcher", details: say(lang, "Kaynaklar taranıyor.", "Searching the sources.") });
  yield { wait: 700, cut: true };
};

export const SCENARIOS: Record<string, Scenario> = { list, numbers, replan, chart, chat, approval, reasoning, fail, drop };

const RULES: [RegExp, keyof typeof SCENARIOS][] = [
  [/\b(hata|error|fail)\b/i, "fail"],
  [/\b(kopuk|kopma|drop|cut)\b/i, "drop"],
  [/\b(onay|e-?posta|mail|email|approve|approval)\b/i, "approval"],
  [/\b(düşün|dusun|akıl|reason|think)/i, "reasoning"],
  [/\b(grafik|chart|plot|bar)\b/i, "chart"],
  [/\b(tekrar|yeniden|replan|retry|ilk|first)\b/i, "replan"],
  [/\b(kaç|kac|say[ıi]|count|how many|sql|kategori)/i, "numbers"],
  [/^\s*(merhaba|selam|hello|hi|hey)\b/i, "chat"],
];

/** The scenario a question's words point at; a plain listing otherwise. */
export function pickScenario(question: string): keyof typeof SCENARIOS {
  return RULES.find(([pattern]) => pattern.test(question))?.[1] ?? "list";
}
