import type { ChartData } from "../protocol/events";

/**
 * An answer, read into what the screen draws.
 *
 * The answer arrives as text one word at a time and can run to hundreds of lines.
 * Two shapes in it are worth more than their markdown: a record line reads better as
 * a row, and a chart fence is a chart. Everything else stays markdown. Both are
 * rules you can extend (`AnswerRules`): add a fence language or a line shape, then
 * register a renderer for its `kind` in @agent-kit/react.
 *
 * It is cut into blocks so that a growing answer re-renders only its tail: a block
 * whose text did not change keeps its identity and the renderer skips it.
 */

export interface RecordLine {
  time: string;
  tag: string;
  text: string;
}

export type AnswerBlock =
  | { kind: "markdown"; text: string }
  | { kind: "records"; items: RecordLine[] }
  | { kind: "chart"; chart: ChartData }
  | { kind: "code"; language: string; code: string }
  /** A fence still arriving: its half-written source is nothing to read. */
  | { kind: "pending"; language: string }
  /** What your own fence handler or line rule produced. */
  | { kind: string; data?: unknown; items?: unknown[] };

export interface FenceHandler {
  (body: string): AnswerBlock | null;
}

export interface LineRule {
  kind: string;
  /** Returns the item for a line of this shape, or null. Consecutive items share one block. */
  match(line: string): unknown | null;
}

export interface AnswerRules {
  /** Fence language → block. Returning null shows the fence as plain code. */
  fences?: Record<string, FenceHandler>;
  /** Extra line shapes; the default `records` rule always applies unless you override its kind. */
  lines?: LineRule[];
}

const RECORD =
  /^[-*]\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(?::\d{2})?|\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?)\s+-\s+\[([^\]]+)\]\s+-\s+(.*)$/;
const FENCE = /^```([\w-]*)\s*$/;

export function parseRecordLine(line: string): RecordLine | null {
  const match = RECORD.exec(line.trim());
  return match ? { time: match[1], tag: match[2], text: match[3] } : null;
}

function unquote(value: string): string {
  return value.trim().replace(/^"|"$/g, "");
}

/** The two forms of Mermaid chart a report writes: `pie` and `xychart-beta`. */
export function parseMermaidChart(source: string): ChartData | null {
  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const head = lines[0] ?? "";

  if (head.startsWith("pie")) {
    const title = /title\s+(.+)$/.exec(head)?.[1];
    const labels: string[] = [];
    const values: number[] = [];
    for (const line of lines.slice(1)) {
      const slice = /^"?(.*?)"?\s*:\s*(-?[\d.]+)\s*$/.exec(line);
      if (!slice) continue;
      labels.push(slice[1]);
      values.push(Number(slice[2]));
    }
    return labels.length ? { type: "pie", title: title ? unquote(title) : "", labels, values } : null;
  }

  if (head.startsWith("xychart")) {
    const field = (prefix: string) => lines.find((line) => line.startsWith(prefix));
    const list = (line: string | undefined) => {
      const inner = line ? /\[(.*)\]/.exec(line)?.[1] : undefined;
      return inner ? inner.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(unquote) : [];
    };
    const bar = field("bar");
    const line = field("line");
    const labels = list(field("x-axis"));
    const values = list(bar ?? line).map(Number);
    if (!labels.length || values.length === 0 || values.some(Number.isNaN)) return null;
    const title = field("title");
    const y = /^y-axis\s+"([^"]*)"/.exec(field("y-axis") ?? "")?.[1];
    return {
      type: bar ? "bar" : "line",
      title: title ? unquote(title.slice("title".length)) : "",
      labels,
      values,
      yLabel: y,
    };
  }
  return null;
}

/** A `chart` fence: `{ "type": "bar", "title": "…", "labels": [...], "values": [...] }`. */
export function parseJsonChart(source: string): ChartData | null {
  try {
    const raw = JSON.parse(source) as Partial<ChartData>;
    if (!Array.isArray(raw.labels) || !Array.isArray(raw.values) || raw.labels.length === 0) return null;
    const type = raw.type === "pie" || raw.type === "line" || raw.type === "table" ? raw.type : "bar";
    return { type, title: raw.title ?? "", labels: raw.labels.map(String), values: raw.values.map(Number), yLabel: raw.yLabel };
  } catch {
    return null;
  }
}

const DEFAULT_FENCES: Record<string, FenceHandler> = {
  mermaid: (body) => {
    const chart = parseMermaidChart(body);
    return chart ? { kind: "chart", chart } : null;
  },
  chart: (body) => {
    const chart = parseJsonChart(body);
    return chart ? { kind: "chart", chart } : null;
  },
};

const DEFAULT_LINES: LineRule[] = [{ kind: "records", match: parseRecordLine }];

function codeBlock(language: string, code: string): AnswerBlock {
  return { kind: "code", language, code };
}

/**
 * The answer's blocks, in order. A blank line closes a markdown block; a fence and a
 * run of record lines are blocks of their own. `streaming` only changes what an
 * unclosed handled fence means: still arriving, not an error.
 */
export function parseAnswer(text: string, streaming = false, rules: AnswerRules = {}): AnswerBlock[] {
  const fences = { ...DEFAULT_FENCES, ...rules.fences };
  const lineRules = [...DEFAULT_LINES.filter((base) => !rules.lines?.some((own) => own.kind === base.kind)), ...(rules.lines ?? [])];
  const blocks: AnswerBlock[] = [];
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join("\n").trim();
    buffer = [];
    if (body) blocks.push({ kind: "markdown", text: body });
  };

  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    const fence = FENCE.exec(line.trim());
    if (fence) {
      const language = fence[1];
      const end = lines.findIndex((other, at) => at > index && other.trim() === "```");
      const body = lines.slice(index + 1, end < 0 ? undefined : end).join("\n");
      flush();
      const handler = fences[language];
      if (handler) {
        if (end < 0) {
          blocks.push(streaming ? { kind: "pending", language } : codeBlock(language, body));
          break;
        }
        blocks.push(handler(body) ?? codeBlock(language, body));
      } else {
        blocks.push(codeBlock(language, body));
        if (end < 0) break;
      }
      index = end;
      continue;
    }

    let matched = false;
    for (const rule of lineRules) {
      const item = rule.match(line);
      if (item === null) continue;
      flush();
      const last = blocks[blocks.length - 1] as { kind: string; items?: unknown[] } | undefined;
      if (last?.kind === rule.kind && Array.isArray(last.items)) last.items.push(item);
      else blocks.push({ kind: rule.kind, items: [item] } as AnswerBlock);
      matched = true;
      break;
    }
    if (matched) continue;

    if (!line.trim()) {
      flush();
      continue;
    }
    buffer.push(line);
  }
  flush();
  return blocks;
}

/** The chart a run carries: the backend's own payload first, the report's fence otherwise. */
export function chartOf(payload: ChartData | null | undefined, text: string, rules?: AnswerRules): ChartData | null {
  if (payload?.labels?.length && payload.values?.length) return payload;
  const found = parseAnswer(text, false, rules).find((block) => block.kind === "chart") as
    | { kind: "chart"; chart: ChartData }
    | undefined;
  return found ? found.chart : null;
}
