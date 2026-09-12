import { expect, test } from "@playwright/test";
import { openMap } from "./helpers";

/**
 * The example profile.
 *
 * An empty app is the honest first state and a hopeless first impression, so
 * onboarding offers six months of generated history instead. The two things
 * that must hold are that it fills the views that need history, and that it
 * never stops announcing itself as generated.
 */
test.describe("example profile", () => {
  test("fills the app from onboarding and keeps saying it is generated", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Show me an example first" }).click();

    const banner = page.getByText("This is an example profile.");
    await expect(banner).toBeVisible();

    // The point of the profile: the front door now has something on it.
    await expect(page.getByText(/Brier \d/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Review queue \(\d+\)/ })).toBeVisible();

    // And it survives a reload, rather than quietly becoming a record.
    await page.reload();
    await expect(page.getByText("This is an example profile.")).toBeVisible();
  });

  test("labels the generated figures inside the workbench too", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Show me an example first" }).click();
    await expect(page.getByText("This is an example profile.")).toBeVisible();

    await page.getByRole("button", { name: /^Record/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText(/comes from the generated example profile/),
    ).toBeVisible();

    // The review queue is the view that was empty by construction before this.
    await expect(dialog.getByRole("button", { name: /^Resolve$/ }).first()).toBeVisible();
  });

  test("labels the map too, which is where its headline figure shows", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Show me an example first" }).click();
    await expect(page.getByText("This is an example profile.")).toBeVisible();

    await openMap(page);
    // The map header is the one place the profile's XP appears without a
    // banner above it, so the label has to travel with the figure.
    await expect(page.getByText("Example data")).toBeVisible();
  });

  test("takes a backup before replacing anything, even a profile with no logs", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Skip setup" }).click();
    await expect(page.getByTestId("today-screen")).toBeVisible();

    await openMap(page);

    // A goal set before the first rep used to be destroyed with no backup at
    // all, because the guard only counted logs and predictions.
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Data" }).click();
    await page.getByRole("button", { name: /Load an example profile/ }).click();
    await expect(await download).toBeTruthy();
    await page.getByRole("button", { name: "Load the example", exact: true }).click();

    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(page.getByText("This is an example profile.")).toBeVisible();
  });

  test("can be cleared back to an empty profile", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Show me an example first" }).click();
    await expect(page.getByText("This is an example profile.")).toBeVisible();

    await openMap(page);
    await page.getByRole("button", { name: "Data" }).click();
    await page.getByRole("button", { name: /Clear the example profile/ }).click();
    await page.getByRole("button", { name: "Clear it" }).click();

    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(page.getByText("This is an example profile.")).toBeHidden();
  });
});
