import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { openMap } from "./helpers";

/**
 * The promises that would be worst to get wrong.
 *
 * "Your data is portable and never lost" and "it works offline" are both
 * claims the README makes in the user's own words, and both are the kind of
 * thing that silently stops being true. Asserting them needs the real flows:
 * a real download, a real reset, a real re-import, and a real offline reload.
 */

async function loadExample(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Show me an example first" }).click();
  await expect(page.getByText("This is an example profile.")).toBeVisible();
}

test.describe("data durability", () => {
  test("a backup taken before a reset brings everything back", async ({ page }) => {
    await loadExample(page);

    const xpText = await page.getByText(/\d[\d,]*\s*XP/).first().innerText();
    const xpBefore = xpText.match(/[\d,]+/)![0];
    expect(Number(xpBefore.replace(/,/g, ""))).toBeGreaterThan(1000);

    await openMap(page);

    // 1. Export.
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Data" }).click();
    await page.getByRole("button", { name: /Export full backup/ }).click();
    const download = await downloadPromise;
    const backupPath = await download.path();
    expect(backupPath).toBeTruthy();
    const backup = JSON.parse(await readFile(backupPath, "utf8"));
    expect(backup.format).toBe("neuron.backup");
    expect(backup.progress.logs.length).toBeGreaterThan(100);

    // 2. Reset. The export it takes on the way out is the second copy.
    const resetDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Data" }).click();
    await page.getByRole("button", { name: /Reset progress/ }).click();
    await resetDownload;
    await page.getByRole("button", { name: "Erase everything", exact: true }).click();

    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(page.getByText("This is an example profile.")).toBeHidden();
    await expect(page.getByText(/\b0\s*XP/)).toBeVisible();

    // 3. Restore from the file that was actually written to disk.
    await openMap(page);
    await page.getByRole("button", { name: "Data" }).click();
    await page.locator('input[type="file"]').setInputFiles(backupPath);

    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(page.getByText("This is an example profile.")).toBeVisible();
    await expect(page.getByText(new RegExp(`${xpBefore}\\s*XP`))).toBeVisible();
  });
});

test.describe("offline", () => {
  test("opens with no network once it has been visited", async ({ page, context }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Skip setup" })).toBeVisible();

    // The worker only registers in a production build, which is what the
    // Playwright web server runs.
    await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, {
      timeout: 30_000,
    });

    await context.setOffline(true);
    await page.reload();

    // The shell has to come back from the cache, not from an error page.
    await expect(page.getByRole("button", { name: "Skip setup" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Skip setup" }).click();
    await expect(page.getByTestId("today-screen")).toBeVisible();

    await context.setOffline(false);
  });
});
