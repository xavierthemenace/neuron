import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Text contrast, checked against the stylesheet rather than by eye.
 *
 * The palette moved from dark to paper in one change, and a colour that was
 * correct as light-text-on-dark can land anywhere on light. Every pair below
 * is real: a token used for text, on the surface it actually sits on, at a
 * size small enough that WCAG asks for 4.5 rather than 3.
 */

const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

/** The explicit-dark block, which is the theme a person chose on purpose. */
const darkBlock = css.slice(css.indexOf(':root[data-theme="dark"]'));
/** Everything before the overrides: the light palette and its scales. */
const lightBlock = css.slice(0, css.indexOf("@media (prefers-color-scheme: dark)"));

function token(name, scope = lightBlock) {
  const match = scope.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(match, `${name} is not defined as a hex value`);
  return match[1];
}

function luminance(hex) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

const PAPER = "#efece6";
const CARD = "#ffffff";
const WHITE = "#ffffff";

describe("text contrast", () => {
  const cases = [
    ["--ink", PAPER, "body text on the page"],
    ["--ink", CARD, "body text on a card"],
    ["--ink-soft", PAPER, "secondary text on the page"],
    ["--ink-soft", CARD, "secondary text on a card"],
    ["--ink-faint", PAPER, "captions on the page"],
    ["--ink-faint", CARD, "captions on a card"],
    ["--color-neutral-500", CARD, "the most-used muted text colour"],
    ["--color-neutral-600", CARD, "the second most-used muted text colour"],
    ["--color-neutral-600", PAPER, "muted text that lands on the page"],
  ];

  for (const [name, surface, what] of cases) {
    it(`${what} clears 4.5:1`, () => {
      const ratio = contrast(token(name), surface);
      assert.ok(ratio >= 4.5, `${name} on ${surface} is ${ratio.toFixed(2)}:1`);
    });
  }

  it("white on the action colour clears 4.5:1", () => {
    // The Start button's label. 15px bold is not "large text" under WCAG, so
    // the 3:1 allowance does not apply to it.
    const ratio = contrast(WHITE, token("--pop"));
    assert.ok(ratio >= 4.5, `white on --pop is ${ratio.toFixed(2)}:1`);
  });

  it("the hero's text clears 4.5:1 on the green", () => {
    const ratio = contrast("#f3efe7", token("--green"));
    assert.ok(ratio >= 4.5, `hero text is ${ratio.toFixed(2)}:1`);
  });
});

describe("text contrast in dark", () => {
  const GROUND = token("--paper", darkBlock);
  const PANEL = token("--card", darkBlock);

  const cases = [
    ["--ink", PANEL, "body text on a card"],
    ["--ink-soft", GROUND, "secondary text on the page"],
    ["--ink-faint", PANEL, "captions on a card"],
    ["--color-neutral-500", PANEL, "the most-used muted text colour"],
    ["--color-neutral-600", PANEL, "the second most-used muted text colour"],
  ];

  for (const [name, surface, what] of cases) {
    it(`${what} clears 4.5:1`, () => {
      const ratio = contrast(token(name, darkBlock), surface);
      assert.ok(ratio >= 4.5, `${name} on ${surface} is ${ratio.toFixed(2)}:1`);
    });
  }

  it("the action colour carries its own text colour", () => {
    // White on a dark-mode orange does not clear 4.5, which is why the text
    // colour is a token rather than a literal.
    const ratio = contrast(token("--pop-ink", darkBlock), token("--pop", darkBlock));
    assert.ok(ratio >= 4.5, `--pop-ink on --pop is ${ratio.toFixed(2)}:1`);
  });

  it("the hero's text clears 4.5:1 on the green", () => {
    const ratio = contrast("#f3efe7", token("--green", darkBlock));
    assert.ok(ratio >= 4.5, `hero text is ${ratio.toFixed(2)}:1`);
  });
});
