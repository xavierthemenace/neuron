import { defineConfig, devices } from "@playwright/test";

/**
 * Browser-level regression tests.
 *
 * The unit suite covers the algorithms; this covers the things that only break
 * in a real browser — selection loops, focus management, IndexedDB persistence,
 * cross-tab sync and service-worker behaviour. The render-loop class of bug
 * that took this app down twice is unreachable from a unit test and has an
 * explicit spec here.
 *
 * Runs against a production build, because `next dev` has different render
 * behaviour (double-invoked effects, no minification) and a test that only
 * passes in dev is not protecting the thing users run.
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3123);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // The graph is heavy to boot; a single generous timeout beats per-assertion
  // waits scattered through the specs.
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Deterministic rendering for the visual snapshots: no animation timing,
    // no caret blink, no reduced-motion ambiguity.
    reducedMotion: "reduce",
    colorScheme: "dark",
    // The planner seeds its ranking noise from the *local* calendar date, so an
    // unpinned zone makes a run in UTC CI and a run on a developer machine
    // disagree about what day it is. Pinning the zone removes that variable.
    timezoneId: "UTC",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      // The mobile specs assert phone-width layout, so running them at 1440px
      // fails on assertions that are correct for the viewport they target.
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /(mobile|a11y)\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  /**
   * Baselines are per-platform.
   *
   * Glyph rasterisation differs between the Linux CI runner and a developer
   * machine — same fonts, same metrics (next/font self-hosts them, so nothing
   * reflows), but antialiased edges land differently and a text-heavy dialog
   * drifts 3-4% against a 2% tolerance. Loosening the tolerance to cover that
   * would blind the suite to real regressions, so each platform keeps its own
   * baselines instead. Re-bake Linux ones with the bake-snapshots workflow.
   */
  snapshotPathTemplate: "{testDir}/__screenshots__/{platform}/{arg}{ext}",
});
