import { defineAgentKit } from "../registry/kit";

/**
 * A small team with nothing domain-specific in it: a planner that routes, a
 * researcher, an analyst, a reviewer that can send the work back, a charter and a
 * chat assistant. The mock server plays runs for exactly these nodes. Copy this
 * file, rename the nodes to your own graph's, and pass the result to `<AgentApp kit>`.
 */
export const demoKit = defineAgentKit({
  brand: { name: "Agent Kit", subtitle: "Multi-agent UI" },
  entryNode: "planner",
  endingNodes: ["assistant", "charter", "operator"],
  smallTalkCategories: ["chat"],
  agents: [
    {
      node: "planner",
      name: { tr: "Planlayıcı", en: "Planner" },
      role: { tr: "Planlama ajanı", en: "Planning agent" },
      purpose: { tr: "Soruyu anlar, hangi uzmanın çalışacağına karar verir.", en: "Reads the question and decides which specialist works on it." },
      status: { tr: "Soruyu anlıyoruz, planı kuruyoruz.", en: "Understanding the question and making a plan." },
      avatar: "planner",
      mainTool: "make_plan",
    },
    {
      node: "researcher",
      name: { tr: "Araştırmacı", en: "Researcher" },
      role: { tr: "Arama ajanı", en: "Search agent" },
      purpose: { tr: "Kaynakları filtre ve anlamsal aramayla tarar.", en: "Scans sources with filters and semantic search." },
      status: { tr: "Kaynakları tarıyoruz.", en: "Searching the sources." },
      avatar: "searcher",
      mainTool: "search",
    },
    {
      node: "analyst",
      name: { tr: "Analist", en: "Analyst" },
      role: { tr: "Sorgu ajanı", en: "Query agent" },
      purpose: { tr: "Veriyi sorgular, sayar ve özetler.", en: "Queries the data, counts and summarises." },
      status: { tr: "Veriyi sorguluyoruz.", en: "Querying the data." },
      avatar: "analyst",
      mainTool: "run_query",
    },
    {
      node: "reviewer",
      name: { tr: "Denetçi", en: "Reviewer" },
      role: { tr: "Doğrulama ajanı", en: "Verification agent" },
      purpose: { tr: "Plan ve bulguları denetler, raporu yazar.", en: "Checks the plan and findings, writes the report." },
      status: { tr: "Bulguları denetliyoruz, raporu hazırlıyoruz.", en: "Reviewing the findings and preparing the report." },
      avatar: "reviewer",
      mainTool: "verify",
    },
    {
      node: "charter",
      name: { tr: "Grafiker", en: "Charter" },
      role: { tr: "Görselleştirme ajanı", en: "Visualisation agent" },
      purpose: { tr: "Doğrulanmış veriden grafik üretir.", en: "Draws a chart from verified data." },
      status: { tr: "Grafiği hazırlıyoruz.", en: "Preparing the chart." },
      avatar: "charter",
      mainTool: "render_chart",
    },
    {
      node: "operator",
      name: { tr: "Operatör", en: "Operator" },
      role: { tr: "Devir ajanı", en: "Handoff agent" },
      purpose: { tr: "Otomatik çözülemeyen soruyu bir insana devreder.", en: "Hands a question it cannot settle to a person." },
      status: { tr: "Devir notunu hazırlıyoruz.", en: "Preparing the handoff note." },
      avatar: "operator",
      mainTool: "escalate",
    },
    {
      node: "assistant",
      name: { tr: "Asistan", en: "Assistant" },
      role: { tr: "Sohbet ajanı", en: "Chat agent" },
      purpose: { tr: "Selamlaşma ve genel soruları yanıtlar.", en: "Answers greetings and general questions." },
      status: { tr: "Yanıtı hazırlıyoruz.", en: "Preparing the reply." },
      avatar: "helper",
      mainTool: "reply",
    },
  ],
  tools: {
    make_plan: {
      label: { tr: "Çalışma planı üretme", en: "Make a plan" },
      short: { tr: "Plan", en: "Plan" },
      reason: { tr: "Sorunun türünü belirleyip uygun uzmanı ve adımları seçmek için.", en: "To classify the question and pick the specialist and steps." },
      icon: "route",
    },
    search: {
      label: { tr: "Kaynaklarda arama", en: "Search sources" },
      short: { tr: "Ara", en: "Search" },
      reason: { tr: "Filtre ve anlamsal eşleşmeyle ilgili kayıtları bulmak için.", en: "To find the relevant records by filter and semantic match." },
      icon: "search",
    },
    run_query: {
      label: { tr: "Veri sorgusu", en: "Run a query" },
      short: { tr: "Sorgu", en: "Query" },
      reason: { tr: "Sayım ve özet gibi kesin değerleri doğrudan veriden almak için.", en: "To get exact values such as counts straight from the data." },
      icon: "database",
    },
    verify: {
      label: { tr: "Plan ve bulgu denetimi", en: "Review the findings" },
      short: { tr: "Denetim", en: "Review" },
      reason: { tr: "Bulunanların sorunun koşullarını karşıladığını kontrol etmek için.", en: "To check the findings meet the question's conditions." },
      icon: "clipboard-check",
    },
    write_report: {
      label: { tr: "Rapor yazma", en: "Write the report" },
      short: { tr: "Rapor", en: "Report" },
      reason: { tr: "Cevabı bulunan kayıtlarla birebir tutarlı yazmak için.", en: "To write an answer that matches the findings exactly." },
      icon: "file-text",
    },
    render_chart: {
      label: { tr: "Grafik üretme", en: "Draw a chart" },
      short: { tr: "Grafik", en: "Chart" },
      reason: { tr: "Doğrulanmış sayıları modele yazdırmadan grafiğe dökmek için.", en: "To turn verified numbers into a chart without the model retyping them." },
      icon: "chart",
    },
    send_email: {
      label: { tr: "E-posta gönderme", en: "Send an email" },
      short: { tr: "E-posta", en: "Email" },
      reason: { tr: "Sonucu dışarıya ileten, geri alınamaz bir eylem; onay gerektirir.", en: "An outward, irreversible action; it needs approval." },
      icon: "mail",
    },
    escalate: {
      label: { tr: "İnsana devretme", en: "Hand off to a person" },
      short: { tr: "Devret", en: "Handoff" },
      reason: { tr: "Otomatik doğrulanamayan sonucu insan incelemesine aktarmak için.", en: "To pass an unverifiable result to human review." },
      icon: "headset",
    },
    reply: {
      label: { tr: "Yanıt yazma", en: "Write a reply" },
      short: { tr: "Yanıt", en: "Reply" },
      reason: { tr: "Kaynak gerektirmeyen soruya doğrudan yanıt vermek için.", en: "To answer a question that needs no sources directly." },
      icon: "message",
    },
  },
  categories: {
    listing: { tr: "Kayıt listesi", en: "Record list" },
    numbers: { tr: "Sayısal özet", en: "Numeric summary" },
    timeline: { tr: "Kronolojik sıralama", en: "Timeline" },
    composite: { tr: "Çok adımlı analiz", en: "Multi-step analysis" },
    chart: { tr: "Grafik", en: "Chart" },
    action: { tr: "Eylem", en: "Action" },
    chat: { tr: "Sohbet", en: "Chat" },
  },
  transitions: {
    "planner:researcher": { tr: "Aramaya yönlendirildi", en: "Routed to search" },
    "planner:analyst": { tr: "Veri sorgusuna yönlendirildi", en: "Routed to the query" },
    "planner:assistant": { tr: "Doğrudan yanıta yönlendirildi", en: "Routed straight to a reply" },
    "researcher:reviewer": { tr: "Bulunanlar denetime aktarıldı", en: "Findings sent to review" },
    "analyst:reviewer": { tr: "Sorgu sonucu denetime aktarıldı", en: "Query result sent to review" },
    "reviewer:planner": { tr: "Eksik bulundu, yeniden planlanıyor", en: "Gaps found, planning again" },
    "reviewer:charter": { tr: "Onaylanan veri görselleştirmeye aktarıldı", en: "Verified data sent to charting" },
    "reviewer:operator": { tr: "Deneme sınırı doldu, insana devredildi", en: "Out of attempts, handed to a person" },
  },
});
