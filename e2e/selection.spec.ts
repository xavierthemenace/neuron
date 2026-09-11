import { expect, test } from "@playwright/test";
import {
  collectPageErrors,
  gotoApp,
  node,
  openNode,
  panelOf,
  selectNode,
} from "./helpers";

/**
 * Selection, focus and the render-loop regression.
 *
 * This file exists mainly for the last test in it. Twice now, app-owned
 * selection and React Flow's internal selection have become competing sources
 * of truth and produced a "Maximum update depth exceeded" loop that no unit
 * test could ever have caught. Every interaction that previously triggered it
 * is exercised here.
 */

test.describe("node selection", () => {
  test("opens a node, shows its panel, and closes on pane click", async ({ page }) => {
    await gotoApp(page);

    await openNode(page, "log-probability");
    const panel = panelOf(page);
    await expect(panel.getByRole("heading", { name: "Probabilistic Thinking" })).toBeVisible();

    await page.locator(".react-flow__pane").click({ position: { x: 40, y: 400 } });
    await expect(panel).toHaveAttribute("data-open", "false");
  });

  test("closes the panel on Escape", async ({ page }) => {
    await gotoApp(page);
    await openNode(page, "gwm-span");
    await page.keyboard.press("Escape");
    await expect(panelOf(page)).toHaveAttribute("data-open", "false");
  });

  test("switches directly from one node to another", async ({ page }) => {
    await gotoApp(page);
    await openNode(page, "log-probability");
    await node(page, "log-estimation").click();
    await expect(
      panelOf(page).getByRole("heading", { name: "Fermi Estimation" }),
    ).toBeVisible();
  });

  test("navigates to a neighbour from inside the panel", async ({ page }) => {
    await gotoApp(page);
    await openNode(page, "epi-bayesian");

    const panel = panelOf(page);
    await panel.getByRole("button", { name: /Probabilistic Thinking/ }).first().click();
    await expect(panel.getByRole("heading", { name: "Probabilistic Thinking" })).toBeVisible();
  });

  test("moves between nodes with the arrow keys", async ({ page }) => {
    await gotoApp(page);
    await node(page, "gwm-span").click();
    await node(page, "gwm-span").focus();

    const before = await panelOf(page).getByRole("heading").first().textContent();
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => panelOf(page).getByRole("heading").first().textContent())
      .not.toBe(before);
  });

  test("reaches a node by keyboard alone", async ({ page }) => {
    await gotoApp(page);
    // Tab into the graph and open whatever node lands under focus.
    await page.locator(".react-flow__node").first().focus();
    await page.keyboard.press("Enter");
    await expect(panelOf(page)).toBeVisible();
  });

  /**
   * The regression test.
   *
   * Rapid open/switch/close cycling is what produced the update loop, because
   * each transition had a window in which React Flow's selection change could
   * write back into app state mid-update. If that ever returns, this hangs or
   * floods the console — both of which fail here.
   */
  test("survives rapid selection churn without a render loop", async ({ page }) => {
    test.slow();
    const errors = collectPageErrors(page);
    await gotoApp(page);

    const ids = [
      "log-probability",
      "epi-bayesian",
      "dec-calibration",
      "gwm-span",
      "exec-planning",
      "cre-divergent",
    ];

    for (let round = 0; round < 2; round += 1) {
      for (const id of ids) {
        await selectNode(page, id);
      }
      await page.locator(".react-flow__pane").click({ position: { x: 30, y: 300 } });
      await page.keyboard.press("Escape");
    }

    // Toggling Focus Mode while switching selection was the other trigger:
    // Focus Mode re-frames the camera, which re-enters the same update path
    // that selection does.
    await selectNode(page, "log-probability");
    const panel = panelOf(page);
    for (let round = 0; round < 3; round += 1) {
      await panel.getByRole("switch", { name: "Focus Mode" }).click();
      await selectNode(page, "epi-bayesian");
      await selectNode(page, "log-probability");
    }

    // The page must still be interactive, and nothing may have looped.
    await expect(panel.getByRole("heading").first()).toBeVisible();
    expect(errors, `render errors: ${errors.join(" | ")}`).toEqual([]);
  });

  test("keeps Escape ordering when a modal sits above the panel", async ({ page }) => {
    await gotoApp(page);
    await openNode(page, "log-probability");

    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByRole("dialog", { name: "Neuron command palette" });
    await expect(palette).toBeVisible();

    // First Escape peels the palette, not the panel underneath it.
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
    await expect(panelOf(page)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(panelOf(page)).toHaveAttribute("data-open", "false");
  });
});
