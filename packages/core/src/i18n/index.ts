export type Locale = "tr" | "en";

export const DEFAULT_LOCALE: Locale = "tr";

/** Text in one language or several. Kit configuration uses it for names and labels. */
export type LText = string | Partial<Record<Locale, string>>;

export function resolveText(text: LText | undefined, locale: Locale = DEFAULT_LOCALE): string {
  if (text === undefined) return "";
  if (typeof text === "string") return text;
  return text[locale] ?? text[DEFAULT_LOCALE] ?? Object.values(text)[0] ?? "";
}

/** `{name}` placeholders. A variable that is missing is left visible, not swallowed. */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}
