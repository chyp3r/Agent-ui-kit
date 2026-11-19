import { describe, expect, it } from "vitest";

import { chartOf, parseAnswer, parseMermaidChart, parseRecordLine } from "./parse";

describe("parseAnswer", () => {
  it("splits markdown at blank lines", () => {
    expect(parseAnswer("one\n\ntwo")).toEqual([
      { kind: "markdown", text: "one" },
      { kind: "markdown", text: "two" },
    ]);
  });

  it("groups consecutive record lines into one block", () => {
    const blocks = parseAnswer("intro\n- 20/04/2026 08:30 - [db-1] - first\n- 2026-04-20 09:00 - [db-2] - second\nafter");
    expect(blocks.map((block) => block.kind)).toEqual(["markdown", "records", "markdown"]);
    expect((blocks[1] as { items: unknown[] }).items).toHaveLength(2);
    expect(parseRecordLine("- 20/04/2026 08:30 - [db-1] - first")).toEqual({ time: "20/04/2026 08:30", tag: "db-1", text: "first" });
  });

  it("turns a mermaid pie and xychart into chart blocks", () => {
    const pie = parseMermaidChart('pie title Share\n"a" : 3\n"b" : 1');
    expect(pie).toMatchObject({ type: "pie", title: "Share", labels: ["a", "b"], values: [3, 1] });
    const xy = parseMermaidChart('xychart-beta\n title "Count"\n x-axis ["x","y"]\n y-axis "n"\n bar [1, 2]');
    expect(xy).toMatchObject({ type: "bar", title: "Count", labels: ["x", "y"], values: [1, 2], yLabel: "n" });
  });

  it("reads a JSON chart fence", () => {
    const blocks = parseAnswer('```chart\n{"type":"line","title":"t","labels":["a"],"values":[1]}\n```');
    expect(blocks[0]).toMatchObject({ kind: "chart", chart: { type: "line", labels: ["a"] } });
  });

  it("shows a half-written chart fence as pending while streaming and as code after", () => {
    expect(parseAnswer("```mermaid\npie", true)).toEqual([{ kind: "pending", language: "mermaid" }]);
    expect(parseAnswer("```mermaid\npie", false)[0]).toMatchObject({ kind: "code", language: "mermaid" });
  });

  it("keeps other fences as one code block, blank lines included", () => {
    expect(parseAnswer("```ts\nconst a = 1;\n\nconst b = 2;\n```")).toEqual([
      { kind: "code", language: "ts", code: "const a = 1;\n\nconst b = 2;" },
    ]);
  });

  it("falls back to code for a chart fence it cannot read", () => {
    expect(parseAnswer("```mermaid\ngraph TD\n```")[0]).toMatchObject({ kind: "code" });
  });

  it("accepts a fence handler and a line rule of your own", () => {
    const blocks = parseAnswer("```kv\na=1\n```\n* todo: milk\n* todo: eggs", false, {
      fences: { kv: (body) => ({ kind: "kv", data: body }) },
      lines: [{ kind: "todo", match: (line) => /^\* todo: (.*)$/.exec(line)?.[1] ?? null }],
    });
    expect(blocks).toEqual([
      { kind: "kv", data: "a=1" },
      { kind: "todo", items: ["milk", "eggs"] },
    ]);
  });

  it("keeps the identity-relevant text of finished blocks stable as the answer grows", () => {
    const first = parseAnswer("alpha\n\nbeta");
    const second = parseAnswer("alpha\n\nbeta gamma");
    expect(second[0]).toEqual(first[0]);
  });
});

describe("chartOf", () => {
  it("prefers the backend's payload over the report's fence", () => {
    const payload = { type: "bar" as const, title: "p", labels: ["a"], values: [1] };
    expect(chartOf(payload, '```chart\n{"labels":["z"],"values":[9]}\n```')).toBe(payload);
    expect(chartOf(null, '```chart\n{"labels":["z"],"values":[9]}\n```')?.labels).toEqual(["z"]);
    expect(chartOf(null, "no chart")).toBeNull();
  });
});
