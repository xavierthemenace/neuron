import { expect, test } from "@playwright/test";
import { gotoApp, openNode, panelOf } from "./helpers";

/**
 * The workbench: review queue, goals, diagnostics, predictions, insights,
 * personal nodes and the non-spatial browse view.
 */

async function openWorkbench(page: import("@playwright/test").Page, tab: string) {
  await page.getByRole("button", { name: /^Review/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  if (tab !== "Review") await dialog.getByRole("tab", { name: tab }).click();
  return dialog;
}

test.describe("review queue", () => {
  test("says nothing needs attention rather than inventing urgency", async ({ page }) => {
    await gotoApp(page);
    const dialog = await openWorkbench(page, "Review");
    await expect(dialog.getByText("Nothing needs attention")).toBeVisible();
  });
});

test.describe("goals", () => {
  test("routes a plain-language goal to a curated path and builds a plan", async ({ page }) => {
    await gotoApp(page);
    const dialog = await openWorkbench(page, "Goals");

    await dialog.getByLabel("Describe your goal").fill("I want to make better decisions");
    // The label appears both as a suggestion and in the curated-path list.
    await expect(dialog.getByText("Improve Decision Quality").first()).toBeVisible();

    await dialog.getByRole("button", { name: "Why this path?" }).first().click();
    await expect(dialog.getByText(/Matched on:/)).toBeVisible();

    await dialog.getByRole("button", { name: "Use this" }).first().click();

    await expect(dialog.getByText("Toward the target competence")).toBeVisible();
    await expect(dialog.getByText(/^Next:/)).toBeVisible();
  });

  test("expands a goal into an ordered, dated plan with a caveat", async ({ page }) => {
    await gotoApp(page);
    const dialog = await openWorkbench(page, "Goals");
    await dialog.getByRole("button", { name: "Think Like a Scientist" }).click();

    await dialog.getByText("Think Like a Scientist").last().click();
    await expect(dialog.getByText(/wk 1/).first()).toBeVisible();
    await expect(dialog.getByText(/not a measured rate/)).toBeVisible();
  });
});

test.describe("diagnostics", () => {
  test("runs a probe end to end and records a comparable result", async ({ page }) => {
    await gotoApp(page);
    await openNode(page, "gf-pattern-abstraction");

    const panel = panelOf(page);
    await panel.getByRole("button", { name: /Abstract reasoning/ }).click();

    const dialog = page.getByRole("dialog", { name: "Abstract reasoning" });
    await expect(dialog).toBeVisible();
    // The caveat is part of the contract, not decoration.
    await expect(dialog.getByText(/practice-sensitive format/)).toBeVisible();

    await dialog.getByRole("button", { name: /^Start · \d+ items$/ }).click();

    // Answer every item with the first option, then finish.
    for (let index = 0; index < 6; index += 1) {
      const options = dialog.locator("button").filter({ hasText: /^\d+$/ });
      if ((await options.count()) > 0) await options.first().click();
      const next = dialog.getByRole("button", { name: /^(Next|Finish)$/ });
      await next.click();
    }

    await expect(dialog.getByText(/of \d+ correct at difficulty/)).toBeVisible();
    await expect(dialog.getByText(/One run|baseline/)).toBeVisible();
  });

  test("scores a skipped run as zero rather than as the first option", async ({ page }) => {
    await gotoApp(page);
    await openNode(page, "gf-pattern-abstraction");
    await panelOf(page).getByRole("button", { name: /Abstract reasoning/ }).click();

    const dialog = page.getByRole("dialog", { name: "Abstract reasoning" });
    await dialog.getByRole("button", { name: /^Start · \d+ items$/ }).click();
    for (let index = 0; index < 6; index += 1) {
      await dialog.getByRole("button", { name: "Skip" }).click();
    }
    // The headline score, not the per-item partial-credit lines.
    await expect(dialog.getByText("0%").first()).toBeVisible();
  });
});

test.describe("predictions", () => {
  test("records a prediction, resolves it, and reports a small sample honestly", async ({
    page,
  }) => {
    await gotoApp(page);
    const dialog = await openWorkbench(page, "Predictions");

    await dialog
      .getByLabel("Prediction claim")
      .fill("The migration lands before the end of the month without a rollback");
    await dialog.getByRole("button", { name: "Record" }).click();

    await expect(dialog.getByText(/The migration lands before/)).toBeVisible();
    await dialog.getByRole("button", { name: "Happened" }).click();

    await expect(dialog.getByText(/Brier /).first()).toBeVisible();
    await expect(dialog.getByText(/below the 20|direction, not a measurement/)).toBeVisible();
  });
});

test.describe("browse view", () => {
  test("is a complete, sortable alternative to the map", async ({ page }) => {
    await gotoApp(page);
    const dialog = await openWorkbench(page, "Browse");

    const table = dialog.getByRole("table");
    await expect(table).toBeVisible();
    // Every canonical node is present as a row header.
    await expect(table.locator("tbody tr")).toHaveCount(139);

    await dialog.getByLabel("Search capabilities").fill("bayesian");
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await expect(table.getByText("Bayesian Updating")).toBeVisible();
  });

  test("filters by construct kind", async ({ page }) => {
    await gotoApp(page);
    const dialog = await openWorkbench(page, "Browse");

    await dialog.getByRole("button", { name: /Physiological Enabler/ }).click();
    const rows = dialog.getByRole("table").locator("tbody tr");
    await expect(rows).toHaveCount(4);
  });

  test("opens a capability from the list", async ({ page }) => {
    await gotoApp(page);
    const dialog = await openWorkbench(page, "Browse");
    await dialog.getByLabel("Search capabilities").fill("Response Inhibition");
    await dialog.getByRole("button", { name: /Response Inhibition/ }).click();

    await expect(panelOf(page)).toHaveAttribute("data-open", "true");
    await expect(panelOf(page).getByRole("heading", { name: "Response Inhibition" })).toBeVisible();
  });
});

test.describe("personal nodes", () => {
  test("creates a personal capability that behaves like a core one", async ({ page }) => {
    await gotoApp(page);
    const dialog = await openWorkbench(page, "Personal");

    await dialog.getByRole("button", { name: "Docker" }).click();
    await dialog.getByRole("button", { name: "Create capability" }).click();

    await expect(dialog.getByText("Your capabilities (1)")).toBeVisible();
    await expect(dialog.getByText(/Neuron holds no evidence about your personal nodes/)).toBeVisible();
  });
});

test.describe("command palette", () => {
  test("runs a registered command", async ({ page }) => {
    await gotoApp(page);
    await page.keyboard.press("ControlOrMeta+k");

    const palette = page.getByRole("dialog", { name: "Neuron command palette" });
    await palette.getByLabel("Command palette input").fill("browse");
    await palette.getByRole("button", { name: /Browse all capabilities/ }).click();

    await expect(page.getByRole("dialog").getByRole("table")).toBeVisible();
  });

  test("jumps to a capability by name", async ({ page }) => {
    await gotoApp(page);
    await page.keyboard.press("ControlOrMeta+k");

    const palette = page.getByRole("dialog", { name: "Neuron command palette" });
    await palette.getByLabel("Command palette input").fill("opportunity cost");
    await palette.getByRole("button", { name: /Opportunity Cost/ }).first().click();

    await expect(panelOf(page).getByRole("heading", { name: "Opportunity Cost" })).toBeVisible();
  });

  test("responds to single-key shortcuts outside text fields", async ({ page }) => {
    await gotoApp(page);
    await page.keyboard.press("b");
    await expect(page.getByRole("dialog").getByRole("table")).toBeVisible();
  });

  test("does not fire shortcuts while typing in a field", async ({ page }) => {
    await gotoApp(page);
    const search = page.getByLabel("Search capabilities");
    await search.fill("bayes");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(search).toHaveValue("bayes");
  });
});
