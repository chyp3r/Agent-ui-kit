import type { Locale } from "./i18n";

/** Display formatting by locale. Durations are this browser's own measurement. */

const LOCALES: Record<Locale, string> = { tr: "tr-TR", en: "en-US" };
const UNITS: Record<Locale, { ms: string; s: string; m: string }> = {
  tr: { ms: "ms", s: "sn", m: "dk" },
  en: { ms: "ms", s: "s", m: "min" },
};

const cache = new Map<string, Intl.NumberFormat>();
function numberFormat(locale: Locale, decimals = 0): Intl.NumberFormat {
  const key = `${locale}:${decimals}`;
  let format = cache.get(key);
  if (!format) {
    format = new Intl.NumberFormat(LOCALES[locale], { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    cache.set(key, format);
  }
  return format;
}

export function formatCount(value: number, locale: Locale = "tr"): string {
  return numberFormat(locale).format(value);
}

export function formatDuration(ms: number | null | undefined, locale: Locale = "tr"): string {
  if (ms == null) return "—";
  const unit = UNITS[locale];
  if (ms < 1000) return `${Math.round(ms)} ${unit.ms}`;
  if (ms < 59_950) return `${numberFormat(locale, 1).format(ms / 1000)} ${unit.s}`;
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return seconds ? `${minutes} ${unit.m} ${seconds} ${unit.s}` : `${minutes} ${unit.m}`;
}

/** A running clock: whole seconds, then minutes and seconds. */
export function formatClock(totalSeconds: number, locale: Locale = "tr"): string {
  const unit = UNITS[locale];
  if (totalSeconds < 60) return `${totalSeconds} ${unit.s}`;
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes} ${unit.m} ${String(totalSeconds % 60).padStart(2, "0")} ${unit.s}`;
}

/** 0..1 → "%85" in Turkish, "85%" in English. */
export function formatPercent(score: number | null | undefined, locale: Locale = "tr"): string | null {
  if (score == null || Number.isNaN(score)) return null;
  const value = Math.round(score * 100);
  return locale === "tr" ? `%${value}` : `${value}%`;
}

/** Locale casing, so "İzmir" is found by typing "izmir" and by "İZMİR". */
export function foldText(text: string, locale: Locale = "tr"): string {
  return text.toLocaleLowerCase(locale === "tr" ? "tr" : "en");
}
