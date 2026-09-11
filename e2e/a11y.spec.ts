import { expect, test } from "@playwright/test";
import { gotoApp, openNode, panelOf } from "./helpers";

/**
 * Accessibility, targeting WCAG 2.2 AA.
 *
 * The load-bearing claim is the last describe block: Neuron must be fully
 * usable without ever touching the spatial map. A capability map that only
 * works for people who can see and drag a canvas is a capability map for some
 * people.
 */

test.describe("focus management", () => {
  test("traps focus inside a modal and restores it on close", async ({ page }) => {
    await gotoApp(page);

    const trigger = page.getByRole("button", { name: /^Review/ });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Focus has moved into the dialog.
    await expect
      .poll(async () =>
        page.evaluate(() => document.activeElement?.closest("[role='dialog']") !== null),
      )
      .toBe(true);

    // Tabbing many times must never escape the dialog.
    for (let index = 0; index < 25; index += 1) {
      await page.keyboard.press("Tab");
    }
    expect(
      await page.evaluate(() => document.activeElement?.closest("[role='dialog']") !== null),
    ).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("leaves the graph keyboard-reachable while the non-modal panel is open", async ({
    page,
  }) => {
    await gotoApp(page);
    await openNode(page, "log-probability");

    // The side panel is deliberately non-modal, so focus can still leave it.
    await page.locator(".react-flow__node").first().focus();
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.classList.contains("react-flow__node")),
      ),
    ).toBe(true);
  });

  test("shows a visible focus indicator on interactive controls", async ({ page }) => {
    await gotoApp(page);
    const button = page.getByRole("button", { name: /^Review/ });
    await button.focus();

    const outline = await button.evaluate((element) => {
      const style = getComputedStyle(element);
      return { width: style.outlineWidth, style: style.outlineStyle };
    });
    expect(outline.style).not.toBe("none");
    expect(Number.parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
  });
});

test.describe("semantics", () => {
  test("labels every node for a screen reader with its state", async ({ page }) => {
    await gotoApp(page);
    const label = await page
      .locator(".react-flow__node")
      .first()
      .getAttribute("aria-label");

    expect(label).toBeTruthy();
    expect(label).toMatch(/percent estimated competence/);
    expect(label).toMatch(/never trained|percent retention/);
  });

  test("gives the graph an accessible description pointing at the list view", async ({
    page,
  }) => {
    await gotoApp(page);
    const description = await page.locator("#react-flow__node-desc-1").textContent();
    expect(description).toMatch(/list view/i);
  });

  test("uses a real heading hierarchy inside the panel", async ({ page }) => {
    await gotoApp(page);
    await openNode(page, "log-probability");

    const levels = await panelOf(page)
      .locator("h2, h3")
      .evaluateAll((elements) => elements.map((element) => element.tagName));
    expect(levels[0]).toBe("H2");
    expect(levels.slice(1).every((tag) => tag === "H3")).toBe(true);
  });

  test("names every form control", async ({ page }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: /^Review/ }).click();
    await page.getByRole("dialog").getByRole("tab", { name: "Predictions" }).click();

    const unnamed = await page.getByRole("dialog").evaluate((dialog) => {
      const controls = dialog.querySelectorAll("input, select, textarea");
      return [...controls].filter((control) => {
        const id = control.getAttribute("id");
        return (
          !control.getAttribute("aria-label") &&
          !control.closest("label") &&
          !(id && dialog.querySelector(`label[for="${id}"]`))
        );
      }).length;
    });
    expect(unnamed).toBe(0);
  });
});

test.describe("no interaction requires dragging", () => {
  /**
   * WCAG 2.2 "Dragging Movements": every drag-only affordance needs a
   * single-pointer alternative. The map pans by drag, so the alternative has to
   * exist and has to be reachable.
   */
  test("can reach and open any capability without touching the canvas", async ({ page }) => {
    await gotoApp(page);

    await page.keyboard.press("b");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("table")).toBeVisible();

    await dialog.getByLabel("Search capabilities").fill("Scenario Planning");
    await dialog.getByRole("button", { name: /Scenario Planning/ }).click();

    await expect(panelOf(page).getByRole("heading", { name: "Scenario Planning" })).toBeVisible();
  });

  test("exposes prerequisites in the list view without the graph", async ({ page }) => {
    await gotoApp(page);
    await page.keyboard.press("b");

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Search capabilities").fill("Bayesian Updating");
    await dialog.getByRole("button", { name: "more" }).first().click();

    await expect(dialog.getByText(/Builds on:/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Probabilistic Thinking" })).toBeVisible();
  });

  test("offers the whole graph as a sortable table with column headers", async ({ page }) => {
    await gotoApp(page);
    await page.keyboard.press("b");

    const dialog = page.getByRole("dialog");
    const headers = dialog.getByRole("columnheader");
    await expect(headers).toHaveCount(5);
    await expect(dialog.getByRole("columnheader", { name: /Competence/ })).toBeVisible();
  });
});

test.describe("reduced motion", () => {
  test("does not animate the panel when motion is reduced", async ({ page }) => {
    await gotoApp(page);
    await openNode(page, "log-probability");

    const transition = await panelOf(page).evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    );
    // The project runs with reducedMotion: "reduce", so the transition must be
    // suppressed rather than merely shortened.
    expect(transition).toBe("0s");
  });
});
