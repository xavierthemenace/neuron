import type { CoachConsent } from "./db.ts";
import { nodesById } from "./curriculum.ts";
import { KIND_LABEL } from "./evidence.ts";
import type { LearnerModel } from "./learner.ts";
import type { ConceptNode, Progress } from "./types.ts";

/**
 * Building the coach's context, one consent at a time.
 *
 * Two rules, enforced here rather than in the component: nothing leaves the
 * device without an explicit per-category consent, and whatever does leave is
 * rendered as the exact string the user can read before pressing send. A
 * privacy notice that describes what *might* be sent is not the same as showing
 * the payload, and only the second one is checkable.
 */

export interface ContextSection {
  key: keyof CoachConsent;
  label: string;
  /** What this specific section would contain, right now. */
  preview: string;
  /** Rough character cost, so "minimum necessary" is visible. */
  size: number;
  /** Why the coach would be better with it. */
  rationale: string;
  sensitive: boolean;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

export function buildContextSections(
  model: LearnerModel,
  progress: Progress,
  selectedNode: ConceptNode | null,
  journalExcerpt: string | null,
): ContextSection[] {
  const sections: ContextSection[] = [];

  if (selectedNode) {
    const preview = [
      `${selectedNode.label} (${KIND_LABEL[selectedNode.kind ?? "competency"]})`,
      selectedNode.description,
      `Why it matters: ${selectedNode.why}`,
      `Exercises: ${selectedNode.exercises.map((exercise) => exercise.label).join("; ")}`,
      selectedNode.evidence
        ? `Known limitations: ${selectedNode.evidence.knownLimitations}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    sections.push({
      key: "selectedNode",
      label: "The selected capability",
      preview,
      size: preview.length,
      rationale:
        "Without this the coach is guessing at what you are training. This is curriculum text, not personal data.",
      sensitive: false,
    });
  }

  const estimate = selectedNode ? model.estimates[selectedNode.id] : undefined;
  const retention = selectedNode ? model.retentionByNodeId[selectedNode.id] : undefined;
  if (estimate) {
    const preview = [
      `Practice ${Math.round(estimate.practice * 100)}%`,
      `Competence ${Math.round(estimate.competence * 100)}% (confidence: ${estimate.confidence})`,
      retention ? `Retention ${Math.round(retention.retention * 100)}%` : "",
      `${estimate.strongObservations} scored or judged observations`,
    ]
      .filter(Boolean)
      .join(" · ");
    sections.push({
      key: "estimates",
      label: "Your estimates for this capability",
      preview,
      size: preview.length,
      rationale: "Lets the coach pitch difficulty at roughly the right level.",
      sensitive: false,
    });
  }

  const recent = progress.logs
    .slice(-8)
    .reverse()
    .map((log) => {
      const label = nodesById.get(log.nodeId)?.label ?? log.nodeId;
      return `${label}: ${truncate(log.note ?? "(no note)", 140)}`;
    });
  if (recent.length > 0) {
    const preview = recent.join("\n");
    sections.push({
      key: "recentActivity",
      label: "Your last 8 completions, including your written work",
      preview,
      size: preview.length,
      rationale:
        "The only way the coach can critique your actual work rather than talk about the topic in general.",
      sensitive: true,
    });
  }

  const diagnostics = progress.diagnostics.slice(-6).map(
    (result) =>
      `${result.probeId}: ${Math.round(result.score * 100)}% at difficulty ${result.difficulty} (${result.items} items)`,
  );
  if (diagnostics.length > 0) {
    const preview = diagnostics.join("\n");
    sections.push({
      key: "diagnostics",
      label: "Your recent diagnostic scores",
      preview,
      size: preview.length,
      rationale: "Objective performance, so advice can respond to measurement rather than vibes.",
      sensitive: true,
    });
  }

  const goals = progress.goals
    .filter((goal) => goal.status === "active")
    .map((goal) => `${goal.label}${goal.motivation ? ` — ${goal.motivation}` : ""}`);
  if (goals.length > 0) {
    const preview = goals.join("\n");
    sections.push({
      key: "goals",
      label: "Your active goals",
      preview,
      size: preview.length,
      rationale: "Lets exercises be built toward something you actually want.",
      sensitive: true,
    });
  }

  if (journalExcerpt && journalExcerpt.trim()) {
    const preview = truncate(journalExcerpt.trim(), 1200);
    sections.push({
      key: "journal",
      label: "Your journal for this capability",
      preview,
      size: preview.length,
      rationale:
        "The richest context available and the most personal. Only worth sending when you want the coach to work on something you wrote.",
      sensitive: true,
    });
  }

  return sections;
}

/** Assembles only the consented sections into the exact string that will be sent. */
export function assembleContext(
  sections: ContextSection[],
  consent: CoachConsent,
): { text: string; included: ContextSection[] } {
  const included = sections.filter((section) => consent[section.key]);
  if (included.length === 0) {
    return {
      text: "(No personal context shared. Answer generally.)",
      included,
    };
  }
  return {
    text: included
      .map((section) => `## ${section.label}\n${section.preview}`)
      .join("\n\n"),
    included,
  };
}
