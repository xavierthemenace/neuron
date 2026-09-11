/**
 * Shared UI vocabulary that pure library modules need to reference.
 *
 * Kept out of the component tree so `lib/commands.ts` can name a workbench tab
 * without importing React, which would drag the whole component graph into the
 * Node test runner.
 */
export type WorkbenchTabId =
  | "review"
  | "goals"
  | "insights"
  | "predictions"
  | "experiments"
  | "evidence"
  | "analytics"
  | "compare"
  | "personal"
  | "browse";
