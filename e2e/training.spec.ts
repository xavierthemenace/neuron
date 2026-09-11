import { expect, test } from "@playwright/test";
import { gotoApp, openNode, panelOf, selectNode } from "./helpers";

/**
 * The training loop: logging work, reset gating, persistence and the
 * practice-versus-competence distinction actually holding in the UI.
 */

test.describe("training", () => {
  test("logs an exercise, awards XP, and gates the reset window", async ({ page }) => {
    await gotoApp(page);
    await openNode(page, "log-estimation");

    const panel = panelOf(page);
    const before = await page.getByText(/\d+ XP/).first().textContent();

    await panel.getByRole("button", { name: /^Open exercise:/ }).first().click();
    await panel.locator("textarea").first().fill(
      "Estimated the number of piano tuners in Chicago at about 120; the usual published figure is around 100, so within a factor of two.",
    );
    await panel.getByRole("button", { name: /^Complete · \+\d+ XP$/ }).click();

    // The rep lands, the top bar total moves, and the task is now gated.
    await expect.poll(async () => page.getByText(/\d+ XP/).first().textContent()).not.toBe(before);
    await expect(panel.getByText(/resets in/).first()).toBeVisible();
  });

  test("keeps the log across a reload", async ({ page }) => {
    await gotoApp(page);
    await openNode(page, "gc-retrieval-practice");

    const panel = panelOf(page);
    await panel.getByRole("button", { name: /^Open exercise:/ }).first().click();
    await panel.locator("textarea").first().fill(
      "Recalled the six retention models from memory before checking, and got four of six.",
    );
    await panel.getByRole("button", { name: /^Complete · \+\d+ XP$/ }).click();
    await expect(panel.getByText(/resets in/).first()).toBeVisible();

    await page.reload();
    await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 30_000 });
    await selectNode(page, "gc-retrieval-practice");
    await expect(panelOf(page).getByText(/resets in/).first()).toBeVisible();
  });

  /**
   * The unload-race regression.
   *
   * Saves to IndexedDB are debounced. Reloading immediately after logging work
   * lands inside that window, so the rep only survives if the unload handler
   * persists it synchronously — an async IndexedDB write started there is
   * abandoned as the page is torn down, which silently reset the profile to
   * zero XP. Nothing is awaited between the click and the reload on purpose.
   */
  test("survives a reload in the moment before the debounced save", async ({ page }) => {
    await gotoApp(page);
    await openNode(page, "log-estimation");

    const panel = panelOf(page);
    const before = await page.getByText(/\d+ XP/).first().textContent();

    await panel.getByRole("button", { name: /^Open exercise:/ }).first().click();
    await panel.locator("textarea").first().fill(
      "Estimated the weight of a full shipping container at 25 tonnes; actual is about 30.",
    );
    await panel.getByRole("button", { name: /^Complete · \+\d+ XP$/ }).click();
    await page.reload();

    await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 30_000 });
    // The profile must not have silently reset to its pre-rep total.
    await expect
      .poll(async () => page.getByText(/\d+ XP/).first().textContent())
      .not.toBe(before);
    await selectNode(page, "log-estimation");
    await expect(panelOf(page).getByText(/resets in/).first()).toBeVisible();
  });

  test("separates practice from competence and explains the gap", async ({ page }) => {
    await gotoApp(page);
    await openNode(page, "log-estimation");
    const panel = panelOf(page);

    await expect(panel.getByText("Practice", { exact: true })).toBeVisible();
    await expect(panel.getByText("Competence", { exact: true })).toBeVisible();
    await expect(panel.getByText("Retention", { exact: true })).toBeVisible();

    // The explanation is required to exist, not merely the numbers.
    await panel.getByRole("button", { name: "Why these numbers?" }).click();
    await expect(panel.getByText(/Practice is XP against/)).toBeVisible();
  });

  test("shows the evidence tab with limitations and sources", async ({ page }) => {
    await gotoApp(page);
    await openNode(page, "gwm-span");

    const panel = panelOf(page);
    await panel.getByRole("tab", { name: "Evidence" }).click();

    await expect(panel.getByText("Construct validity")).toBeVisible();
    await expect(panel.getByText("Trainability")).toBeVisible();
    await expect(panel.getByText("Transfer", { exact: true })).toBeVisible();
    await expect(panel.getByText("What this will not do")).toBeVisible();
    // The honest claim about span training must be on screen.
    await expect(panel.getByText(/very little else|task learning/i)).toBeVisible();
  });

  test("reveals edge mechanisms in research mode", async ({ page }) => {
    await gotoApp(page);
    await openNode(page, "epi-bayesian");

    const panel = panelOf(page);
    await panel.getByRole("tab", { name: "Evidence" }).click();
    await panel.getByRole("switch", { name: "Research Mode" }).click();

    await expect(panel.getByText("Why these edges exist")).toBeVisible();
    await expect(panel.getByText(/priors, likelihoods and the conditioning step/)).toBeVisible();
  });
});

test.describe("session planner", () => {
  test("plans a session that respects the time budget and explains itself", async ({ page }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: /Plan a training session/ }).click();

    const dialog = page.getByRole("dialog", { name: "Plan a session" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "I have 15 minutes" }).click();
    await expect(dialog.getByText(/minutes of your 15/)).toBeVisible();

    await dialog.getByRole("button", { name: "Why this one?" }).first().click();
    await expect(dialog.getByText(/Ranked .* out of everything currently available/)).toBeVisible();
  });

  test("changes the session when the constraints change", async ({ page }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: /Plan a training session/ }).click();
    const dialog = page.getByRole("dialog", { name: "Plan a session" });

    await dialog.getByRole("button", { name: "I have 15 minutes" }).click();
    const short = await dialog.getByText(/^\d+ items?, about/).textContent();

    await dialog.getByRole("button", { name: "I have 45 minutes" }).click();
    await expect
      .poll(async () => dialog.getByText(/^\d+ items?, about/).textContent())
      .not.toBe(short);
  });
});
