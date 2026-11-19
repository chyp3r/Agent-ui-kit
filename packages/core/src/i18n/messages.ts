import { tr } from "./tr";
import { en } from "./en";
import type { Locale } from "./index";
import { interpolate } from "./index";

export type MessageKey = keyof typeof tr;
export type Messages = Record<MessageKey, string>;

export const MESSAGES: Record<Locale, Messages> = { tr, en };

/** A translator for one locale. Unknown keys render as the key, never as nothing. */
export function createTranslator(locale: Locale, overrides?: Partial<Messages>) {
  const table = { ...MESSAGES[locale], ...overrides };
  return (key: MessageKey, vars?: Record<string, string | number>): string => interpolate(table[key] ?? key, vars);
}

export type Translator = ReturnType<typeof createTranslator>;
