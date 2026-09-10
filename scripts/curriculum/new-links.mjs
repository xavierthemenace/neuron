/**
 * Edges added in curriculum 2.0.0.
 *
 * Every entry carries a relation, a strength, a confidence in the relationship
 * itself (not in either endpoint) and a mechanism. The mechanism field is the
 * point: an edge nobody can explain is an edge nobody should draw.
 *
 * l(source, target, relation, strength, confidence, mechanism, conditional?)
 */
function l(source, target, relation, strength, confidence, mechanism, conditional) {
  const type =
    relation === "inhibition"
      ? "inhibition"
      : relation === "prerequisite" || relation === "enabling" || relation === "supporting" || relation === "transfer"
        ? "prereq"
        : "synergy";
  const link = { source, target, type, relation, strength, confidence, mechanism };
  if (conditional) link.conditional = conditional;
  return link;
}

export const NEW_LINKS = [
  // ── Executive Control, internal ─────────────────────────────────────────
  l("exec-goal-maintenance", "exec-planning", "prerequisite", 0.65, "moderate",
    "A plan is a sequence held against a goal. If the goal is not actively represented there is nothing for the sequence to be evaluated against."),
  l("exec-goal-maintenance", "exec-initiation", "supporting", 0.5, "moderate",
    "Initiation failures are frequently goal-representation failures: the intention is intact but not currently active when the trigger arrives."),
  l("exec-planning", "exec-initiation", "supporting", 0.55, "strong",
    "A specified first action is the single strongest predictor of whether a task starts; planning is what produces one."),
  l("exec-inhibition", "exec-flexibility", "shared-mechanism", 0.5, "moderate",
    "Both load the same executive substrate in Miyake's factor structure: switching requires suppressing the previously active task set."),
  l("exec-planning", "exec-error-monitoring", "supporting", 0.45, "moderate",
    "An explicit plan gives errors something to be detected against; without an expected state there is no discrepancy signal."),
  l("exec-error-monitoring", "exec-flexibility", "supporting", 0.45, "moderate",
    "Detecting that the current approach is failing is the trigger that a set shift requires; undetected errors produce persistence."),

  // ── Epistemic, internal ─────────────────────────────────────────────────
  l("epi-source-reliability", "epi-evidence-eval", "supporting", 0.6, "moderate",
    "Provenance sets the prior weight before content is examined at all, which is what makes lateral reading faster than close reading."),
  l("epi-evidence-eval", "epi-bayesian", "prerequisite", 0.7, "moderate",
    "The size of an update is a judgement about the evidence's likelihood ratio; without evidence weighting the arithmetic is theatre."),
  l("epi-evidence-eval", "epi-causal-inference", "supporting", 0.5, "moderate",
    "Design quality is the largest single input to whether an observed association licenses a causal reading."),
  l("epi-causal-inference", "epi-experimental-design", "prerequisite", 0.75, "strong",
    "You cannot design a comparison that isolates a cause without first representing the causal structure you are trying to cut."),
  l("epi-falsification", "epi-experimental-design", "prerequisite", 0.65, "strong",
    "A design is only informative if some outcome would have counted against the hypothesis; specifying that outcome is the falsification step."),
  l("epi-bayesian", "epi-model-uncertainty", "supporting", 0.45, "emerging",
    "Explicit updating makes visible the cases where no parameter value fits, which is the signal that the model rather than the estimate is wrong."),
  l("epi-falsification", "epi-model-uncertainty", "supporting", 0.5, "emerging",
    "Repeatedly failing to find a disconfirmer that the model predicts should exist is evidence about the model's domain of validity."),

  // ── Decision, internal ──────────────────────────────────────────────────
  l("dec-calibration", "dec-expected-value", "prerequisite", 0.7, "strong",
    "Expected value is only as good as the probabilities entered into it; uncalibrated inputs produce precise, wrong numbers."),
  l("dec-opportunity-cost", "dec-expected-value", "supporting", 0.5, "moderate",
    "Opportunity cost supplies the comparison baseline an expected-value calculation is implicitly measured against."),
  l("dec-expected-value", "dec-value-of-information", "prerequisite", 0.75, "strong",
    "The value of information is defined as the change in expected value it produces; without the EV frame the question cannot be posed."),
  l("dec-journal", "dec-calibration", "supporting", 0.6, "moderate",
    "Calibration requires a contemporaneous record of stated confidence. Memory reconstructs prior beliefs toward the outcome."),
  l("dec-journal", "dec-reversibility", "supporting", 0.4, "emerging",
    "The journal is what reveals, in aggregate, which of your decisions actually turned out to be cheap to unwind."),
  l("dec-reversibility", "dec-value-of-information", "synergy", 0.45, "emerging",
    "Both answer the same question from opposite ends: how much deliberation this decision deserves before acting."),

  // ── Creative, internal ──────────────────────────────────────────────────
  l("cre-divergent", "cre-convergent", "prerequisite", 0.7, "moderate",
    "Selection is only meaningful over an option set that contains genuinely different options; otherwise it ranks variations of one idea."),
  l("cre-reframing", "cre-divergent", "supporting", 0.55, "moderate",
    "Changing the problem statement changes which options are even generable — reframing expands the space that generation then searches."),
  l("cre-combination", "cre-divergent", "shared-mechanism", 0.5, "moderate",
    "Both depend on retrieving remote associates; the difference is that combination supplies a procedure for doing it deliberately."),
  l("cre-convergent", "cre-iteration", "prerequisite", 0.55, "moderate",
    "Iteration needs a chosen candidate to iterate on. Without selection, cycles restart rather than converge."),
  l("cre-iteration", "cre-reframing", "synergy", 0.4, "emerging",
    "Each cycle's failure is evidence about which constraint is actually binding, which is the input reframing needs."),

  // ── Augmented, internal ─────────────────────────────────────────────────
  l("aug-decomposition", "aug-search", "supporting", 0.5, "moderate",
    "A well-cut sub-problem is a searchable query. Most failed searches are searches for an undecomposed question."),
  l("aug-search", "aug-verification", "prerequisite", 0.6, "moderate",
    "Independent verification requires being able to find a second source that does not share the first one's inputs."),
  l("aug-decomposition", "aug-ai-collaboration", "prerequisite", 0.65, "emerging",
    "Delegation quality is bounded by specification quality; an undecomposed task cannot be handed to a tool or a person."),
  l("aug-verification", "aug-ai-collaboration", "enabling", 0.6, "moderate",
    "Without independent checking, assistance improves output inside the model's competence and degrades it outside, while confidence rises in both cases.",
    "Matters most when the task sits near the boundary of the tool's reliable range."),
  l("aug-external-cognition", "aug-decomposition", "supporting", 0.45, "moderate",
    "Writing the parts down is what makes their interfaces inspectable; decomposition held in the head collapses back into one blob."),

  // ── Learning Control, internal ──────────────────────────────────────────
  l("lrn-difficulty", "lrn-practice-design", "prerequisite", 0.7, "strong",
    "Difficulty is the first parameter of any session design; every other choice is conditional on where the material sits relative to your ceiling."),
  l("lrn-feedback", "lrn-practice-design", "prerequisite", 0.65, "strong",
    "A practice loop without a feedback channel is repetition. Designing the session means designing where the signal comes from."),
  l("lrn-error-classification", "lrn-feedback", "supporting", 0.55, "moderate",
    "Feedback is only actionable once the error's cause is identified; the same comment implies different fixes for different error classes."),
  l("lrn-practice-design", "lrn-strategy-selection", "prerequisite", 0.6, "moderate",
    "You cannot compare strategies without holding session structure fixed enough for the comparison to mean something."),
  l("lrn-error-classification", "lrn-strategy-selection", "supporting", 0.5, "moderate",
    "The distribution of your error causes is the main evidence for which strategy the material actually needs."),

  // ── Long-Horizon, internal ──────────────────────────────────────────────
  l("str-goal-decomposition", "str-prioritization", "prerequisite", 0.65, "moderate",
    "Ranking requires comparable units. Decomposition is what turns incomparable ambitions into candidate actions that can be ordered."),
  l("str-prioritization", "str-resource-allocation", "prerequisite", 0.7, "moderate",
    "Allocation is prioritisation with a budget attached; an unranked list cannot be funded differentially."),
  l("str-goal-decomposition", "str-strategy", "supporting", 0.5, "emerging",
    "A strategy that cannot be decomposed into this week's actions is an aspiration, and the decomposition attempt is what exposes that."),
  l("str-scenario-planning", "str-strategy", "supporting", 0.55, "emerging",
    "Scenarios identify which commitments are robust across futures, which is what a guiding policy needs to be built from."),
  l("str-resource-allocation", "str-strategy", "synergy", 0.45, "emerging",
    "Stated strategy and actual allocation diverge constantly; comparing them is the cheapest available audit of either."),

  // ── New nodes into the existing core ────────────────────────────────────
  l("gwm-span", "exec-goal-maintenance", "enabling", 0.5, "moderate",
    "The goal has to be held somewhere. Span sets the ceiling on how much context can stay active alongside the work itself."),
  l("intra-attention", "exec-goal-maintenance", "shared-mechanism", 0.6, "moderate",
    "Attention control and goal maintenance are measured by overlapping tasks and are plausibly the same capacity described from two directions."),
  l("gwm-updating", "exec-flexibility", "shared-mechanism", 0.55, "strong",
    "Both load Miyake's shifting/updating factors, which are correlated but separable; a change in one predicts a partial change in the other."),
  l("eqr-impulse-control", "exec-inhibition", "shared-mechanism", 0.65, "moderate",
    "The same suppression machinery, measured in an emotional and a neutral context; the correlation between the two is real but modest."),
  l("eqr-habit-design", "exec-initiation", "supporting", 0.6, "strong",
    "Implementation intentions work by pre-committing the trigger, which removes the decision that initiation usually stalls on."),
  l("exec-error-monitoring", "eqa-bias-awareness", "supporting", 0.45, "emerging",
    "Bias correction can only fire on a detected discrepancy; error monitoring supplies the discrepancy signal at the decision point."),
  l("exec-planning", "str-goal-decomposition", "shared-mechanism", 0.5, "moderate",
    "Both build action structure from an outcome; planning orders steps horizontally, decomposition descends levels vertically."),
  l("exec-planning", "gf-novel-problem", "supporting", 0.45, "moderate",
    "Novel problems are solved by search, and planning is what keeps the search from re-exploring branches already ruled out."),

  l("log-probability", "epi-bayesian", "prerequisite", 0.75, "strong",
    "Updating requires the probability machinery to operate on: priors, likelihoods and the conditioning step itself."),
  l("ling-reading", "epi-source-reliability", "prerequisite", 0.5, "moderate",
    "Establishing provenance means reading around a source quickly and accurately, which is analytical reading applied sideways."),
  l("gc-quantitative-literacy", "epi-evidence-eval", "supporting", 0.6, "strong",
    "Most evidence arrives as statistics. Misreading an interval or a base rate is the commonest evidence-weighting failure."),
  l("gf-hypothesis", "epi-falsification", "prerequisite", 0.6, "moderate",
    "You cannot look for a disconfirmer until there is a specific hypothesis that predicts something could fail to appear."),
  l("gf-hypothesis", "epi-experimental-design", "prerequisite", 0.6, "strong",
    "A design is a hypothesis with a comparison attached; the hypothesis has to exist and be discriminating first."),
  l("gf-inductive", "epi-causal-inference", "supporting", 0.45, "moderate",
    "Induction proposes the regularity; causal inference asks what structure could produce it and what else that structure implies."),
  l("eqa-bias-awareness", "epi-falsification", "supporting", 0.5, "moderate",
    "Confirmation bias is the specific failure falsification discipline is built to counter, and naming it is the first step in the debiasing procedures that work."),
  l("log-systems", "epi-causal-inference", "synergy", 0.45, "emerging",
    "Systems diagrams and causal graphs are the same object drawn by different communities; each catches errors the other tolerates."),
  l("epi-model-uncertainty", "gc-mental-models", "supporting", 0.5, "emerging",
    "A model library is only safe if each entry carries its domain of validity; otherwise breadth increases the rate of confident misapplication."),

  l("log-probability", "dec-calibration", "prerequisite", 0.7, "strong",
    "Calibration is measured with proper scoring rules over stated probabilities; the probabilities have to be meaningful first."),
  l("log-estimation", "dec-expected-value", "supporting", 0.55, "moderate",
    "Payoff terms usually have to be estimated rather than looked up, and an order-of-magnitude error there dominates everything else in the calculation."),
  l("gc-quantitative-literacy", "dec-expected-value", "supporting", 0.5, "moderate",
    "Expected value is arithmetic over quantities you must first read correctly out of the world."),
  l("eqa-bias-awareness", "dec-journal", "supporting", 0.5, "moderate",
    "The journal's main documented benefit is defeating hindsight bias, which requires knowing that hindsight bias is what is happening."),
  l("intra-metacognition", "dec-journal", "supporting", 0.5, "moderate",
    "Recording expected outcomes is metacognitive monitoring with a timestamp attached."),
  l("dec-reversibility", "exec-flexibility", "synergy", 0.35, "emerging",
    "Preserving optionality is only useful if you will actually switch when the evidence arrives; flexibility is what cashes the option in."),

  l("gf-analogy", "cre-combination", "prerequisite", 0.6, "moderate",
    "Combination requires mapping structure from one concept onto another, which is analogical mapping with the conclusion left open."),
  l("gf-hypothesis", "cre-divergent", "shared-mechanism", 0.5, "moderate",
    "Both are fluency tasks over a constrained space; the difference is whether the output is judged for truth or for usefulness."),
  l("spa-visualization", "cre-combination", "supporting", 0.4, "emerging",
    "Imagining the hybrid object concretely is how its emergent properties become inspectable rather than merely asserted."),
  l("mus-improvisation", "cre-divergent", "analogical", 0.3, "emerging",
    "Improvisation is real-time divergent generation under a hard time constraint; the analogy is instructive but transfer between them is unevidenced.",
    "Treat as a teaching bridge, not as a claim that practising one trains the other."),
  l("cre-convergent", "dec-opportunity-cost", "shared-mechanism", 0.4, "emerging",
    "Both are the discipline of pricing what you give up; one names the discarded option, the other names the displaced use of a resource."),

  l("gc-note-system", "aug-external-cognition", "shared-mechanism", 0.6, "moderate",
    "A note system is external cognition specialised for retrieval over long horizons; the offloading mechanism is identical, the timescale is not."),
  l("gwm-dual-task", "aug-external-cognition", "supporting", 0.55, "moderate",
    "Recognising that a task exceeds capacity is what prompts offloading; without load awareness the scratch pad never comes out."),
  l("ling-reading", "aug-search", "supporting", 0.45, "moderate",
    "Search is mostly rapid triage of candidate sources, which is analytical reading executed at low resolution and high speed."),
  l("log-algorithmic", "aug-decomposition", "transfer", 0.5, "moderate",
    "Decomposition is the explicit content of algorithmic practice, and it is one of the few things from that practice that shows up outside it."),
  l("gc-technical-fluency", "aug-ai-collaboration", "supporting", 0.55, "emerging",
    "Domain fluency is what lets you see the jagged edge: without it, plausible wrong output and correct output are indistinguishable."),
  l("eqa-bias-awareness", "aug-verification", "supporting", 0.45, "emerging",
    "Automation bias is a specific, named failure mode; checking behaviour improves when the person expects it in themselves."),
  l("gwm-span", "aug-external-cognition", "shared-mechanism", 0.5, "strong",
    "Offloading is valuable precisely because span is fixed; the size of the benefit tracks how far the task exceeds capacity."),

  l("intra-metacognition", "lrn-difficulty", "prerequisite", 0.65, "moderate",
    "Choosing difficulty requires an accurate read of your current ceiling, which is exactly what metacognitive monitoring supplies."),
  l("gc-retrieval-practice", "lrn-practice-design", "supporting", 0.6, "strong",
    "Retrieval is the best-evidenced component available to a session design; a design that omits it is leaving the largest known effect on the table."),
  l("gc-spaced-repetition", "lrn-practice-design", "supporting", 0.6, "strong",
    "Spacing is a scheduling parameter of the session design rather than a separate activity."),
  l("gc-interleaving", "lrn-practice-design", "supporting", 0.55, "strong",
    "Interleaving is an ordering decision inside the session, and the one learners most reliably get wrong when left to themselves."),
  l("eqa-feedback-seeking", "lrn-feedback", "prerequisite", 0.6, "moderate",
    "Integration requires feedback to exist. Seeking is upstream of using, and is the step most often skipped."),
  l("intra-metacognition", "lrn-error-classification", "supporting", 0.55, "moderate",
    "Classifying your own error causes is a monitoring judgement, and it inherits monitoring's known inaccuracy."),
  l("lrn-strategy-selection", "gc-transfer", "supporting", 0.4, "emerging",
    "Strategies that vary context and require abstraction are the ones associated with transfer; selection is where that gets chosen or not."),
  l("lrn-difficulty", "kin-motor-learning", "transfer", 0.45, "moderate",
    "Desirable-difficulty effects were established in motor learning first; the same manipulation reappears with the same signature there."),

  l("intra-values", "str-prioritization", "supporting", 0.45, "emerging",
    "A ranking needs a criterion. Where the criterion is unstated, priority defaults to whatever is most urgent or most socially visible."),
  l("log-systems", "str-scenario-planning", "supporting", 0.5, "emerging",
    "Scenarios have to be internally consistent, which means tracing feedback loops rather than varying one factor at a time."),
  l("gc-history-context", "str-scenario-planning", "supporting", 0.45, "moderate",
    "Historical cases are the main source of scenarios that are not simply the present extrapolated, though the analogies mislead as often as they help."),
  l("eqr-delayed-gratification", "str-resource-allocation", "supporting", 0.5, "moderate",
    "Allocation over long horizons requires tolerating a worse near-term position, which is the delay choice with a spreadsheet attached."),
  l("inter-negotiation", "str-strategy", "synergy", 0.4, "emerging",
    "Strategy defines the reservation value a negotiation defends; negotiation outcomes are the evidence that a strategy is or is not achievable."),
  l("aug-decomposition", "gf-novel-problem", "prerequisite", 0.6, "moderate",
    "Novel problems are attacked by reduction to solved sub-problems, which is decomposition doing the work under another name."),

  // ── Inhibition edges: real trade-offs, drawn distinctly ─────────────────
  l("gs-decision-speed", "dec-calibration", "inhibition", 0.35, "moderate",
    "Speed–accuracy trade-off: pushing decision speed past your threshold degrades calibration well before it degrades felt confidence.",
    "Only under time pressure. At a moderate pace the two are effectively independent."),
  l("exec-inhibition", "cre-divergent", "inhibition", 0.25, "emerging",
    "Strong suppression of prepotent responses narrows the search early, cutting off the remote associates divergent generation depends on.",
    "During the generation phase only — inhibition helps during selection."),
  l("gs-automaticity", "exec-error-monitoring", "inhibition", 0.3, "moderate",
    "Automatised responses execute below the threshold at which errors are consciously detected, so fluency lowers the self-catch rate.",
    "Applies to the specific automatised mapping, not to your monitoring in general."),
  l("aug-ai-collaboration", "gc-domain-depth", "inhibition", 0.3, "emerging",
    "Offloading generation removes the retrieval practice that builds depth — the Google effect applied to a skill rather than a fact.",
    "Only when the offloaded task is one you are still trying to learn."),
];

export { l as link };
