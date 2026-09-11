import { expect, test } from "@playwright/test";
import { gotoApp, openNode, panelOf } from "./helpers";

/**
 * Visual regression.
 *
 * Guards the states where a styling change would silently destroy meaning:
 * the graph's visual encoding, the evidence panel, and every overlay. The
 * tolerance is deliberately loose — these exist to catch a layout collapsing or
 * a legend disappearing, not to fail on a one-pixel font hinting difference.
 */

const SNAPSHOT = {
  maxDiffPixelRatio: 0.02,
  animations: "disabled" as const,
};

/** Hides everything whose content legitimately changes between runs. */
async function stabilise(page: import("@playwright/test").Page) {
  await page.addStyleTag({
    content: `
      /* Signal particles and pulse animations never settle. */
      .react-flow__edge circle, .animate-node-pulse { visibility: hidden !important; }
      *, *::before, *::after {
        animation-play-state: paused !important;
        transition: none !important;
      }
    `,
  });
}

test.describe("visual regression", () => {
  test("default graph", async ({ page }) => {
    await gotoApp(page);
    await page.locator(".react-flow__controls-fitview").click();
    await page.waitForTimeout(900);
    await stabilise(page);
    await expect(page).toHaveScreenshot("graph-default.png", SNAPSHOT);
  });

  test("selected node with the panel open", async ({ page }) => {
    await gotoApp(page);
    await openNode(page, "epi-bayesian");
    await page.waitForTimeout(900);
    await stabilise(page);
    await expect(page).toHaveScreenshot("graph-selected.png", SNAPSHOT);
  });

  test("focus mode", async ({ page }) => {
    await gotoApp(page);
    await openNode(page, "epi-bayesian");
    await panelOf(page).getByRole("switch", { name: "Focus Mode" }).click();
    await page.waitForTimeout(1000);
    await stabilise(page);
    await expect(page).toHaveScreenshot("graph-focus-mode.png", SNAPSHOT);
  });

  test("evidence panel", async ({ page }) => {
    await gotoApp(page);
    await openNode(page, "gwm-span");
    await panelOf(page).getByRole("tab", { name: "Evidence" }).click();
    await page.waitForTimeout(400);
    await stabilise(page);
    await expect(panelOf(page)).toHaveScreenshot("panel-evidence.png", SNAPSHOT);
  });

  test("command palette", async ({ page }) => {
    await gotoApp(page);
    await page.keyboard.press("ControlOrMeta+k");
    await page.waitForTimeout(400);
    await stabilise(page);
    await expect(
      page.getByRole("dialog", { name: "Neuron command palette" }),
    ).toHaveScreenshot("command-palette.png", SNAPSHOT);
  });

  test("session planner", async ({ page }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: /Plan a training session/ }).click();
    await page.waitForTimeout(500);
    await stabilise(page);
    await expect(page.getByRole("dialog", { name: "Plan a session" })).toHaveScreenshot(
      "session-planner.png",
      SNAPSHOT,
    );
  });

  test("review queue", async ({ page }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: /^Review/ }).click();
    await page.waitForTimeout(400);
    await stabilise(page);
    await expect(page.getByRole("dialog")).toHaveScreenshot("workbench-review.png", SNAPSHOT);
  });

  test("browse view", async ({ page }) => {
    await gotoApp(page);
    await page.keyboard.press("b");
    await page.getByRole("dialog").getByLabel("Search capabilities").fill("causal");
    await page.waitForTimeout(400);
    await stabilise(page);
    await expect(page.getByRole("dialog")).toHaveScreenshot("workbench-browse.png", SNAPSHOT);
  });

  test("legend and filters", async ({ page }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: /^Filter/ }).click();
    await page.waitForTimeout(300);
    await stabilise(page);
    await expect(page.locator("div").filter({ hasText: /amber dot/ }).last()).toHaveScreenshot(
      "legend.png",
      SNAPSHOT,
    );
  });
});
