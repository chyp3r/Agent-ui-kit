import { DEFAULT_LOCALE, resolveText, type LText, type Locale } from "../i18n";
import type { AnswerRules } from "../answer/parse";

export interface AgentDef {
  /** The node name the backend reports. */
  node: string;
  name: LText;
  /** A short noun for the name card. */
  role: LText;
  purpose: LText;
  /** What the status line says while this agent works. */
  status: LText;
  /** Which built-in portrait to draw (see `AVATARS` in @agent-kit/react), or your own key. */
  avatar?: string;
  /** The tool this node is assumed to be running while no tool event has arrived. */
  mainTool?: string;
}

export interface ToolDef {
  label: LText;
  /** Under the icon on the map. */
  short: LText;
  /** Why an agent reaches for it. */
  reason: LText;
  /** A key of the icon set (see `TOOL_ICONS` in @agent-kit/react). */
  icon?: string;
}

export interface AgentKitConfig {
  brand?: { name: string; subtitle?: string };
  agents: AgentDef[];
  tools?: Record<string, ToolDef>;
  categories?: Record<string, LText>;
  /** "from:to" → what the handoff says. Others fall back to "<to> stage". */
  transitions?: Record<string, LText>;
  /** The node every run starts at. Going back to it is a replan. Default: the first agent. */
  entryNode?: string;
  /** Nodes that end the graph: after one of these the answer is being written. */
  endingNodes?: string[];
  /** Nodes that do not open the side panel when they start. Default: the entry node. */
  quietNodes?: string[];
  /** Categories that are only conversation: nothing to verify and no sources to open. */
  smallTalkCategories?: string[];
  /** Whether a question opens the panel as it is sent. Default: not a bare greeting. */
  shouldOpenImmediately?: (question: string) => boolean;
  /** How the answer text is read into blocks: add fences and line shapes of your own. */
  answer?: AnswerRules;
}

export interface AgentKit {
  readonly config: AgentKitConfig;
  readonly brand: { name: string; subtitle?: string };
  readonly entryNode: string;
  agent(node: string, serverTitle?: string, locale?: Locale): ResolvedAgent;
  tool(tool: string, locale?: Locale): ResolvedTool;
  category(category: string | null | undefined, locale?: Locale): string | null;
  transition(from: string, to: string, locale?: Locale): string;
  mainTool(node: string): string;
  isEnding(node: string): boolean;
  isQuiet(node: string): boolean;
  isSmallTalk(category: string | null | undefined): boolean;
  shouldOpenImmediately(question: string): boolean;
  avatarOf(node: string): string;
}

export interface ResolvedAgent {
  node: string;
  name: string;
  role: string;
  purpose: string;
  status: string;
}

export interface ResolvedTool {
  tool: string;
  label: string;
  short: string;
  reason: string;
  icon: string | undefined;
}

const GREETING =
  /^(merhaba|selam|selamlar|günaydın|iyi akşamlar|iyi günler|teşekkürler|teşekkür ederim|sağ ol|sağol|nasılsın|hi|hello|hey|thanks|thank you)$/u;

export function isBareGreeting(question: string): boolean {
  const normalized = question
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[.!?,]+$/u, "")
    .trim();
  return GREETING.test(normalized);
}

const UNKNOWN_AGENT: Record<Locale, { role: string; purpose: string; status: string }> = {
  tr: { role: "Çalışma ajanı", purpose: "Sunucunun bildirdiği ek çalışma adımı.", status: "Ek bir çalışma yürütülüyor." },
  en: { role: "Worker agent", purpose: "An extra step the server reported.", status: "Running an extra step." },
};

const UNKNOWN_TOOL: Record<Locale, string> = {
  tr: "Bu adım, yanıtı hazırlayan iş akışının bir parçası olarak çağrıldı.",
  en: "This step was called as part of the workflow that prepared the answer.",
};

const HANDOFF: Record<Locale, (name: string) => string> = {
  tr: (name) => `${name} aşamasına aktarıldı`,
  en: (name) => `Handed off to ${name}`,
};

/**
 * One object that says who the agents are, what their tools are called and how the
 * run reads, in the UI's language. The node and tool names are the backend's; every
 * label is presentation. A node or tool the kit does not know still renders, under
 * the title the server sent, so adding a specialist on the backend cannot break the screen.
 */
export function defineAgentKit(config: AgentKitConfig): AgentKit {
  const byNode = new Map(config.agents.map((agent) => [agent.node, agent]));
  const entryNode = config.entryNode ?? config.agents[0]?.node ?? "planner";
  const quiet = new Set(config.quietNodes ?? [entryNode]);
  const ending = new Set(config.endingNodes ?? []);
  const smallTalk = new Set(config.smallTalkCategories ?? []);
  const tools = config.tools ?? {};

  return {
    config,
    brand: config.brand ?? { name: "Agent" },
    entryNode,
    agent(node, serverTitle, locale = DEFAULT_LOCALE) {
      const def = byNode.get(node);
      if (def) {
        return {
          node,
          name: resolveText(def.name, locale),
          role: resolveText(def.role, locale),
          purpose: resolveText(def.purpose, locale),
          status: resolveText(def.status, locale),
        };
      }
      return { node, name: serverTitle || node, ...UNKNOWN_AGENT[locale] };
    },
    tool(tool, locale = DEFAULT_LOCALE) {
      const def = tools[tool];
      if (def) {
        return {
          tool,
          label: resolveText(def.label, locale),
          short: resolveText(def.short, locale),
          reason: resolveText(def.reason, locale),
          icon: def.icon,
        };
      }
      return {
        tool,
        label: tool,
        short: tool.length > 12 ? `${tool.slice(0, 11)}…` : tool,
        reason: UNKNOWN_TOOL[locale],
        icon: undefined,
      };
    },
    category(category, locale = DEFAULT_LOCALE) {
      if (!category) return null;
      const label = config.categories?.[category];
      return label ? resolveText(label, locale) : category;
    },
    transition(from, to, locale = DEFAULT_LOCALE) {
      const label = config.transitions?.[`${from}:${to}`];
      if (label) return resolveText(label, locale);
      return HANDOFF[locale](this.agent(to, undefined, locale).name);
    },
    mainTool(node) {
      return byNode.get(node)?.mainTool ?? node;
    },
    isEnding: (node) => ending.has(node),
    isQuiet: (node) => quiet.has(node),
    isSmallTalk: (category) => Boolean(category) && smallTalk.has(category as string),
    shouldOpenImmediately: (question) =>
      config.shouldOpenImmediately ? config.shouldOpenImmediately(question) : !isBareGreeting(question),
    avatarOf: (node) => byNode.get(node)?.avatar ?? "helper",
  };
}

/** A kit with no agents: every node renders under the server's own title. */
export const emptyKit: AgentKit = defineAgentKit({ agents: [] });
