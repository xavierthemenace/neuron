import { expect, test } from "@playwright/test";
import { gotoApp, gotoToday, node, openMap, panelOf } from "./helpers";

/**
 * Mobile as a first-class platform, not a shrunken desktop.
 *
 * Runs under the Pixel 7 project, so this file sees a real touch viewport with
 * a 412px width. The things that break here are the things that break for
 * anyone using the app on a phone: sheets that cover the content they describe,
 * targets too small to hit, and horizontal overflow.
 */

test.describe("mobile layout", () => {
  test("opens the panel as a bottom sheet that does not cover the whole screen", async ({
    page,
  }) => {
    await gotoApp(page);
    await node(page, "log-probability").click();

    const panel = panelOf(page);
    await expect(panel).toHaveAttribute("data-open", "true");

    const box = await panel.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).toBeTruthy();
    // A bottom sheet: full width, anchored to the bottom, leaving the map visible.
    expect(box!.width).toBeCloseTo(viewport.width, 0);
    expect(box!.y).toBeGreaterThan(viewport.height * 0.1);
  });

  test("never scrolls horizontally", async ({ page }) => {
    await gotoApp(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("keeps primary controls above the WCAG target-size minimum", async ({ page }) => {
    await gotoApp(page);

    // 24x24 CSS px is the WCAG 2.2 AA "Target Size (Minimum)" floor.
    const small = await page.evaluate(() => {
      const controls = document.querySelectorAll<HTMLElement>(
        "button:not([aria-hidden='true'])",
      );
      return [...controls]
        .filter((control) => {
          const rect = control.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          // React Flow's own zoom controls are third-party chrome.
          if (control.closest(".react-flow__controls")) return false;
          return rect.width < 24 || rect.height < 24;
        })
        .map((control) => control.getAttribute("aria-label") ?? control.textContent?.trim());
    });
    expect(small).toEqual([]);
  });

  test("fits the workbench sheet inside the viewport", async ({ page }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: /^Review/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const box = await dialog.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.height).toBeLessThanOrEqual(viewport.height + 1);
  });

  test("lets the workbench tabs scroll rather than wrap off-screen", async ({ page }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: /^Review/ }).click();

    const tablist = page.getByRole("tablist", { name: "Workbench sections" });
    const scrollable = await tablist.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    );
    expect(scrollable).toBe(true);

    // The last tab must still be reachable by scrolling that strip.
    await tablist.evaluate((element) => element.scrollTo({ left: element.scrollWidth }));
    await expect(page.getByRole("tab", { name: "Browse" })).toBeInViewport();
  });

  test("moves between screens from the bottom bar", async ({ page }) => {
    await gotoToday(page);
    // The bar is the only navigation on a phone, so it has to work before
    // anything else does.
    await expect(page.getByTestId("today-screen")).toBeVisible();

    await openMap(page);
    await expect(page.getByTestId("today-screen")).toBeHidden();

    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(page.getByTestId("today-screen")).toBeVisible();
  });

  test("runs a diagnostic on a touch viewport", async ({ page }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: /^Review/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: "Browse" }).click();
    await dialog.getByLabel("Search capabilities").fill("Fermi");
    await dialog.getByRole("button", { name: /Fermi Estimation/ }).click();

    await panelOf(page).getByRole("button", { name: /Fermi estimation/ }).click();
    const probe = page.getByRole("dialog", { name: "Fermi estimation" });
    await expect(probe.getByRole("button", { name: /^Start · \d+ items$/ })).toBeVisible();
  });
});
