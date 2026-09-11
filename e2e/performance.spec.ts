import { expect, test } from "@playwright/test";
import { gotoApp, node, panelOf, selectNode } from "./helpers";

/**
 * Performance budgets.
 *
 * Numbers here are ceilings with real headroom, not targets — a budget that
 * fails on a busy CI machine gets disabled within a week and protects nothing
 * after that. What they are actually protecting is the architecture: baked
 * layouts, stable node identity, and render isolation. The render-count test is
 * the important one; the timing tests are a coarse net under it.
 */

const BUDGET = {
  /** Uncompressed first-party JS shipped for the initial route, in KB. */
  initialJsKb: 1400,
  /** Time from navigation to the first node being painted, in ms. */
  timeToGraphMs: 12_000,
  /**
   * Time from the click landing to the panel showing the node's content.
   *
   * Measured inside the page rather than through Playwright, whose
   * actionability wait on an animated node element accounts for the best part
   * of a second on its own and has nothing to do with how fast the app is.
   */
  selectionLatencyMs: 600,
  /** IndexedDB hydration, in ms. */
  hydrationMs: 2_500,
};

test.describe("performance budgets", () => {
  test("keeps the initial JS payload inside budget", async ({ page }) => {
    let bytes = 0;
    page.on("response", (response) => {
      const url = response.url();
      if (!url.includes("/_next/static/") || !url.endsWith(".js")) return;
      const length = Number(response.headers()["content-length"] ?? 0);
      bytes += length;
    });

    await gotoApp(page);
    const kb = bytes / 1024;
    expect(kb, `initial JS was ${kb.toFixed(0)}KB`).toBeLessThan(BUDGET.initialJsKb);
  });

  test("paints the graph within budget", async ({ page }) => {
    const start = Date.now();
    await gotoApp(page);
    const elapsed = Date.now() - start;
    expect(elapsed, `graph took ${elapsed}ms`).toBeLessThan(BUDGET.timeToGraphMs);
  });

  test("opens a node quickly", async ({ page }) => {
    await gotoApp(page);
    // Warm the render path so the measurement is of a steady-state selection,
    // which is what a user actually experiences after the first second.
    await node(page, "gwm-span").click();
    await expect(panelOf(page)).toHaveAttribute("data-open", "true");

    const elapsed = await page.evaluate(async () => {
      const target = document.querySelector<HTMLElement>(
        '.react-flow__node[data-id="log-probability"]',
      );
      if (!target) throw new Error("target node not rendered");

      const started = performance.now();
      target.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      // Resolve on the frame where the panel actually shows the new heading.
      return new Promise<number>((resolve, reject) => {
        const deadline = started + 5000;
        const check = () => {
          const heading = document.querySelector("[data-testid='side-panel'] h2");
          if (heading?.textContent?.includes("Probabilistic Thinking")) {
            resolve(performance.now() - started);
          } else if (performance.now() > deadline) {
            reject(new Error("panel never updated"));
          } else {
            requestAnimationFrame(check);
          }
        };
        requestAnimationFrame(check);
      });
    });

    expect(elapsed, `selection took ${elapsed.toFixed(0)}ms`).toBeLessThan(
      BUDGET.selectionLatencyMs,
    );
  });

  test("hydrates local storage quickly", async ({ page }) => {
    await gotoApp(page);
    const hydration = await page.evaluate(async () => {
      const started = performance.now();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("neuron.local.v2");
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction("progress", "readonly");
          const read = transaction.objectStore("progress").get("current");
          read.onsuccess = () => resolve();
          read.onerror = () => reject(read.error);
        };
        request.onerror = () => reject(request.error);
      });
      return performance.now() - started;
    });
    expect(hydration, `hydration took ${hydration.toFixed(0)}ms`).toBeLessThan(
      BUDGET.hydrationMs,
    );
  });

  /**
   * Render isolation.
   *
   * The architectural claim is that logging one exercise re-renders that node
   * and its edges, not the other 138. That is enforced by the signature cache
   * in lib/graph.ts, and it is invisible to every other kind of test: a
   * regression here shows up as the map feeling sluggish months later, long
   * after whoever removed the cache has moved on.
   */
  test("does not recreate the whole graph when one node changes", async ({ page }) => {
    await gotoApp(page);
    await selectNode(page, "log-estimation");

    // Record the identity of every node element before the change.
    const before = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".react-flow__node")].map(
        (element) => element.dataset.id ?? "",
      ),
    );

    const panel = panelOf(page);
    await panel.getByRole("button", { name: /^Open exercise:/ }).first().click();
    await panel.locator("textarea").first().fill(
      "Estimated total UK annual electricity use from households and got within a factor of three.",
    );

    // Tag every node element so surviving DOM nodes can be identified after
    // the update. A full recreate loses the tags.
    await page.evaluate(() => {
      document
        .querySelectorAll<HTMLElement>(".react-flow__node")
        .forEach((element, index) => {
          element.dataset.identityProbe = String(index);
        });
    });

    await panel.getByRole("button", { name: /^Complete · \+\d+ XP$/ }).click();
    await expect(panel.getByText(/resets in/).first()).toBeVisible();

    const survived = await page.evaluate(
      () => document.querySelectorAll("[data-identity-probe]").length,
    );

    // Everything except the changed node (and any node whose size changed with
    // it) must be the same DOM element it was before.
    expect(before.length).toBeGreaterThan(100);
    expect(
      survived,
      `only ${survived} of ${before.length} node elements survived a single log`,
    ).toBeGreaterThan(before.length - 5);
  });

  test("holds a workable frame rate while panning", async ({ page }) => {
    await gotoApp(page);

    const frames = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let count = 0;
          const started = performance.now();
          const tick = () => {
            count += 1;
            if (performance.now() - started < 1000) requestAnimationFrame(tick);
            else resolve(count);
          };
          requestAnimationFrame(tick);

          // Drive a pan while the counter runs.
          const pane = document.querySelector(".react-flow__pane");
          if (!pane) return;
          let x = 400;
          const step = () => {
            x += 6;
            pane.dispatchEvent(
              new MouseEvent("mousemove", { clientX: x, clientY: 400, bubbles: true }),
            );
            if (performance.now() - started < 1000) setTimeout(step, 16);
          };
          step();
        }),
    );

    // Headless Chromium on a shared runner is not a frame-rate benchmark; this
    // catches a catastrophic regression (a per-frame full-graph rebuild), not a
    // few dropped frames.
    expect(frames, `only ${frames} frames in one second`).toBeGreaterThan(20);
  });
});
