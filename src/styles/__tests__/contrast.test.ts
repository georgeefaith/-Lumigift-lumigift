/**
 * @jest-environment node
 *
 * Design-token colour contrast gate — issue #371.
 *
 * Parses src/styles/tokens.css and asserts every text colour token meets
 * WCAG 2.1 AA (4.5:1 for normal text) against every background token, in
 * both the dark (default) and light themes.
 */
import { readFileSync } from "fs";
import { join } from "path";

const css = readFileSync(join(__dirname, "..", "tokens.css"), "utf8");

const TEXT_TOKENS = [
  "text-primary",
  "text-secondary",
  "text-muted",
  "success",
  "warning",
  "error",
  "info",
];
const BG_TOKENS = ["bg", "bg-surface", "bg-elevated"];
const AA_NORMAL = 4.5;

/** Extracts `--color-*` hex tokens declared in the first block matching `selector`. */
function readBlock(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const block = css.slice(start, css.indexOf("}", start));
  const tokens: Record<string, string> = {};
  for (const [, name, hex] of block.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    tokens[name] = hex;
  }
  return tokens;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const dark = readBlock(":root {");
const themes: Record<string, Record<string, string>> = {
  dark,
  light: { ...dark, ...readBlock('[data-theme="light"] {') },
  "light (system)": { ...dark, ...readBlock(':root:not([data-theme="dark"]) {') },
};

describe.each(Object.entries(themes))("%s theme contrast", (_name, tokens) => {
  const pairs = TEXT_TOKENS.flatMap((fg) => BG_TOKENS.map((bg) => [fg, bg]));

  it.each(pairs)("--color-%s on --color-%s meets 4.5:1", (fg, bg) => {
    expect(contrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});
