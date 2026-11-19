/**
 * A small syntax highlighter with no dependency: comments, strings, numbers and
 * keywords. Good enough to read a query or a snippet; swap `CodeBlock`'s renderer
 * for Shiki or Prism if you need more.
 */

export type TokenKind = "comment" | "string" | "number" | "keyword" | "plain";
export interface Token {
  text: string;
  kind: TokenKind;
}

const SQL =
  "select from where group by order having limit offset join left right inner outer on as and or not in is null like between distinct count sum avg min max insert into values update set delete create table alter drop union all case when then else end asc desc with";
const JS =
  "const let var function return if else for while do switch case break continue new class extends import from export default async await try catch finally throw typeof instanceof in of true false null undefined this interface type enum implements public private readonly";
const PY =
  "def class return if elif else for while in not and or is import from as with try except finally raise lambda yield pass break continue None True False self async await";
const SH = "if then else fi for do done while case esac function export echo cd ls cat grep sed awk curl npm git docker";

const KEYWORDS: Record<string, Set<string>> = {
  sql: new Set(SQL.split(" ")),
  js: new Set(JS.split(" ")),
  py: new Set(PY.split(" ")),
  sh: new Set(SH.split(" ")),
};

const ALIASES: Record<string, string> = {
  sql: "sql",
  postgresql: "sql",
  js: "js",
  jsx: "js",
  ts: "js",
  tsx: "js",
  javascript: "js",
  typescript: "js",
  json: "json",
  py: "py",
  python: "py",
  sh: "sh",
  bash: "sh",
  shell: "sh",
  zsh: "sh",
};

const COMMENT: Record<string, RegExp> = {
  sql: /^--[^\n]*|^\/\*[\s\S]*?\*\//,
  js: /^\/\/[^\n]*|^\/\*[\s\S]*?\*\//,
  py: /^#[^\n]*/,
  sh: /^#[^\n]*/,
  json: /^$a/,
};
const STRING = /^("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)/;
const NUMBER = /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i;
const WORD = /^[A-Za-z_][A-Za-z0-9_]*/;

export function languageOf(name: string | null | undefined): string | null {
  return name ? (ALIASES[name.toLowerCase()] ?? null) : null;
}

export function highlight(code: string, language: string | null | undefined): Token[] {
  const lang = languageOf(language);
  if (!lang) return [{ text: code, kind: "plain" }];
  const keywords = KEYWORDS[lang] ?? new Set<string>();
  const sqlLike = lang === "sql";
  const tokens: Token[] = [];
  let plain = "";
  const pushPlain = () => {
    if (plain) tokens.push({ text: plain, kind: "plain" });
    plain = "";
  };

  let rest = code;
  while (rest.length) {
    const comment = COMMENT[lang]?.exec(rest);
    const string = STRING.exec(rest);
    const number = NUMBER.exec(rest);
    const word = WORD.exec(rest);
    const match = comment
      ? { kind: "comment" as const, text: comment[0] }
      : string
        ? { kind: "string" as const, text: string[0] }
        : number && !/[A-Za-z_]$/.test(plain)
          ? { kind: "number" as const, text: number[0] }
          : word
            ? { kind: keywords.has(sqlLike ? word[0].toLowerCase() : word[0]) ? ("keyword" as const) : ("plain" as const), text: word[0] }
            : null;
    if (!match) {
      plain += rest[0];
      rest = rest.slice(1);
      continue;
    }
    if (match.kind === "plain") plain += match.text;
    else {
      pushPlain();
      tokens.push(match);
    }
    rest = rest.slice(match.text.length);
  }
  pushPlain();
  return tokens;
}
