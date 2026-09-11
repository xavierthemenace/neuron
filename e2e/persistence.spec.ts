import { expect, test } from "@playwright/test";
import { openMap, gotoApp, openNode, panelOf, selectNode } from "./helpers";

/**
 * Storage, sync, export/import and offline behaviour.
 *
 * This is a local-first app with no account: the guarantees it makes about not
 * losing your data are the product. All of them live in the browser and none of
 * them are testable without one.
 */

test.describe("persistence", () => {
  test("survives a reload with the journal intact", async ({ page }) => {
    await gotoApp(page);
    await openNode(page, "intra-metacognition");

    const panel = panelOf(page);
    await panel.getByRole("tab", { name: "Notes" }).click();
    const editor = panel.locator("textarea").first();
    await editor.fill("Predicted 70% on the proof set, actually got 40%. Overconfident again.");

    // The journal debounces its write; give it a beat before reloading.
    await expect.poll(async () => editor.inputValue()).toContain("Overconfident");
    await page.waitForTimeout(1200);

    await page.reload();
    await openMap(page);
    await selectNode(page, "intra-metacognition");
    await panelOf(page).getByRole("tab", { name: "Notes" }).click();
    await expect(panelOf(page).locator("textarea").first()).toHaveValue(
      /Overconfident again/,
    );
  });

  test("syncs a new log to another tab", async ({ page, context }) => {
    await gotoApp(page);
    await openNode(page, "log-estimation");

    const second = await context.newPage();
    await second.goto("/");
    await expect(second.locator(".react-flow__node").first()).toBeVisible({ timeout: 30_000 });
    const beforeXp = await second.getByText(/\d+ XP/).first().textContent();

    const panel = panelOf(page);
    await panel.getByRole("button", { name: /^Open exercise:/ }).first().click();
    await panel.locator("textarea").first().fill(
      "Estimated the mass of the atmosphere from surface area and sea-level pressure; came out within a factor of two.",
    );
    await panel.getByRole("button", { name: /^Complete · \+\d+ XP$/ }).click();

    // BroadcastChannel should carry the snapshot across without a reload.
    await expect
      .poll(async () => second.getByText(/\d+ XP/).first().textContent(), { timeout: 15_000 })
      .not.toBe(beforeXp);
    await second.close();
  });

  test("exports a full backup and imports it back", async ({ page }) => {
    test.slow();
    await gotoApp(page);
    await openNode(page, "dec-journal");

    const panel = panelOf(page);
    await panel.getByRole("button", { name: /^Open exercise:/ }).first().click();
    await panel.locator("textarea").first().fill(
      "Recorded the decision to defer the migration, expected cost of deferring, and the signal that would say it was wrong.",
    );
    await panel.getByRole("button", { name: /^Complete · \+\d+ XP$/ }).click();
    await page.keyboard.press("Escape");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Data" }).click();
    await page.getByRole("button", { name: /Export full backup/ }).click();
    const file = await download;

    const path = await file.path();
    expect(path).toBeTruthy();

    // Wipe, then restore from the file we just wrote.
    await page.getByRole("button", { name: "Data" }).click();
    page.once("dialog", (dialog) => dialog.accept());
    const resetDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: /Reset progress/ }).click();
    await resetDownload;

    await expect.poll(async () => page.getByText(/^\d+/).first().textContent()).toBeTruthy();

    await page.getByRole("button", { name: "Data" }).click();
    await page.setInputFiles('input[type="file"]', path!);

    await expect(page.getByText(/Imported .* practice logs/)).toBeVisible({ timeout: 15_000 });
  });

  test("exports a backup before allowing a reset", async ({ page }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: "Data" }).click();

    // The reset entry promises a backup first; that promise is the test.
    await expect(page.getByText("Exports a backup first")).toBeVisible();

    const download = page.waitForEvent("download");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: /Reset progress/ }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^neuron-backup-/);
  });
});

test.describe("offline", () => {
  test("boots from cache with no network", async ({ page, context }) => {
    await gotoApp(page);
    // Let the service worker install and claim the page.
    await page.waitForTimeout(2500);

    await context.setOffline(true);
    await page.reload();

    await openMap(page);
    await expect(page.getByText(/\d+ XP/).first()).toBeVisible();

    await context.setOffline(false);
  });

  test("still logs practice while offline", async ({ page, context }) => {
    await gotoApp(page);
    await page.waitForTimeout(2500);
    await context.setOffline(true);

    await selectNode(page, "log-estimation");
    const panel = panelOf(page);
    await panel.getByRole("button", { name: /^Open exercise:/ }).first().click();
    await panel.locator("textarea").first().fill(
      "Worked an estimate offline to confirm nothing in the training loop needs the network.",
    );
    await panel.getByRole("button", { name: /^Complete · \+\d+ XP$/ }).click();
    await expect(panel.getByText(/resets in/).first()).toBeVisible();

    await context.setOffline(false);
  });
});
