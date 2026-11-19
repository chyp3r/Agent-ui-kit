import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/** sRGB relative luminance (WCAG 2.1 §relative-luminance). */
function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function ratio(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

const css = readFileSync(resolve(__dirname, "../styles/tokens.css"), "utf8");

/** The token → value map of the block that starts at `selector`. */
function tokensOf(selector: string, base: Record<string, string> = {}): Record<string, string> {
  const start = css.indexOf(selector);
  expect(start, `${selector} block`).toBeGreaterThanOrEqual(0);
  const block = css.slice(start, css.indexOf("\n}", start));
  const tokens = { ...base };
  for (const line of block.split("\n")) {
    const match = line.match(/^\s*(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6});/);
    if (match) tokens[match[1]] = match[2];
  }
  return tokens;
}

const dark = tokensOf(":root {");
const themes: Record<string, Record<string, string>> = {
  dark,
  light: tokensOf(':root[data-theme="light"] {', dark),
};

describe.each(Object.entries(themes))("the %s palette", (_name, tokens) => {
  const grounds = ["--background", "--sidebar", "--card", "--card-raised", "--popover", "--secondary"];

  it("keeps body and secondary text at AA on every surface it sits on", () => {
    for (const ground of grounds) {
      for (const text of ["--foreground", "--secondary-foreground", "--muted-foreground"]) {
        expect(ratio(tokens[text], tokens[ground]), `${text} on ${ground}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps the coloured text at AA where it is used as text", () => {
    for (const text of ["--primary", "--accent-foreground", "--warning", "--destructive"]) {
      expect(ratio(tokens[text], tokens["--card"]), text).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the label on a primary button legible", () => {
    expect(ratio(tokens["--primary-foreground"], tokens["--primary"])).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps code and tag text legible on the code surface", () => {
    expect(ratio(tokens["--code-fg"], tokens["--code-bg"])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(tokens["--muted-foreground"], tokens["--code-bg"])).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the marks visible against the chart's surface", () => {
    for (const slot of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(ratio(tokens[`--chart-${slot}`], tokens["--card"]), `--chart-${slot}`).toBeGreaterThanOrEqual(3);
    }
  });
});
