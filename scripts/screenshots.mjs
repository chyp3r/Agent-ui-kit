#!/usr/bin/env node
/**
 * Regenerates ss/*.png from the running stack (`docker compose up --build`, mock backend).
 *
 *   npm i --no-save playwright-core
 *   node scripts/screenshots.mjs [baseUrl]
 *
 * Uses the Chrome installed on this machine; nothing is added to package.json.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:8080";
const OUT = new URL("../ss/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });

async function open({ theme = "dark", lang = "tr", width = 1440, height = 900, path = "" } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: theme,
    reducedMotion: "no-preference",
  });
  await context.addInitScript((value) => {
    try {
      localStorage.setItem("agent-kit:theme", value);
    } catch {}
  }, theme);
  const page = await context.newPage();
  await page.goto(`${BASE}/${path}${path.includes("?") ? "&" : "?"}lang=${lang}`);
  await page.waitForSelector("textarea, [role=status], main");
  return { context, page };
}

const labels = {
  tr: { box: "Sorunuz", verified: "Doğrulandı", approve: "Onayla" },
  en: { box: "Your question", verified: "Verified", approve: "Approve" },
};

async function ask(page, question, lang = "tr") {
  await page.getByLabel(labels[lang].box).fill(question);
  await page.keyboard.press("Enter");
}

async function settle(page, ms = 700) {
  await page.waitForTimeout(ms);
}

async function shot(page, name) {
  await settle(page);
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log("wrote", name);
}

// 1. The first screen
{
  const { context, page } = await open();
  await page.getByText("Kayıt arama").waitFor();
  await shot(page, "01-home");
  await context.close();
}

// 2. A chart answer with the live flow map beside it
{
  const { context, page } = await open();
  await ask(page, "Kategorilere göre kayıt sayılarını bar grafik olarak göster");
  await page.getByText(labels.tr.verified).first().waitFor({ timeout: 30000 });
  await page.getByText("Çalışma özeti").first().waitFor();
  await shot(page, "02-chart-answer-and-flow");

  // 3. Step detail: the query the analyst ran, and its result
  await page.getByRole("button", { name: /Veri sorgusu/ }).first().click();
  await shot(page, "03-step-detail-query");
  await context.close();
}

// 4. A replan: the reviewer sent the work back to the planner
{
  const { context, page } = await open();
  await ask(page, "ilk ve son kayıt hangileri? tekrar dene");
  await page.getByText(labels.tr.verified).first().waitFor({ timeout: 40000 });
  await page.getByText("Çalışma özeti").first().waitFor();
  await page.getByText(/yeniden planlanıyor/).first().scrollIntoViewIfNeeded();
  await shot(page, "04-replan-loop");

  // 5. Sources behind the answer
  await page.getByRole("button", { name: /Kaynakları aç/ }).click();
  await shot(page, "05-sources");
  await context.close();
}

// 6. A run waiting for a person's approval
{
  const { context, page } = await open();
  await ask(page, "sonucu e-posta ile gönder");
  await page.getByRole("button", { name: labels.tr.approve }).waitFor({ timeout: 30000 });
  await shot(page, "06-human-approval");
  await context.close();
}

// 7. Streamed reasoning while the run is live
{
  const { context, page } = await open();
  await ask(page, "bunu düşün ve en yeni kaydı bul");
  await page.getByText("Düşünüyor…").waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
  await shot(page, "07-live-reasoning");
  await context.close();
}

// 8. Light theme
{
  const { context, page } = await open({ theme: "light", height: 1180 });
  await ask(page, "Son 30 günün kayıtlarını listele");
  await page.getByText(labels.tr.verified).first().waitFor({ timeout: 30000 });
  await page.getByText("Çalışma özeti").first().waitFor();
  await shot(page, "08-light-theme");
  await context.close();
}

// 9. English
{
  const { context, page } = await open({ lang: "en" });
  await ask(page, "Show record counts by category as a bar chart", "en");
  await page.getByText(labels.en.verified).first().waitFor({ timeout: 30000 });
  await page.getByText("Run summary").first().waitFor();
  await shot(page, "09-english");
  await context.close();
}

// 10. A failed run keeps its place and says what went wrong
{
  const { context, page } = await open();
  await ask(page, "bu hata versin");
  await page.getByRole("alert").waitFor({ timeout: 30000 });
  await shot(page, "10-error-state");
  await context.close();
}

// 11. The component gallery
{
  const { context, page } = await open({ path: "?view=gallery" });
  await page.getByText("Agent Kit · Gallery").waitFor();
  await shot(page, "11-gallery");
  await context.close();
}

// 12. Phone width
{
  const { context, page } = await open({ width: 390, height: 844 });
  await ask(page, "Kategorilere göre kayıt sayılarını bar grafik olarak göster");
  await page.getByText(labels.tr.verified).first().waitFor({ timeout: 30000 });
  await shot(page, "12-mobile");
  await context.close();
}

await browser.close();
