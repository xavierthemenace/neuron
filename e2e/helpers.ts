import { expect, type Page } from "@playwright/test";

/**
 * Shared helpers for the browser suite.
 *
 * Every spec starts from a clean, onboarded state unless it is specifically
 * testing onboarding, because the welcome sheet is modal and would otherwise
 * be the first thing every other test has to dismiss.
 */

export const ONBOARDING_KEY = "onboarding-complete-v2";

/** Marks onboarding complete before the app boots, via an init script. */
export async function skipOnboarding(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const request = indexedDB.open("neuron.local.v2", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of ["progress", "journals", "attachments", "settings"]) {
        if (db.objectStoreNames.contains(store)) continue;
        if (store === "journals") db.createObjectStore(store, { keyPath: "nodeId" });
        else if (store === "attachments") {
          const attachments = db.createObjectStore(store, { keyPath: "id" });
          attachments.createIndex("nodeId", "nodeId", { unique: false });
        } else db.createObjectStore(store);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("settings", "readwrite");
      transaction.objectStore("settings").put(true, "onboarding-complete-v2");
    };
  });
}

/** Waits for React Flow to have painted the graph. */
export async function waitForGraph(page: Page): Promise<void> {
  await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 30_000 });
}

export async function gotoApp(page: Page): Promise<void> {
  await skipOnboarding(page);
  await page.goto("/");
  await waitForGraph(page);
}

export function node(page: Page, id: string) {
  return page.locator(`.react-flow__node[data-id="${id}"]`);
}

/**
 * The side panel.
 *
 * Located by test id rather than by role: when closed it carries
 * aria-hidden, which removes it from the accessibility tree, so a role-based
 * locator can assert that it is open but never that it is closed.
 */
export function panelOf(page: Page) {
  return page.getByTestId("side-panel");
}

export async function openNode(page: Page, id: string): Promise<void> {
  await node(page, id).click();
  await expect(panelOf(page)).toHaveAttribute("data-open", "true");
}

/**
 * Clicks a node that may currently be outside the viewport.
 *
 * Selecting a node zooms the camera to it, which pushes most of a 139-node map
 * off-screen; a plain click on the next target then waits forever on
 * actionability. Fitting the view first is what a user does too — it is the
 * "fit entire map" control — so this stays an honest interaction rather than a
 * synthetic event.
 */
export async function selectNode(page: Page, id: string): Promise<void> {
  await page.locator(".react-flow__controls-fitview").click();
  await expect(node(page, id)).toBeInViewport({ timeout: 10_000 });
  await node(page, id).click();
}

/**
 * Counts renders of a component by instrumenting the console.
 *
 * Used by the render-loop regression spec: a loop shows up as an unbounded
 * stream of React warnings or a hung page, and both are catchable here.
 */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // React's own loop detection. This is the exact string that appeared the
    // last two times selection state fought React Flow's internal selection.
    if (
      text.includes("Maximum update depth") ||
      text.includes("Too many re-renders") ||
      text.includes("Rendered more hooks")
    ) {
      errors.push(text);
    }
  });
  return errors;
}

/** Logs one exercise on a node through the panel, returning the XP awarded. */
export async function completeFirstExercise(page: Page, text: string): Promise<void> {
  const panel = page.getByTestId("side-panel");
  await panel.getByRole("button", { name: /^Open exercise:/ }).first().click();
  const textarea = panel.locator("textarea").first();
  await textarea.fill(text);
  await panel.getByRole("button", { name: /^Complete · \+\d+ XP$/ }).click();
}
