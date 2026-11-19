import {
  createTranslator,
  demoKit,
  foldText,
  formatClock,
  formatCount,
  formatDuration,
  formatPercent,
  type AgentKit,
  type Locale,
  type Messages,
  type ResolvedAgent,
  type ResolvedTool,
  type Translator,
} from "@agent-kit/core";
import { createContext, useContext, useMemo, type ReactNode } from "react";

import "../renderers/defaults";
import { defaultRenderers, type Renderers } from "../renderers/registry";

/** Everything a component needs to speak the UI's language and know the team. */
export interface KitContextValue {
  kit: AgentKit;
  locale: Locale;
  t: Translator;
  renderers: Renderers;
  agent: (node: string, serverTitle?: string) => ResolvedAgent;
  tool: (tool: string) => ResolvedTool;
  category: (category: string | null | undefined) => string | null;
  transition: (from: string, to: string) => string;
  fmt: {
    count: (value: number) => string;
    duration: (ms: number | null | undefined) => string;
    clock: (seconds: number) => string;
    percent: (score: number | null | undefined) => string | null;
    fold: (text: string) => string;
  };
}

const KitContext = createContext<KitContextValue | null>(null);

export function AgentKitProvider({
  kit = demoKit,
  locale = "tr",
  messages,
  renderers,
  children,
}: {
  kit?: AgentKit;
  locale?: Locale;
  /** Override any UI string, in this locale. */
  messages?: Partial<Messages>;
  renderers?: Partial<Renderers>;
  children: ReactNode;
}) {
  const value = useMemo<KitContextValue>(
    () => ({
      kit,
      locale,
      t: createTranslator(locale, messages),
      renderers: {
        blocks: { ...defaultRenderers.blocks, ...renderers?.blocks },
        outputs: { ...defaultRenderers.outputs, ...renderers?.outputs },
      },
      agent: (node, serverTitle) => kit.agent(node, serverTitle, locale),
      tool: (tool) => kit.tool(tool, locale),
      category: (category) => kit.category(category, locale),
      transition: (from, to) => kit.transition(from, to, locale),
      fmt: {
        count: (value) => formatCount(value, locale),
        duration: (ms) => formatDuration(ms, locale),
        clock: (seconds) => formatClock(seconds, locale),
        percent: (score) => formatPercent(score, locale),
        fold: (text) => foldText(text, locale),
      },
    }),
    [kit, locale, messages, renderers],
  );
  return <KitContext.Provider value={value}>{children}</KitContext.Provider>;
}

const FALLBACK: KitContextValue = (() => {
  const kit = demoKit;
  const locale: Locale = "tr";
  return {
    kit,
    locale,
    t: createTranslator(locale),
    renderers: defaultRenderers,
    agent: (node, title) => kit.agent(node, title, locale),
    tool: (tool) => kit.tool(tool, locale),
    category: (category) => kit.category(category, locale),
    transition: (from, to) => kit.transition(from, to, locale),
    fmt: {
      count: (value) => formatCount(value, locale),
      duration: (ms) => formatDuration(ms, locale),
      clock: (seconds) => formatClock(seconds, locale),
      percent: (score) => formatPercent(score, locale),
      fold: (text) => foldText(text, locale),
    },
  };
})();

/** Works without a provider (demo kit, Turkish), so a single component can be used on its own. */
export function useKit(): KitContextValue {
  return useContext(KitContext) ?? FALLBACK;
}
