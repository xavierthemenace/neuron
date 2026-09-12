import { expect, test } from "@playwright/test";
import { gotoToday, openMap } from "./helpers";

/**
 * Light, dark, or the machine's choice.
 *
 * The two things worth pinning: the choice survives a reload without the page
 * flashing the other theme on the way in, and the whole app moves with it
 * rather than only the screen the control sits on.
 */
test.describe("appearance", () => {
  const toggle = (page: import("@playwright/test").Page) =>
    page.getByRole("button", { name: /^Appearance:/ }).first();

  test("starts on the system setting and cycles from there", async ({ page }) => {
    await gotoToday(page);
    await expect(toggle(page)).toHaveAccessibleName(/Match the system/);
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);

    await toggle(page).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await toggle(page).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await toggle(page).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  });

  test("remembers the choice, and applies it before the page renders", async ({ page }) => {
    await gotoToday(page);
    await toggle(page).click();
    await toggle(page).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.reload();
    // Read before waiting for anything: the inline boot script has to have run
    // already, or the first frame is the wrong colour.
    expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
    await expect(page.getByTestId("today-screen")).toBeVisible();
  });

  test("moves the map with it, not just the screen the control is on", async ({ page }) => {
    await gotoToday(page);
    await toggle(page).click();
    await toggle(page).click();

    await openMap(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    const ground = await page
      .getByTestId("side-panel")
      .evaluate((node) => getComputedStyle(node).backgroundColor);
    // The panel is a dark surface in dark mode; in light it is near-white.
    const [r, g, b] = ground.match(/\d+/g)!.map(Number);
    expect(r + g + b).toBeLessThan(300);
  });
});
