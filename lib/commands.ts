import { capstones, missions, paths } from "./curriculum.ts";
import { PROBES } from "./diagnostics.ts";
import type { WorkbenchTabId } from "./ui-types.ts";

/**
 * The command registry.
 *
 * Every action the app can take is declared here as data rather than wired
 * directly into a menu. The palette renders it, the keyboard shortcuts bind to
 * it, and anything added later becomes reachable in all three places at once —
 * which is the difference between a search box over a hardcoded list and an
 * actual command architecture.
 */

export type CommandGroup =
  | "navigate"
  | "train"
  | "measure"
  | "record"
  | "view"
  | "data";

export interface CommandAction {
  id: string;
  label: string;
  group: CommandGroup;
  /** Extra words that should match this command in search. */
  keywords?: string;
  /** Single-key shortcut, active when no modal or text field has focus. */
  shortcut?: string;
  /** Short trailing hint shown on the right of the row. */
  hint?: string;
}

export const GROUP_LABEL: Record<CommandGroup, string> = {
  navigate: "Go to",
  train: "Train",
  measure: "Measure",
  record: "Record",
  view: "View",
  data: "Data",
};

/** Handlers the palette needs in order to run a command. */
export interface CommandHandlers {
  openWorkbench: (tab: WorkbenchTabId) => void;
  openPlanner: () => void;
  runProbe: (probeId: string) => void;
  openMission: (missionId: string) => void;
  showPath: (pathId: string) => void;
  selectNode: (nodeId: string) => void;
  fitView: () => void;
  toggleFocusMode: () => void;
  toggleResearchMode: () => void;
}

export interface BuiltCommand extends CommandAction {
  run: () => void;
}

export function buildCommands(
  handlers: CommandHandlers,
  context: { hasSelection: boolean; focusMode: boolean; researchMode: boolean },
): BuiltCommand[] {
  const commands: BuiltCommand[] = [
    {
      id: "review",
      label: "Open review queue",
      group: "navigate",
      keywords: "inbox due today attention",
      shortcut: "r",
      run: () => handlers.openWorkbench("review"),
    },
    {
      id: "plan",
      label: "Plan a training session",
      group: "train",
      keywords: "workout exercise daily practice minutes",
      shortcut: "p",
      run: handlers.openPlanner,
    },
    {
      id: "goals",
      label: "Open goals",
      group: "navigate",
      keywords: "goal plan path weeks target",
      shortcut: "g",
      run: () => handlers.openWorkbench("goals"),
    },
    {
      id: "insights",
      label: "Open graph insights",
      group: "view",
      keywords: "bottleneck leverage analysis structure",
      shortcut: "i",
      run: () => handlers.openWorkbench("insights"),
    },
    {
      id: "predictions",
      label: "Open predictions and calibration",
      group: "record",
      keywords: "forecast brier probability resolve",
      run: () => handlers.openWorkbench("predictions"),
    },
    {
      id: "prediction-new",
      label: "Record a prediction",
      group: "record",
      keywords: "forecast bet probability new",
      run: () => handlers.openWorkbench("predictions"),
    },
    {
      id: "experiments",
      label: "Open personal experiments",
      group: "record",
      keywords: "ab test hypothesis intervention n-of-1",
      run: () => handlers.openWorkbench("experiments"),
    },
    {
      id: "evidence",
      label: "Open evidence portfolio",
      group: "view",
      keywords: "proof artifacts capstone portfolio work",
      run: () => handlers.openWorkbench("evidence"),
    },
    {
      id: "analytics",
      label: "Open analytics",
      group: "view",
      keywords: "telemetry trajectory stats progress",
      shortcut: "a",
      run: () => handlers.openWorkbench("analytics"),
    },
    {
      id: "personal",
      label: "Create a personal capability",
      group: "record",
      keywords: "custom node my own skill add",
      run: () => handlers.openWorkbench("personal"),
    },
    {
      id: "browse",
      label: "Browse all capabilities as a list",
      group: "navigate",
      keywords: "list table accessible keyboard non-visual index",
      shortcut: "b",
      run: () => handlers.openWorkbench("browse"),
    },
    {
      id: "fit",
      label: "Fit the entire map",
      group: "view",
      keywords: "zoom out overview whole graph",
      shortcut: "f",
      run: handlers.fitView,
    },
    {
      id: "research",
      label: `Turn Research Mode ${context.researchMode ? "off" : "on"}`,
      group: "view",
      keywords: "science evidence mechanism internals ranking",
      run: handlers.toggleResearchMode,
    },
  ];

  if (context.hasSelection) {
    commands.push({
      id: "focus",
      label: `Turn Focus Mode ${context.focusMode ? "off" : "on"}`,
      group: "view",
      keywords: "isolate neighbourhood declutter",
      run: handlers.toggleFocusMode,
    });
  }

  for (const probe of PROBES) {
    commands.push({
      id: `probe:${probe.id}`,
      label: `Run diagnostic: ${probe.label}`,
      group: "measure",
      keywords: `probe test measure baseline ${probe.blurb}`,
      hint: probe.timed ? "timed" : undefined,
      run: () => handlers.runProbe(probe.id),
    });
  }

  for (const mission of missions) {
    commands.push({
      id: `mission:${mission.id}`,
      label: `Start mission: ${mission.label}`,
      group: "train",
      keywords: `mission transfer multi-node ${mission.blurb}`,
      hint: `${mission.estimatedMinutes} min`,
      run: () => handlers.openMission(mission.id),
    });
  }

  for (const path of paths) {
    commands.push({
      id: `path:${path.id}`,
      label: `Show path: ${path.label}`,
      group: "navigate",
      keywords: `path overlay curriculum ${path.outcome}`,
      hint: `${path.nodeIds.length} nodes`,
      run: () => handlers.showPath(path.id),
    });
  }

  for (const capstone of capstones) {
    commands.push({
      id: `capstone:${capstone.id}`,
      label: `Open capstone: ${capstone.label}`,
      group: "measure",
      keywords: `capstone demonstrate proof ${capstone.clusterLabel}`,
      run: () => handlers.selectNode(capstone.nodeIds[0]),
    });
  }

  return commands;
}

/** Ranked substring match. Exact prefix beats label match beats keyword match. */
export function filterCommands(commands: BuiltCommand[], query: string): BuiltCommand[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return commands.filter((command) => command.shortcut !== undefined);

  return commands
    .map((command) => {
      const label = command.label.toLowerCase();
      if (label.startsWith(needle)) return { command, rank: 0 };
      if (label.includes(needle)) return { command, rank: 1 };
      if (command.keywords?.toLowerCase().includes(needle)) return { command, rank: 2 };
      return null;
    })
    .filter((entry): entry is { command: BuiltCommand; rank: number } => entry !== null)
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.command);
}
