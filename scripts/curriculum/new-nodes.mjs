/**
 * The 39 nodes added in curriculum 2.0.0, plus the seven categories that hold
 * them. Every entry is authored to the full schema: kind, scientific
 * constructs, three-pillar evidence, measurement method, known limitations,
 * citations, exercises with difficulty ladders, and resources.
 *
 * Hues are chosen to fall in the gaps left by the original sixteen categories
 * (free arcs were roughly 0-20, 65-110, 110-145, 175-200 and 340-360).
 */

export const NEW_CATEGORIES = [
  {
    id: "executive",
    domain: "executive",
    label: "Executive Control",
    hue: 8,
    blurb:
      "The control layer: holding a goal, switching when the situation changes, stopping a response, and noticing your own errors.",
  },
  {
    id: "learning",
    domain: "executive",
    label: "Learning Control",
    hue: 74,
    blurb:
      "Deciding how to practise. Difficulty, feedback, error diagnosis and strategy choice — the machinery that makes every other node train faster.",
  },
  {
    id: "augmented",
    domain: "generative",
    label: "Augmented Cognition",
    hue: 88,
    blurb:
      "Thinking through tools without outsourcing judgement: search, decomposition, external memory, AI collaboration, and verification.",
  },
  {
    id: "strategic",
    domain: "strategic",
    label: "Long-Horizon Cognition",
    hue: 100,
    blurb:
      "Reasoning across months and years — decomposing goals, allocating scarce attention, and planning against futures you cannot predict.",
  },
  {
    id: "decision",
    domain: "epistemic",
    label: "Decision Intelligence",
    hue: 128,
    blurb:
      "Choosing well under uncertainty: expected value, opportunity cost, the price of information, and keeping an honest record of your own calls.",
  },
  {
    id: "epistemic",
    domain: "epistemic",
    label: "Epistemic Intelligence",
    hue: 188,
    blurb:
      "How you come to believe things. Evidence quality, source reliability, causal structure, updating, and knowing the edges of your own model.",
  },
  {
    id: "creative",
    domain: "generative",
    label: "Creative Cognition",
    hue: 350,
    blurb:
      "Generation and selection treated as separate skills: producing genuinely different options, then killing most of them on purpose.",
  },
];

/** Compact authoring helper — expands to the full ConceptNode shape. */
function n(id, categoryId, label, tier, spec) {
  return { id, categoryId, label, tier, ...spec };
}

/** Exercise helper: e(label, xp, cadence, difficulty, evidence, minutes, progression) */
function e(label, xp, cadence, difficulty, evidence, minutes, progression) {
  return { label, xp, cadence, difficulty, evidence, minutes, progression };
}

export const NEW_NODES = [
  // ══ Executive Control ═══════════════════════════════════════════════════
  n("exec-goal-maintenance", "executive", "Goal Maintenance", 0, {
    kind: "meta",
    constructs: ["executive-control", "working-memory"],
    desc: "Keeping an active goal represented and dominant while you work, so that what you are doing at minute forty is still what you decided to do at minute one. It is the difference between being distracted and having quietly forgotten the point.",
    why: "Almost every failure people call 'procrastination' or 'distraction' is a goal that stopped being represented. Restoring the goal is cheaper than restoring the motivation.",
    bands: "strong/moderate/emerging",
    measure:
      "Interrupt yourself at random intervals and write down, unprompted, the goal you believe you are currently pursuing. Score the match against the goal you wrote at the start of the block.",
    limits:
      "Goal maintenance is measurable in the lab (AX-CPT and similar) but the everyday version depends heavily on environment and sleep. Improvement here is often environmental redesign rather than a capacity change.",
    cite: ["miyake2000", "diamond2013", "unsworth2014"],
    retention: "executive-habit",
    res: [
      ["Executive Functions — Diamond (2013)", "paper"],
      ["Deep Work — Cal Newport", "book"],
      ["A single index card with the session goal on it", "practice"],
    ],
    ex: [
      e("Write one session goal before starting, and check it at a random alarm mid-session", 10, "daily", 1, "self-report", 5, [
        "Check at three random alarms and record the drift each time",
        "Write the goal as a falsifiable done-condition before starting",
      ]),
      e("Log every task switch for one work block and name the trigger for each", 14, "daily", 2, "artifact", 20, [
        "Do it for a full day and classify triggers into internal and external",
      ]),
      e("Run a 90-minute block with the goal restated aloud every 25 minutes", 20, "weekly", 3, "self-report", 90, [
        "Extend to two consecutive blocks with a written drift log",
      ]),
    ],
  }),

  n("exec-inhibition", "executive", "Response Inhibition", 0, {
    kind: "ability",
    constructs: ["executive-control"],
    desc: "Cancelling a prepared response before it executes — the hand already moving to the phone, the reply already forming. Distinct from working-memory updating: this is stopping, not revising.",
    why: "The gap between having an impulse and emitting it is where almost all of your leverage over your own behaviour lives.",
    bands: "strong/moderate/emerging",
    measure:
      "Stop-signal reaction time in a go/no-go task, plus a real-world count: intended-versus-emitted responses in one situation you nominate in advance.",
    limits:
      "Laboratory inhibition correlates only weakly with everyday self-control, and training the lab task moves the lab task. Do not read a better stop-signal score as better restraint.",
    cite: ["miyake2000", "diamond2016", "diamond2013"],
    retention: "executive-habit",
    res: [
      ["The Unity and Diversity of Executive Functions — Miyake et al. (2000)", "paper"],
      ["Conclusions about interventions to improve executive functions — Diamond & Ling (2016)", "paper"],
      ["Atomic Habits — James Clear", "book"],
    ],
    ex: [
      e("Nominate one prepotent response today and record every time you stopped it and every time you did not", 10, "daily", 2, "self-report", 10, [
        "Add the delay you achieved before acting, in seconds",
      ]),
      e("Introduce a 10-second physical delay between an urge and the action for one full day", 12, "daily", 2, "self-report", 15, [
        "Extend the delay to 60 seconds and record what changed in the decision",
      ]),
      e("Run a 5-minute go/no-go probe and record commission errors, not just accuracy", 12, "weekly", 3, "scored", 5, [
        "Run it at two times of day and compare the error rates",
      ]),
    ],
  }),

  n("exec-flexibility", "executive", "Cognitive Flexibility", 1, {
    kind: "ability",
    constructs: ["executive-control", "fluid-reasoning"],
    desc: "Switching between task sets, rules or framings on demand, and paying as little as possible for the switch. Includes the harder half: abandoning a rule that used to work.",
    why: "Rigidity is expensive precisely when the situation has changed — which is exactly when you are least likely to notice.",
    bands: "strong/moderate/emerging",
    measure:
      "Switch cost: your accuracy and response time on switch trials minus repeat trials in a task-switching probe. Real-world proxy: time from evidence-of-change to strategy-change.",
    limits:
      "Switch costs are robust and trainable within a paradigm, with little evidence of generalisation. High flexibility also has a cost — it trades against goal maintenance.",
    cite: ["miyake2000", "diamond2013", "diamond2016"],
    retention: "executive-habit",
    res: [
      ["Executive Functions — Diamond (2013)", "paper"],
      ["Range — David Epstein", "book"],
      ["Think Again — Adam Grant", "book"],
    ],
    ex: [
      e("Take a position you hold and argue the strongest opposing case in writing, in full", 20, "weekly", 3, "artifact", 25, [
        "Have someone who holds that view rate whether you represented it fairly",
      ]),
      e("Identify one rule or habit that no longer fits the situation and name what replaced it", 14, "weekly", 3, "artifact", 15, [
        "Do it for a rule you personally introduced",
      ]),
      e("Run a task-switching probe and record your switch cost", 10, "weekly", 2, "scored", 6, [
        "Compare switch cost when rested versus tired",
      ]),
    ],
  }),

  n("exec-planning", "executive", "Planning & Sequencing", 1, {
    kind: "meta",
    constructs: ["executive-control", "fluid-reasoning"],
    desc: "Turning an intention into an ordered set of actions with dependencies, and doing the ordering before you start rather than discovering it halfway through.",
    why: "Most plans fail at the seams — the step nobody sequenced. Explicit ordering surfaces the dependency you would otherwise hit at the worst moment.",
    bands: "moderate/strong/moderate",
    measure:
      "Plan-versus-actual: the number of steps you had to reorder or insert during execution, and the ratio of estimated to actual duration.",
    limits:
      "Planning skill is largely domain knowledge. Tower-of-London style lab planning tasks predict everyday planning poorly, and detailed plans can entrench a bad approach.",
    cite: ["miyake2000", "polya1945", "flyvbjerg2006"],
    retention: "executive-habit",
    res: [
      ["How to Solve It — Pólya", "book"],
      ["From Nobel Prize to Project Management: Getting Risks Right — Flyvbjerg (2006)", "paper"],
      ["The Checklist Manifesto — Gawande", "book"],
    ],
    ex: [
      e("Write the dependency order for one task before starting, then record every reorder you had to make", 14, "daily", 2, "artifact", 15, [
        "Add a duration estimate per step and score the total against reality",
      ]),
      e("Plan a multi-day piece of work backwards from its deadline", 18, "weekly", 3, "artifact", 25, [
        "Include an explicit slack budget and report whether you spent it",
      ]),
      e("Compare one finished project's plan to what actually happened and name the sequencing error", 22, "weekly", 4, "artifact", 30, [
        "Extract a reusable checklist item from the failure",
      ]),
    ],
  }),

  n("exec-initiation", "executive", "Task Initiation", 1, {
    kind: "meta",
    constructs: ["executive-control"],
    desc: "Starting, specifically: closing the gap between deciding to do something and the first real action on it. The failure mode is not laziness but an under-specified first step.",
    why: "Initiation latency is where the largest share of intended work is actually lost, and it responds to structural fixes far better than to resolve.",
    bands: "moderate/strong/moderate",
    measure:
      "Initiation latency: minutes between the scheduled start and the first substantive action, tracked across many attempts rather than on one good day.",
    limits:
      "Implementation intentions have solid medium-sized effects for simple, well-specified behaviours and considerably weaker ones for complex or aversive tasks. This is not a treatment for clinical procrastination.",
    cite: ["gollwitzer1999", "locke2002", "wood2016"],
    retention: "executive-habit",
    res: [
      ["Implementation Intentions — Gollwitzer (1999)", "paper"],
      ["The Now Habit — Neil Fiore", "book"],
      ["Building a Practically Useful Theory of Goal Setting — Locke & Latham (2002)", "paper"],
    ],
    ex: [
      e("Write one if-then implementation intention and record whether the trigger fired and whether you acted", 10, "daily", 1, "self-report", 5, [
        "Write three, covering the three tasks you most often postpone",
      ]),
      e("Specify the first physical action of a postponed task in under five words, then do it", 12, "daily", 2, "self-report", 10, [
        "Do this for the task you have postponed longest",
      ]),
      e("Record initiation latency for every scheduled block for a week and find the pattern", 20, "weekly", 3, "artifact", 20, [
        "Change one environmental variable and compare the following week",
      ]),
    ],
  }),

  n("exec-error-monitoring", "executive", "Error Monitoring", 2, {
    kind: "meta",
    constructs: ["executive-control"],
    desc: "Detecting that you have just made an error — ideally before the consequence arrives, and without needing someone else to point it out. Includes noticing the felt signal of a mistake and acting on it rather than continuing.",
    why: "An undetected error compounds. The interval between making a mistake and noticing it is one of the few quantities that improves nearly everything downstream when it shrinks.",
    bands: "strong/moderate/emerging",
    measure:
      "Self-caught error rate: of the errors eventually found in your work, what share did you catch yourself, and how long after committing them?",
    limits:
      "Error-related brain responses are well established; deliberately training error awareness in everyday work is not. Checking more can also mean finishing less.",
    cite: ["miyake2000", "graber2012", "gawande2009"],
    retention: "executive-habit",
    res: [
      ["The Checklist Manifesto — Gawande", "book"],
      ["Cognitive interventions to reduce diagnostic error — Graber et al. (2012)", "paper"],
      ["Black Box Thinking — Matthew Syed", "book"],
    ],
    ex: [
      e("Log every error you caught yourself today and how long after committing it you noticed", 12, "daily", 2, "artifact", 10, [
        "Add the errors someone else caught, and compute your self-catch share",
      ]),
      e("Review a finished piece of work specifically hunting for your own characteristic error type", 18, "weekly", 3, "artifact", 20, [
        "Build a personal checklist from the three errors you repeat most",
      ]),
      e("Run a pre-mortem on work in progress: assume it failed, and list why", 20, "weekly", 4, "artifact", 25, [
        "Score the pre-mortem afterwards against what actually went wrong",
      ]),
    ],
  }),

  // ══ Epistemic Intelligence ══════════════════════════════════════════════
  n("epi-evidence-eval", "epistemic", "Evidence Evaluation", 0, {
    kind: "competency",
    constructs: ["fluid-reasoning", "crystallized-knowledge"],
    desc: "Judging how much a given piece of evidence should move you: sample size, design, effect size, who chose the comparison, and what result would have been reported had it come out the other way.",
    why: "Most disagreements about facts are actually disagreements about evidence weight, conducted without either side stating a weight.",
    bands: "strong/strong/moderate",
    measure:
      "Given an unseen study or claim, state in advance how much it should move you and why; compare against a subsequent stronger source or replication.",
    limits:
      "Evidence evaluation skill is real and teachable, but it is applied selectively: people evaluate evidence far more rigorously when they dislike the conclusion.",
    cite: ["ioannidis2005", "nosek2015", "gigerenzer1995"],
    res: [
      ["Why Most Published Research Findings Are False — Ioannidis (2005)", "paper"],
      ["Calling Bullshit — Bergstrom & West", "book"],
      ["Our World in Data", "tool", "https://ourworldindata.org/"],
    ],
    ex: [
      e("Take one claim you encountered today and write what evidence would be sufficient to believe it", 12, "daily", 2, "artifact", 10, [
        "Also write what evidence would be sufficient to abandon it",
      ]),
      e("Read one study's methods section before its abstract and predict the effect size", 20, "weekly", 3, "scored", 25, [
        "Predict the confidence interval, then check",
      ]),
      e("Find a claim you believe on weak evidence and downgrade it in writing", 18, "weekly", 3, "artifact", 20, [
        "Do it for a claim that is socially costly for you to downgrade",
      ]),
    ],
  }),

  n("epi-source-reliability", "epistemic", "Source Reliability", 0, {
    kind: "competency",
    constructs: ["crystallized-knowledge", "reading-writing"],
    desc: "Establishing who is telling you something, what they know, what they gain, and what their track record is — before engaging with the content. The core move is lateral: leave the page and check the source elsewhere.",
    why: "Reading a source carefully on its own terms is exactly how a well-constructed unreliable source wins. Checking sideways is faster and works better.",
    bands: "strong/strong/moderate",
    measure:
      "Time-to-verdict and accuracy on unseen sources: can you correctly classify an unfamiliar site or author's reliability in under three minutes using lateral reading?",
    limits:
      "Lateral reading is well supported for web sources. It does not help with sources that are reliable in general and wrong in the specific instance, which is the harder case.",
    cite: ["wineburg2019", "ioannidis2005"],
    res: [
      ["Lateral Reading and the Nature of Expertise — Wineburg & McGrew (2019)", "paper"],
      ["Civic Online Reasoning (Stanford History Education Group)", "course", "https://cor.stanford.edu/"],
      ["Wikipedia's reliable-sources noticeboard as a worked corpus", "practice", "https://en.wikipedia.org/wiki/Wikipedia:Reliable_sources"],
    ],
    ex: [
      e("Take one source you cited today and spend three minutes checking it laterally", 12, "daily", 2, "artifact", 5, [
        "Do it before reading rather than after",
      ]),
      e("Write the incentive map for a source: who funds it, who reads it, what a wrong claim costs them", 18, "weekly", 3, "artifact", 20, [
        "Do it for a source you personally trust",
      ]),
      e("Trace one claim back through its citation chain to the primary source", 22, "weekly", 4, "artifact", 30, [
        "Find a case where the chain breaks or misstates the original",
      ]),
    ],
  }),

  n("epi-causal-inference", "epistemic", "Causal Inference", 1, {
    kind: "competency",
    constructs: ["fluid-reasoning", "quantitative"],
    desc: "Reasoning about what causes what, rather than what co-occurs: confounding, colliders, selection effects, and what intervention would distinguish the candidate structures.",
    why: "Nearly every practical decision is a causal claim in disguise. Correlational literacy without causal structure produces confident, wrong policy.",
    bands: "strong/moderate/moderate",
    measure:
      "Given an unseen association, draw the causal graph, name the plausible confounders and colliders, and state the intervention or natural experiment that would settle it.",
    limits:
      "Formal causal reasoning is teachable and the tools are well founded. Applying them to real observational data remains genuinely hard, and the assumptions are usually unverifiable.",
    cite: ["pearl2018", "mcelreath2020", "ioannidis2005"],
    res: [
      ["The Book of Why — Pearl & Mackenzie", "book"],
      ["Statistical Rethinking — McElreath", "book"],
      ["Causal Inference: The Mixtape — Scott Cunningham", "book", "https://mixtape.scunning.com/"],
    ],
    ex: [
      e("Draw the causal graph for one correlation you read about today", 14, "daily", 3, "artifact", 15, [
        "Include at least one collider and say what conditioning on it would do",
      ]),
      e("Name three confounders for a claim you currently accept", 12, "daily", 2, "artifact", 10, [
        "Rank them by how much they could plausibly explain the whole effect",
      ]),
      e("Design the experiment or natural experiment that would settle a causal question you care about", 24, "weekly", 4, "artifact", 35, [
        "State the assumptions your design still cannot test",
      ]),
    ],
  }),

  n("epi-bayesian", "epistemic", "Bayesian Updating", 1, {
    kind: "competency",
    constructs: ["quantitative", "fluid-reasoning"],
    desc: "Moving a stated prior by a stated amount in response to evidence — including the discipline of writing the prior down before you see the evidence, so the update is visible.",
    why: "Updating that is never quantified is indistinguishable from not updating, and both feel the same from the inside.",
    bands: "strong/moderate/moderate",
    measure:
      "Write a numeric prior, observe evidence, write a posterior, and later score the whole sequence against the outcome. Base-rate items in natural frequency format serve as a bench probe.",
    limits:
      "Explicit Bayesian calculation improves reasoning on well-posed problems, especially in frequency format. It transfers poorly to messy real questions where the likelihood ratio is itself a guess.",
    cite: ["gigerenzer1995", "hoffrage2000", "tetlock2015", "mcelreath2020"],
    res: [
      ["How to Improve Bayesian Reasoning Without Instruction — Gigerenzer & Hoffrage (1995)", "paper"],
      ["Superforecasting — Tetlock & Gardner", "book"],
      ["Metaculus (public forecasting with scoring)", "tool", "https://www.metaculus.com/"],
    ],
    ex: [
      e("Write a numeric prior for one open question before reading anything about it", 12, "daily", 2, "artifact", 8, [
        "Write the likelihood ratio you expect from the next piece of evidence",
      ]),
      e("Do five base-rate problems in natural frequency format and score them", 14, "weekly", 3, "scored", 20, [
        "Do them in probability format instead and compare your accuracy",
      ]),
      e("Record a prior, the evidence, and the posterior for a real decision this week", 22, "weekly", 4, "artifact", 25, [
        "Resolve it later and check whether the update was the right size",
      ]),
    ],
  }),

  n("epi-falsification", "epistemic", "Falsification & Disconfirmation", 1, {
    kind: "meta",
    constructs: ["fluid-reasoning", "executive-control"],
    desc: "Actively seeking the observation that would show you are wrong, rather than accumulating observations consistent with being right. Operationally: naming the disconfirming test before gathering evidence.",
    why: "Confirmation is the default and it is nearly free. The only reliable protection is deciding in advance what would change your mind, in writing.",
    bands: "strong/moderate/emerging",
    measure:
      "For each belief you test, did you specify a disconfirming observation in advance, and did you actually go and look for it? Wason-style rule-discovery items serve as a bench probe.",
    limits:
      "Naive falsificationism is not how science actually proceeds — theories survive disconfirming results for good reasons. Treat this as a personal discipline, not a philosophy of science.",
    cite: ["popper1959", "wason1968", "mayo1996"],
    retention: "meta",
    res: [
      ["The Logic of Scientific Discovery — Popper", "book"],
      ["Error and the Growth of Experimental Knowledge — Mayo", "book"],
      ["Reasoning about a rule — Wason (1968)", "paper"],
    ],
    ex: [
      e("State in writing what observation would change your mind about one current belief", 12, "daily", 2, "artifact", 10, [
        "Then go and look for it, and record what you found",
      ]),
      e("Take a favourite theory of yours and list its three strongest counterexamples", 18, "weekly", 3, "artifact", 20, [
        "Ask someone who disagrees with you to add a fourth",
      ]),
      e("Run a Wason-style rule-discovery probe and record whether you tested a disconfirming case", 12, "weekly", 3, "scored", 10, [
        "Repeat with a rule you generated yourself",
      ]),
    ],
  }),

  n("epi-experimental-design", "epistemic", "Experimental Design", 2, {
    kind: "competency",
    constructs: ["quantitative", "fluid-reasoning"],
    desc: "Constructing a comparison that can actually answer a question: controls, randomisation, sample size, pre-registered outcome, and the analysis decided before the data arrives.",
    why: "A badly designed experiment is worse than none, because it produces a number that feels like evidence.",
    bands: "strong/strong/moderate",
    measure:
      "Design an unseen study to a stated question and have the design critiqued for confounds, power and analytic flexibility — ideally by someone who did not help build it.",
    limits:
      "Design skill transfers reasonably well across domains, but power analysis and measurement validity remain domain-specific and are where most real designs fail.",
    cite: ["ioannidis2005", "nosek2015", "mayo1996", "mcelreath2020"],
    res: [
      ["Statistical Rethinking — McElreath", "book"],
      ["Estimating the Reproducibility of Psychological Science — OSC (2015)", "paper"],
      ["Trial and Error: A Preregistration Template (OSF)", "tool", "https://osf.io/prereg/"],
    ],
    ex: [
      e("Write a one-paragraph pre-registration for a question you care about: outcome, analysis, stopping rule", 20, "weekly", 3, "artifact", 25, [
        "Add a power estimate and the smallest effect you would care about",
      ]),
      e("Find the confound in a published design and state how you would remove it", 22, "weekly", 4, "artifact", 30, [
        "Then find the confound your fix introduces",
      ]),
      e("Design a within-subject version of an experiment you have only seen as between-subject", 24, "weekly", 5, "artifact", 35, [
        "State the order effects it creates and how you would counterbalance them",
      ]),
    ],
  }),

  n("epi-model-uncertainty", "epistemic", "Model Uncertainty", 2, {
    kind: "meta",
    constructs: ["fluid-reasoning", "quantitative"],
    desc: "Holding uncertainty about the model itself, not merely about parameters inside it — knowing where your framework stops applying, and what would be true if it were the wrong frame entirely.",
    why: "Most large errors are not wrong numbers in the right model; they are precise numbers in the wrong model.",
    bands: "moderate/emerging/emerging",
    measure:
      "State the domain of validity of a model you use, and predict where it will break. Then find a case at the boundary and check.",
    limits:
      "This is a genuinely hard capability with very little training literature. Neuron includes it because its absence is catastrophic, not because the evidence for training it is good.",
    cite: ["mayo1996", "kahneman2021", "mcelreath2020", "flyvbjerg2006"],
    retention: "meta",
    res: [
      ["Noise: A Flaw in Human Judgment — Kahneman, Sibony & Sunstein", "book"],
      ["The Black Swan — Nassim Taleb", "book"],
      ["Statistical Rethinking — McElreath", "book"],
    ],
    ex: [
      e("Name the domain of validity of one model you used today, and one case just outside it", 14, "daily", 3, "artifact", 12, [
        "Predict what the model would say there and why it would be wrong",
      ]),
      e("Analyse one question under two incompatible models and compare the answers", 24, "weekly", 4, "artifact", 30, [
        "State which observation would tell the two models apart",
      ]),
      e("Find a case where your usual framework failed and write what frame would have caught it", 22, "weekly", 5, "artifact", 30, [
        "Add the early warning sign you missed at the time",
      ]),
    ],
  }),

  // ══ Decision Intelligence ═══════════════════════════════════════════════
  n("dec-expected-value", "decision", "Expected Value", 0, {
    kind: "competency",
    constructs: ["quantitative", "fluid-reasoning"],
    desc: "Weighing outcomes by their probability rather than by their vividness, and doing the arithmetic explicitly enough that someone else could check it.",
    why: "The main benefit is not the number. It is that writing the terms down exposes which probability or payoff you were quietly refusing to state.",
    bands: "strong/strong/moderate",
    measure:
      "Write the EV calculation before deciding, then score the process against the outcome — separately, because a good decision can lose.",
    limits:
      "Expected value assumes your utility is linear in the units you chose, which it usually is not for large or irreversible stakes. Never apply it to ruin risk without a survival constraint.",
    cite: ["savage1954", "kahneman2011", "howard1966"],
    res: [
      ["Thinking in Bets — Annie Duke", "book"],
      ["The Foundations of Statistics — Savage", "paper"],
      ["Thinking, Fast and Slow — Kahneman", "book"],
    ],
    ex: [
      e("Write the expected-value terms for one decision you made today", 12, "daily", 2, "artifact", 10, [
        "Include the option you rejected without calculating",
      ]),
      e("Find a decision where the EV-maximising choice is the one you would not take, and say why", 18, "weekly", 3, "artifact", 20, [
        "Decide whether the reason is a real constraint or an unstated preference",
      ]),
      e("Re-run one past decision's EV with the probabilities you now know were right", 20, "weekly", 4, "artifact", 25, [
        "Separate the estimate error from the outcome luck",
      ]),
    ],
  }),

  n("dec-opportunity-cost", "decision", "Opportunity Cost", 0, {
    kind: "competency",
    constructs: ["quantitative", "executive-control"],
    desc: "Pricing a choice by the best alternative it displaces rather than by its own merits in isolation. The operative discipline is naming the specific alternative, not gesturing at 'other things'.",
    why: "Every yes is a no to something unstated. Making the displaced option concrete is what turns a plausible commitment into a comparable one.",
    bands: "strong/strong/moderate",
    measure:
      "For each significant commitment, is the displaced alternative named specifically and in advance? Later, was it a better use of the same resource?",
    limits:
      "People systematically under-generate alternatives, so the named alternative is often not the best one. Opportunity-cost reasoning improves comparisons; it does not fix a poor option set.",
    cite: ["kahneman2011", "howard1966", "rumelt2011"],
    res: [
      ["Good Strategy / Bad Strategy — Rumelt", "book"],
      ["Thinking, Fast and Slow — Kahneman", "book"],
      ["Essentialism — Greg McKeown", "book"],
    ],
    ex: [
      e("Name the specific thing you are not doing because of today's largest commitment", 10, "daily", 1, "artifact", 8, [
        "Name three, and rank them against what you chose",
      ]),
      e("Price one recurring commitment in hours per year and state what else that would buy", 16, "weekly", 3, "artifact", 20, [
        "Then either renegotiate it or accept it explicitly in writing",
      ]),
      e("List the options you did not generate for a decision you already made", 18, "weekly", 3, "artifact", 20, [
        "Ask someone else to add two you would not have thought of",
      ]),
    ],
  }),

  n("dec-calibration", "decision", "Decision Calibration", 1, {
    kind: "competency",
    constructs: ["quantitative", "executive-control"],
    desc: "Making your stated confidence match your actual hit rate: when you say 70%, you are right about 70% of the time. Measured by scoring rules over many predictions, never by one.",
    why: "Calibration is one of the very few cognitive properties that is objectively measurable at the individual level, improvable with feedback, and directly useful.",
    bands: "strong/strong/moderate",
    measure:
      "Brier score and a calibration curve over your resolved predictions, decomposed into calibration and resolution so that hedging everything at 50% does not look like skill.",
    limits:
      "Calibration is domain-specific and needs volume: fewer than about thirty resolved predictions tells you almost nothing. Being well calibrated is not the same as being knowledgeable.",
    cite: ["brier1950", "lichtenstein1982", "tetlock2015", "mellers2014"],
    res: [
      ["Superforecasting — Tetlock & Gardner", "book"],
      ["Calibration of Probabilities — Lichtenstein, Fischhoff & Phillips (1982)", "paper"],
      ["Good Judgment Open", "tool", "https://www.gjopen.com/"],
    ],
    ex: [
      e("Make three dated predictions with explicit probabilities", 12, "daily", 2, "scored", 10, [
        "Make them about things you would rather not be wrong about",
      ]),
      e("Resolve every prediction that came due and update your Brier score", 14, "weekly", 2, "scored", 15, [
        "Plot the calibration curve and find your systematic direction of error",
      ]),
      e("Give a 90% confidence interval for ten unknown quantities and check the hit rate", 20, "weekly", 3, "scored", 20, [
        "Repeat until roughly nine of ten intervals actually contain the answer",
      ]),
    ],
  }),

  n("dec-journal", "decision", "Decision Journaling", 1, {
    kind: "meta",
    constructs: ["executive-control", "learning-retrieval"],
    desc: "Recording, at the moment of choosing, what you decided, what you expected, and what would tell you it was wrong — so that later review compares against the record rather than against memory.",
    why: "Hindsight rewrites your prior beliefs silently and completely. Without a contemporaneous record you cannot learn from your own decisions at all.",
    bands: "moderate/strong/moderate",
    measure:
      "Share of significant decisions with a contemporaneous entry, and the gap between the expectation you recorded and what you later remember expecting.",
    limits:
      "The habit is well argued and thinly evidenced. Its main established mechanism — defeating hindsight bias — is solid; broader claims about decision quality are not.",
    cite: ["kahneman2021", "kahneman2011", "schoen2013"],
    retention: "meta",
    res: [
      ["Thinking in Bets — Annie Duke", "book"],
      ["Noise — Kahneman, Sibony & Sunstein", "book"],
      ["Neuron's own journal, with a decision template", "practice"],
    ],
    ex: [
      e("Write one decision entry: the choice, the expectation, and the disconfirmer", 12, "daily", 2, "artifact", 10, [
        "Add your confidence as a number",
      ]),
      e("Review a decision entry that has now resolved and score the reasoning, not the outcome", 18, "weekly", 3, "artifact", 20, [
        "Note where your remembered expectation differed from the written one",
      ]),
      e("Audit a month of entries for a repeated reasoning error", 24, "weekly", 4, "artifact", 30, [
        "Write the checklist item that would have caught it",
      ]),
    ],
  }),

  n("dec-value-of-information", "decision", "Value of Information", 2, {
    kind: "competency",
    constructs: ["quantitative", "fluid-reasoning"],
    desc: "Deciding whether more information is worth its cost — which requires knowing whether the information could actually change the decision. Information that cannot change your action has zero value regardless of how interesting it is.",
    why: "Most over-research is spent on questions whose answers would not change anything. Asking 'what would I do differently?' first eliminates the majority of it.",
    bands: "strong/moderate/emerging",
    measure:
      "Before investigating, state which answer would change your action and by how much; afterwards, check whether it did.",
    limits:
      "Formal value-of-information analysis is well founded but demanding. The informal version is trainable; the quantitative version rarely survives contact with real uncertainty.",
    cite: ["howard1966", "savage1954", "tetlock2015"],
    res: [
      ["Information Value Theory — Howard (1966)", "paper"],
      ["How to Measure Anything — Douglas Hubbard", "book"],
      ["Thinking in Bets — Annie Duke", "book"],
    ],
    ex: [
      e("Before your next piece of research, write which finding would change your decision", 14, "daily", 3, "artifact", 10, [
        "Abandon the research if no finding would",
      ]),
      e("Find a question you researched at length that could not have changed your action", 18, "weekly", 3, "artifact", 20, [
        "Estimate the hours it cost",
      ]),
      e("Put a price on one piece of information and decide whether to buy it", 22, "weekly", 4, "artifact", 25, [
        "Compute the decision-relevant range rather than a point value",
      ]),
    ],
  }),

  n("dec-reversibility", "decision", "Reversibility & Optionality", 2, {
    kind: "meta",
    constructs: ["executive-control", "fluid-reasoning"],
    desc: "Classifying decisions by how expensive they are to undo, and spending deliberation in proportion. Reversible choices deserve speed; irreversible ones deserve the slow path and a survival constraint.",
    why: "Treating every decision as equally weighty is exhausting and slow; treating them as equally light is how people walk into unrecoverable positions.",
    bands: "moderate/moderate/emerging",
    measure:
      "Classify decisions before making them and check afterwards: were the ones you called reversible actually reversed cheaply when they went wrong?",
    limits:
      "The reversible/irreversible split is a useful heuristic with essentially no controlled evidence. People also systematically underestimate the cost of unwinding decisions they made quickly.",
    cite: ["flyvbjerg2006", "kahneman2021", "rumelt2011"],
    retention: "meta",
    res: [
      ["Good Strategy / Bad Strategy — Rumelt", "book"],
      ["Antifragile — Nassim Taleb", "book"],
      ["From Nobel Prize to Project Management — Flyvbjerg (2006)", "paper"],
    ],
    ex: [
      e("Label today's decisions reversible or not, and match your deliberation time to the label", 12, "daily", 2, "artifact", 10, [
        "Estimate the cost of unwinding each, in time and money",
      ]),
      e("Find a decision you treated as reversible that was not", 18, "weekly", 3, "artifact", 20, [
        "Write what signal would have told you at the time",
      ]),
      e("Restructure one upcoming irreversible commitment to preserve an option", 24, "weekly", 4, "artifact", 30, [
        "Price the option you bought and decide whether it was worth it",
      ]),
    ],
  }),

  // ══ Creative Cognition ══════════════════════════════════════════════════
  n("cre-divergent", "creative", "Divergent Generation", 0, {
    kind: "competency",
    constructs: ["fluid-reasoning"],
    desc: "Producing many genuinely distinct options rather than variations on the first one. The measurable part is not fluency but distance: how different are options five through twenty from option one.",
    why: "Option sets are almost always too small, and the first idea anchors every subsequent one. Deliberate generation is the cheapest fix available.",
    bands: "moderate/strong/emerging",
    measure:
      "Count distinct categories represented in an option set, not raw idea count; have someone else judge whether the last five are really different from the first.",
    limits:
      "Divergent-thinking scores are trainable but their relationship to real creative achievement is modest, and creativity is substantially domain-specific. Group brainstorming reliably produces fewer ideas than the same people working alone.",
    cite: ["guilford1967", "runco2012", "baer2015", "diehl1987"],
    res: [
      ["The Standard Definition of Creativity — Runco & Jaeger (2012)", "paper"],
      ["Creative Cognition — Finke, Ward & Smith", "book"],
      ["Oblique Strategies — Eno & Schmidt", "tool"],
    ],
    ex: [
      e("Generate 20 options for a real problem before evaluating any of them", 14, "daily", 2, "artifact", 15, [
        "Require that no two share a category",
        "Generate 40 and keep the ten most distant",
      ]),
      e("Take your first idea and generate five that are its opposite in some dimension", 16, "weekly", 3, "artifact", 20, [
        "Name the dimension explicitly for each",
      ]),
      e("Generate options alone, then compare with a group's output on the same problem", 20, "weekly", 3, "artifact", 30, [
        "Count unique ideas per person in each condition",
      ]),
    ],
  }),

  n("cre-reframing", "creative", "Constraint Reframing", 1, {
    kind: "competency",
    constructs: ["fluid-reasoning"],
    desc: "Changing the problem statement rather than searching harder inside it: removing an assumed constraint, adding a binding one, or asking who else has this problem in a different form.",
    why: "A large share of hard problems are hard only under a constraint nobody chose deliberately and nobody has checked since.",
    bands: "moderate/moderate/emerging",
    measure:
      "State the problem three ways, then check whether the solution set genuinely changes between framings — if it does not, you restated rather than reframed.",
    limits:
      "Reframing is easy to perform and hard to verify. Without a downstream test it produces the pleasant sensation of insight without any change in outcome.",
    cite: ["finke1992", "polya1945", "runco2012"],
    res: [
      ["How to Solve It — Pólya", "book"],
      ["Conceptual Blockbusting — James Adams", "book"],
      ["Are You Solving the Right Problem? — Thomas Wedell-Wedellsborg (HBR)", "paper"],
    ],
    ex: [
      e("Restate one current problem three ways and note which constraints each assumes", 14, "daily", 3, "artifact", 15, [
        "Remove the constraint you assumed hardest and re-solve",
      ]),
      e("Find a constraint in your problem that nobody actually imposed", 18, "weekly", 3, "artifact", 20, [
        "Test whether removing it changes the answer",
      ]),
      e("Add an artificial hard constraint (a tenth of the budget, a day instead of a month) and solve anyway", 22, "weekly", 4, "artifact", 30, [
        "Keep whatever the constraint forced you to discover",
      ]),
    ],
  }),

  n("cre-combination", "creative", "Conceptual Combination", 1, {
    kind: "competency",
    constructs: ["fluid-reasoning", "crystallized-knowledge"],
    desc: "Deliberately joining two concepts and working out what the hybrid entails — the mechanism behind a large fraction of documented invention, and one of the few creative moves you can practise directly.",
    why: "Combination gives creativity a procedure. Instead of waiting for an idea, you pick two things you know and interrogate the intersection.",
    bands: "moderate/moderate/emerging",
    measure:
      "Produce a combination and state a non-obvious property that neither parent had; have a knowledgeable reader confirm it is non-obvious.",
    limits:
      "Most combinations are worthless, and combination fluency depends on how much you already know in both domains. This is a knowledge-limited skill wearing a creativity label.",
    cite: ["finke1992", "hofstadter2013", "baer2015"],
    res: [
      ["Creative Cognition — Finke, Ward & Smith", "book"],
      ["Surfaces and Essences — Hofstadter & Sander", "book"],
      ["The Act of Creation — Arthur Koestler", "book"],
    ],
    ex: [
      e("Combine two unrelated concepts from your day and name one emergent property", 12, "daily", 2, "artifact", 10, [
        "Require the property to be testable",
      ]),
      e("Import a mechanism from a field you do not work in into a problem you do", 20, "weekly", 3, "artifact", 25, [
        "Say precisely where the analogy breaks",
      ]),
      e("Take two of your own projects and design the thing that would only exist if both were true", 22, "weekly", 4, "artifact", 30, [
        "Build the smallest version of it",
      ]),
    ],
  }),

  n("cre-convergent", "creative", "Convergent Selection", 1, {
    kind: "competency",
    constructs: ["fluid-reasoning", "executive-control"],
    desc: "Killing options on stated criteria. Generation without selection produces a pile; selection is where taste, constraints and honesty about your own attachments actually operate.",
    why: "Most creative failure is not a shortage of ideas but an unwillingness to discard the one you thought of first.",
    bands: "moderate/moderate/emerging",
    measure:
      "Write the selection criteria before seeing the options, then check whether the winner actually scores highest — and whether you changed the criteria to make it win.",
    limits:
      "Selection quality is bounded by the quality of the criteria, which are usually implicit. Explicit criteria help, and they also create an illusion of objectivity.",
    cite: ["runco2012", "kahneman2021", "rumelt2011"],
    res: [
      ["Noise — Kahneman, Sibony & Sunstein", "book"],
      ["The Standard Definition of Creativity — Runco & Jaeger (2012)", "paper"],
      ["Creative Confidence — Kelley & Kelley", "book"],
    ],
    ex: [
      e("Write selection criteria before generating options, then score the options against them", 14, "daily", 3, "artifact", 15, [
        "Weight the criteria in advance too",
      ]),
      e("Kill your favourite option and defend the second-best in writing", 18, "weekly", 3, "artifact", 20, [
        "Then decide honestly which is better",
      ]),
      e("Score an option set blind — labels removed — and compare with your unblinded ranking", 22, "weekly", 4, "artifact", 25, [
        "Do it for work where you know which option is yours",
      ]),
    ],
  }),

  n("cre-iteration", "creative", "Iterative Experimentation", 2, {
    kind: "meta",
    constructs: ["executive-control", "fluid-reasoning"],
    desc: "Getting to a testable version fast and cycling, rather than perfecting in the abstract. The skill is choosing the smallest thing that produces real information, and actually looking at the result.",
    why: "Iteration converts opinion into evidence. Cycle count against elapsed time is the closest thing creative work has to a training metric.",
    bands: "moderate/strong/moderate",
    measure:
      "Cycles per week and time-to-first-feedback, alongside whether each cycle actually changed the next version.",
    limits:
      "Iteration works when feedback is fast and informative. Where feedback is slow, noisy or absent, rapid cycling produces motion rather than learning.",
    cite: ["schmidt2011", "hattie2007", "kluger1996"],
    retention: "meta",
    res: [
      ["The Lean Startup — Eric Ries", "book"],
      ["Art & Fear — Bayles & Orland", "book"],
      ["The Power of Feedback — Hattie & Timperley (2007)", "paper"],
    ],
    ex: [
      e("Ship one deliberately incomplete version today and record what the feedback taught you", 16, "daily", 3, "artifact", 20, [
        "Halve the size of the thing you ship",
      ]),
      e("Run three cycles on the same artefact in one week and log what changed each time", 22, "weekly", 3, "artifact", 40, [
        "Add an external reviewer to one of the cycles",
      ]),
      e("Find a project where you iterated without learning and say what feedback was missing", 20, "weekly", 4, "artifact", 25, [
        "Redesign the loop so the missing signal arrives",
      ]),
    ],
  }),

  // ══ Augmented Cognition ═════════════════════════════════════════════════
  n("aug-search", "augmented", "Search Strategy", 0, {
    kind: "augmentation",
    constructs: ["crystallized-knowledge", "executive-control"],
    desc: "Finding information deliberately: choosing the right corpus, constructing queries that discriminate, recognising when the answer will not be in a search engine, and knowing when to stop.",
    why: "The gap between competent and incompetent searchers on the same question is enormous and almost entirely procedural — which makes it one of the most trainable capabilities here.",
    bands: "moderate/strong/moderate",
    measure:
      "Time-to-answer and answer correctness on unseen research questions, with the search path recorded so the strategy can be inspected.",
    limits:
      "Search skill is tied to the tools available and ages as they change. It also cannot compensate for not knowing that a body of knowledge exists.",
    cite: ["wineburg2019", "risko2016", "sparrow2011"],
    res: [
      ["Google Scholar", "tool", "https://scholar.google.com/"],
      ["Civic Online Reasoning — Stanford History Education Group", "course", "https://cor.stanford.edu/"],
      ["Search operators reference (Google)", "tool", "https://support.google.com/websearch/answer/2466433"],
    ],
    ex: [
      e("Answer one question and record your full search path, including the dead ends", 12, "daily", 2, "artifact", 15, [
        "Set a time budget in advance and stop when it runs out",
      ]),
      e("Find the primary source behind a secondary claim", 18, "weekly", 3, "artifact", 20, [
        "Do it for a claim where the secondary source misrepresents the primary",
      ]),
      e("Answer the same question using three different corpora and compare what each missed", 20, "weekly", 4, "artifact", 30, [
        "Include one non-web corpus",
      ]),
    ],
  }),

  n("aug-decomposition", "augmented", "Problem Decomposition", 0, {
    kind: "meta",
    constructs: ["fluid-reasoning", "executive-control"],
    desc: "Breaking a problem into parts that can be solved and recombined, with the interfaces between parts made explicit. The hard part is choosing a decomposition whose pieces are genuinely independent.",
    why: "Decomposition is what makes a problem tractable for you, for a collaborator, and for a tool. A bad split creates more coordination work than it removes.",
    bands: "moderate/strong/moderate",
    measure:
      "Can each sub-problem be solved without knowing how the others were solved? Count the cross-part revisions you needed during execution.",
    limits:
      "Decomposition depends on domain knowledge — you cannot see the natural seams of a problem you do not understand. Generic decomposition training transfers weakly.",
    cite: ["polya1945", "newell1972", "vanmerrienboer2005"],
    retention: "meta",
    res: [
      ["How to Solve It — Pólya", "book"],
      ["Human Problem Solving — Newell & Simon", "book"],
      ["The Art of Insight in Science and Engineering — Mahajan", "book"],
    ],
    ex: [
      e("Decompose one task into parts and state the interface between each pair", 14, "daily", 2, "artifact", 15, [
        "Give each part a definition of done",
      ]),
      e("Find a decomposition of a problem you own where the parts leak into each other", 18, "weekly", 3, "artifact", 20, [
        "Re-cut it along a different seam and compare",
      ]),
      e("Decompose a problem so that someone else could do half of it without talking to you", 22, "weekly", 4, "artifact", 30, [
        "Actually hand it over and count the clarifying questions",
      ]),
    ],
  }),

  n("aug-ai-collaboration", "augmented", "AI Collaboration", 1, {
    kind: "augmentation",
    constructs: ["executive-control", "crystallized-knowledge"],
    desc: "Using a language model as a working partner: specifying the task, supplying the context that matters, recognising the jagged boundary where it stops being reliable, and verifying anything load-bearing.",
    why: "The capability that separates useful from harmful AI use is not prompting technique. It is knowing which parts of a task you are still responsible for judging.",
    bands: "emerging/moderate/emerging",
    measure:
      "Quality of the finished output judged without reference to how it was produced, plus your error-catch rate on deliberately flawed model output.",
    limits:
      "Evidence here is early and moves faster than the studies. The best-documented risk is overreliance: assistance improves output inside the frontier and degrades it outside, while confidence rises in both cases.",
    cite: ["dellacqua2023", "buccinca2021", "risko2016"],
    res: [
      ["Navigating the Jagged Technological Frontier — Dell'Acqua et al. (2023)", "paper"],
      ["To Trust or to Think — Buçinca, Malaya & Gajos (2021)", "paper"],
      ["Ollama (fully local models)", "tool", "https://ollama.com/"],
    ],
    ex: [
      e("Use a model for one task, then list the specific claims in its output you did not verify", 14, "daily", 3, "artifact", 15, [
        "Verify them, and record how many were wrong",
      ]),
      e("Do the same task twice — once unaided, once assisted — and compare the outputs blind", 22, "weekly", 4, "artifact", 40, [
        "Have someone else judge which is better without knowing which is which",
      ]),
      e("Find a task at the edge of the model's competence and document exactly where it fails", 20, "weekly", 4, "artifact", 30, [
        "Write the check that would have caught the failure automatically",
      ]),
    ],
  }),

  n("aug-external-cognition", "augmented", "External Cognition", 1, {
    kind: "augmentation",
    constructs: ["working-memory", "executive-control"],
    desc: "Deliberately moving cognitive load out of your head and into the environment — notation, diagrams, checklists, scratch space — so that working memory is spent on the part that actually needs it.",
    why: "Working memory is a hard limit that does not respond to training. Offloading is the one intervention that reliably raises effective capacity.",
    bands: "strong/strong/moderate",
    measure:
      "Error rate and completion time on a complex task with and without external support, at matched difficulty.",
    limits:
      "Offloading reduces what you remember internally — the well-documented Google effect. Offload what you do not need to hold, and be deliberate about what you deliberately memorise.",
    cite: ["risko2016", "sparrow2011", "clark1998", "gawande2009"],
    res: [
      ["Cognitive Offloading — Risko & Gilbert (2016)", "paper"],
      ["The Checklist Manifesto — Gawande", "book"],
      ["The Extended Mind — Clark & Chalmers (1998)", "paper"],
    ],
    ex: [
      e("Externalise one task you normally hold in your head and record the error difference", 12, "daily", 2, "artifact", 10, [
        "Measure completion time as well",
      ]),
      e("Build a checklist for a task you have got wrong before", 18, "weekly", 3, "artifact", 20, [
        "Use it five times and revise it from the failures",
      ]),
      e("Design a notation for a problem you keep re-deriving", 22, "weekly", 4, "artifact", 30, [
        "Give it to someone else and see if they can use it",
      ]),
    ],
  }),

  n("aug-verification", "augmented", "Verification & Tool Skepticism", 2, {
    kind: "augmentation",
    constructs: ["executive-control", "fluid-reasoning"],
    desc: "Treating tool output as a claim requiring proportional checking: knowing which outputs are load-bearing, what an independent check would look like, and resisting the fluency of a confident answer.",
    why: "Tools fail quietly and plausibly. The cost of a wrong answer you did not check scales with how much you trusted it, which is exactly backwards from how checking effort is usually allocated.",
    bands: "moderate/moderate/emerging",
    measure:
      "Detection rate on deliberately seeded errors in tool output, and whether your checking effort tracked the stakes rather than your suspicion.",
    limits:
      "Cognitive forcing functions reduce overreliance in controlled studies but cost time and are unpopular with the people using them. Sustained skepticism is expensive and fades.",
    cite: ["buccinca2021", "dellacqua2023", "gawande2009", "graber2012"],
    res: [
      ["To Trust or to Think — Buçinca, Malaya & Gajos (2021)", "paper"],
      ["The Checklist Manifesto — Gawande", "book"],
      ["Cognitive interventions to reduce diagnostic error — Graber et al. (2012)", "paper"],
    ],
    ex: [
      e("Pick the single most load-bearing claim in today's tool output and verify it independently", 14, "daily", 3, "artifact", 15, [
        "Verify it from a source that does not share the tool's inputs",
      ]),
      e("Seed an error into your own workflow's output and see whether your process catches it", 22, "weekly", 4, "artifact", 30, [
        "Seed three errors of different severity",
      ]),
      e("Write the verification policy for one tool: what you check, what you accept, and why", 20, "weekly", 4, "artifact", 25, [
        "Test the policy against a case where it would be expensive to follow",
      ]),
    ],
  }),

  // ══ Learning Control ════════════════════════════════════════════════════
  n("lrn-difficulty", "learning", "Difficulty Calibration", 0, {
    kind: "meta",
    constructs: ["learning-retrieval", "executive-control"],
    desc: "Choosing practice that sits at the edge of your ability — roughly where you fail often enough to learn but not so often that you cannot recover. Includes tolerating the discomfort that signals it.",
    why: "Difficulty selection determines the return on every hour of practice. Most self-directed practice sits far too easy because easy practice feels productive.",
    bands: "strong/moderate/moderate",
    measure:
      "Success rate at your chosen difficulty. Sustained accuracy well above about 85% means you are training too easy; chronic accuracy below about 50% means the task is not teaching.",
    limits:
      "The optimal difficulty band is task-dependent and has no single universal value. Desirable difficulties reliably depress performance during practice, which makes adherence the real obstacle.",
    cite: ["bjork1994", "soderstrom2015", "kornell2007"],
    retention: "meta",
    res: [
      ["Memory and Metamemory Considerations — Bjork (1994)", "paper"],
      ["Learning versus Performance — Soderstrom & Bjork (2015)", "paper"],
      ["Peak — Ericsson & Pool", "book"],
    ],
    ex: [
      e("Record your success rate on today's practice and adjust difficulty if it is above 85%", 12, "daily", 2, "scored", 10, [
        "Adjust after every session, not weekly",
      ]),
      e("Deliberately train at a difficulty where you fail about a third of the time", 16, "daily", 3, "self-report", 25, [
        "Sustain it for a full week and log how it felt versus what it produced",
      ]),
      e("Find a practice you have done for months without failing and raise its difficulty", 18, "weekly", 3, "artifact", 20, [
        "Raise it until failure returns, then back off one step",
      ]),
    ],
  }),

  n("lrn-feedback", "learning", "Feedback Integration", 1, {
    kind: "meta",
    constructs: ["learning-retrieval", "socio-emotional"],
    desc: "Converting feedback into a changed next attempt. The bottleneck is rarely receiving it — it is translating a comment into a specific behavioural difference and then actually making it.",
    why: "Feedback that does not change the next repetition is entertainment. The translation step is the skill.",
    bands: "strong/moderate/moderate",
    measure:
      "For each piece of feedback: was a specific change named, was it made, and did the next attempt differ measurably?",
    limits:
      "Roughly a third of feedback interventions make performance worse, particularly when feedback targets the self rather than the task. More feedback is not automatically better.",
    cite: ["kluger1996", "hattie2007", "hattie2016"],
    retention: "meta",
    res: [
      ["The Effects of Feedback Interventions on Performance — Kluger & DeNisi (1996)", "paper"],
      ["Thanks for the Feedback — Stone & Heen", "book"],
      ["The Power of Feedback — Hattie & Timperley (2007)", "paper"],
    ],
    ex: [
      e("Take one piece of feedback and write the specific behavioural change it implies", 12, "daily", 2, "artifact", 10, [
        "Then make the change in the next attempt and record the difference",
      ]),
      e("Ask for feedback on one specific dimension rather than in general", 16, "weekly", 3, "artifact", 15, [
        "Ask for the thing you least want to hear about",
      ]),
      e("Review a month of feedback and find the one you have received repeatedly and never acted on", 22, "weekly", 4, "artifact", 25, [
        "Act on it and record what made it hard",
      ]),
    ],
  }),

  n("lrn-practice-design", "learning", "Practice Design", 1, {
    kind: "meta",
    constructs: ["learning-retrieval", "executive-control"],
    desc: "Designing the session itself: what to isolate, in what order, spaced how, with what feedback and what retention check. Practice design is the difference between hours logged and skill acquired.",
    why: "Most people's practice is an inherited routine nobody examined. Designing it deliberately is a compounding advantage across every other node here.",
    bands: "strong/strong/moderate",
    measure:
      "Retention and transfer tested at least a day after the session — never in-session performance, which is systematically misleading.",
    limits:
      "The principles (spacing, interleaving, retrieval, variability) are well supported in aggregate; the optimal parameters for your specific skill are not known and must be found empirically.",
    cite: ["ericsson1993", "dunlosky2013", "soderstrom2015", "rohrer2015"],
    retention: "meta",
    res: [
      ["Make It Stick — Brown, Roediger & McDaniel", "book"],
      ["Improving Students' Learning With Effective Learning Techniques — Dunlosky et al. (2013)", "paper"],
      ["Peak — Ericsson & Pool", "book"],
    ],
    ex: [
      e("Design one session in advance: isolate, order, spacing, feedback, retention check", 16, "daily", 3, "artifact", 20, [
        "Include an interleaved block and a delayed test",
      ]),
      e("Convert a re-reading habit into a retrieval-based one and compare a delayed test", 20, "weekly", 3, "scored", 30, [
        "Run it for three weeks before judging",
      ]),
      e("Redesign your weakest recurring practice from scratch", 24, "weekly", 4, "artifact", 35, [
        "Justify each design choice against a named principle",
      ]),
    ],
  }),

  n("lrn-error-classification", "learning", "Error Classification", 1, {
    kind: "meta",
    constructs: ["learning-retrieval", "executive-control"],
    desc: "Sorting your mistakes by cause — missing knowledge, wrong procedure, attention lapse, misread problem, or a genuine gap in understanding — because each demands a completely different fix.",
    why: "Undiagnosed errors get the default treatment: more repetitions. That fixes one error class and wastes time on the other four.",
    bands: "moderate/strong/moderate",
    measure:
      "Whether the fix you applied actually eliminated that error class, checked on the next set of attempts rather than assumed.",
    limits:
      "Self-diagnosis of error cause is unreliable, particularly for understanding gaps, which tend to be misclassified as carelessness. External review substantially improves classification accuracy.",
    cite: ["graber2012", "hattie2016", "metcalfe2009"],
    retention: "meta",
    res: [
      ["Black Box Thinking — Matthew Syed", "book"],
      ["Metacognitive judgments and control of study — Metcalfe & Finn (2009)", "paper"],
      ["A personal error log, one line per mistake", "practice"],
    ],
    ex: [
      e("Classify every error from today's practice into knowledge, procedure, attention, or reading", 14, "daily", 2, "artifact", 12, [
        "Assign a distinct fix to each class",
      ]),
      e("Take the error class you make most and design a fix aimed only at that cause", 20, "weekly", 3, "artifact", 25, [
        "Check on the next set of attempts whether it worked",
      ]),
      e("Have someone else classify your errors and compare with your own classification", 22, "weekly", 4, "artifact", 25, [
        "Note which class you systematically under-report",
      ]),
    ],
  }),

  n("lrn-strategy-selection", "learning", "Strategy Selection", 2, {
    kind: "meta",
    constructs: ["learning-retrieval", "executive-control"],
    desc: "Choosing the right learning strategy for the material at hand — and noticing when the one you are using has stopped working — rather than applying a single favourite technique to everything.",
    why: "Strategy fit matters more than strategy quality. Spaced retrieval is excellent for facts and a poor fit for a motor skill or an unfamiliar proof.",
    bands: "moderate/moderate/emerging",
    measure:
      "Track which strategy you chose, for what material, and what the delayed retention was. Over time the pattern is the measurement.",
    limits:
      "Learners are poor judges of which strategy is working, systematically preferring the one that feels fluent. Without delayed testing this node trains preference, not selection.",
    cite: ["kornell2007", "hattie2016", "dunlosky2013", "soderstrom2015"],
    retention: "meta",
    res: [
      ["The promise and perils of self-regulated study — Kornell & Bjork (2007)", "paper"],
      ["Learning Strategies: A Synthesis and Conceptual Model — Hattie & Donoghue (2016)", "paper"],
      ["Make It Stick — Brown, Roediger & McDaniel", "book"],
    ],
    ex: [
      e("Name the strategy you are using and why it fits this specific material", 12, "daily", 3, "artifact", 10, [
        "Name the strategy you rejected and why",
      ]),
      e("Run the same material through two strategies and compare delayed retention", 22, "weekly", 4, "scored", 35, [
        "Test after a week rather than a day",
      ]),
      e("Find a strategy you use by habit that does not fit its material and replace it", 20, "weekly", 4, "artifact", 25, [
        "Track the switch's effect for a month",
      ]),
    ],
  }),

  // ══ Long-Horizon Cognition ══════════════════════════════════════════════
  n("str-goal-decomposition", "strategic", "Goal Decomposition", 0, {
    kind: "meta",
    constructs: ["executive-control", "fluid-reasoning"],
    desc: "Turning a distant outcome into the nearest action that provably advances it, through a chain where each level is checkable. Distinct from planning: this is about the vertical chain from outcome to action, not the horizontal order of steps.",
    why: "Goals fail at the level where 'become a better writer' meets Tuesday morning. Decomposition is what makes the abstraction actionable and, crucially, falsifiable.",
    bands: "moderate/strong/moderate",
    measure:
      "Can you name today's action and trace it upward to the outcome without a gap? Check monthly whether the completed actions moved any measurable outcome.",
    limits:
      "Decomposition assumes the path is knowable in advance. For genuinely novel goals the chain is a hypothesis, and treating it as a plan produces confident motion in a wrong direction.",
    cite: ["locke2002", "gollwitzer1999", "rumelt2011"],
    retention: "meta",
    res: [
      ["Building a Practically Useful Theory of Goal Setting — Locke & Latham (2002)", "paper"],
      ["Good Strategy / Bad Strategy — Rumelt", "book"],
      ["Measure What Matters — John Doerr", "book"],
    ],
    ex: [
      e("Take one long-term goal and write the chain down to a single action you can do today", 14, "daily", 2, "artifact", 15, [
        "Make every level in the chain checkable",
      ]),
      e("Find the level in an existing goal chain where the logic breaks", 18, "weekly", 3, "artifact", 20, [
        "Repair it or abandon the goal explicitly",
      ]),
      e("Review a month of completed actions and check whether the outcome actually moved", 22, "weekly", 4, "artifact", 30, [
        "If it did not, revise the chain rather than working harder",
      ]),
    ],
  }),

  n("str-prioritization", "strategic", "Prioritization", 0, {
    kind: "meta",
    constructs: ["executive-control", "quantitative"],
    desc: "Ordering commitments by expected contribution under a real constraint, and saying no to the rest explicitly rather than by neglect.",
    why: "An unordered list of good things is not a plan. Priority only exists where something was actually dropped.",
    bands: "moderate/strong/moderate",
    measure:
      "Did the top-ranked item actually receive the most attention this week? Compare your stated ranking against your calendar.",
    limits:
      "Prioritisation frameworks proliferate and none has good comparative evidence. The measurable part is the gap between stated and enacted priority, which is worth tracking regardless of framework.",
    cite: ["rumelt2011", "locke2002", "kahneman2021"],
    retention: "meta",
    res: [
      ["Good Strategy / Bad Strategy — Rumelt", "book"],
      ["Essentialism — Greg McKeown", "book"],
      ["Your own calendar, reviewed against your stated priorities", "practice"],
    ],
    ex: [
      e("Rank today's commitments and name the one you are explicitly dropping", 10, "daily", 1, "artifact", 8, [
        "Tell whoever is affected that you dropped it",
      ]),
      e("Compare last week's stated priority against where the hours actually went", 16, "weekly", 3, "artifact", 20, [
        "Identify the recurring commitment that keeps winning without being chosen",
      ]),
      e("Cut one standing commitment entirely and record what happened", 22, "weekly", 4, "artifact", 25, [
        "Cut the one you are most afraid to cut",
      ]),
    ],
  }),

  n("str-scenario-planning", "strategic", "Scenario Planning", 1, {
    kind: "competency",
    constructs: ["fluid-reasoning", "crystallized-knowledge"],
    desc: "Building several internally consistent futures rather than one forecast, then identifying the decisions that hold up across all of them and the signals that would tell you which world you are in.",
    why: "Point forecasts of complex systems are usually wrong. Scenario sets convert unpredictability into a decision structure instead of a prediction problem.",
    bands: "moderate/moderate/emerging",
    measure:
      "Did the realised future fall inside your scenario set, and did the early indicators you named actually fire before it became obvious?",
    limits:
      "Scenario planning has a long practitioner track record and little controlled evidence. It reliably broadens the option set; whether it improves decisions is not established.",
    cite: ["fischer2019", "tetlock2015", "flyvbjerg2006"],
    res: [
      ["Scenarios: The Art of Strategic Conversation — van der Heijden", "book"],
      ["Superforecasting — Tetlock & Gardner", "book"],
      ["The Art of the Long View — Peter Schwartz", "book"],
    ],
    ex: [
      e("Write three distinct scenarios for one uncertainty you face", 18, "weekly", 3, "artifact", 25, [
        "Require that each is internally consistent and none is a straw man",
      ]),
      e("Name the decision that is right across all three scenarios", 16, "weekly", 3, "artifact", 15, [
        "Name the one that is right in only one, and its cost if wrong",
      ]),
      e("Define the early indicators that would tell you which scenario is materialising", 22, "weekly", 4, "artifact", 25, [
        "Check them monthly and record which fired",
      ]),
    ],
  }),

  n("str-resource-allocation", "strategic", "Resource Allocation", 1, {
    kind: "meta",
    constructs: ["quantitative", "executive-control"],
    desc: "Distributing time, attention and money across competing uses over a horizon longer than the current week, including the willingness to stop funding something that is not working.",
    why: "Allocation, not effort, determines what a year produces. The hardest part is withdrawal from commitments that are merely acceptable.",
    bands: "moderate/moderate/emerging",
    measure:
      "Planned versus actual allocation across categories, reviewed monthly, together with what you actually stopped funding.",
    limits:
      "Personal allocation research is thin and largely borrowed from organisational finance. Sunk-cost effects are well documented and are the main failure mode here.",
    cite: ["rumelt2011", "kahneman2011", "flyvbjerg2006"],
    retention: "meta",
    res: [
      ["Good Strategy / Bad Strategy — Rumelt", "book"],
      ["Thinking, Fast and Slow — Kahneman", "book"],
      ["A time-tracking log, reviewed monthly", "practice"],
    ],
    ex: [
      e("Write your intended allocation of this week's discretionary hours before the week starts", 14, "weekly", 2, "artifact", 15, [
        "Compare it with the actual at week's end",
      ]),
      e("Stop funding one activity that is not producing and reallocate the time explicitly", 20, "weekly", 4, "artifact", 20, [
        "Choose one you have already invested heavily in",
      ]),
      e("Review a quarter's allocation against outcomes and rebalance", 24, "weekly", 4, "artifact", 40, [
        "State what evidence would make you rebalance again",
      ]),
    ],
  }),

  n("str-strategy", "strategic", "Strategic Thinking", 2, {
    kind: "competency",
    constructs: ["fluid-reasoning", "crystallized-knowledge"],
    desc: "Diagnosing a situation, choosing a guiding approach, and committing coherent actions to it — including what you will not do. Strategy is a diagnosis plus a choice, not a list of aspirations.",
    why: "Most things called strategy are goals with adjectives. The diagnosis is the part that does the work and the part that is usually skipped.",
    bands: "moderate/moderate/emerging",
    measure:
      "Can a reader state your diagnosis, your guiding policy and your coherent actions from the document alone — and identify what you ruled out?",
    limits:
      "Strategy quality is judged largely retrospectively, and successful strategies are indistinguishable from lucky ones without a counterfactual. Treat measurement here as weak.",
    cite: ["rumelt2011", "meadows2008", "flyvbjerg2006", "kahneman2021"],
    res: [
      ["Good Strategy / Bad Strategy — Rumelt", "book"],
      ["Thinking in Systems — Meadows", "book"],
      ["Playing to Win — Lafley & Martin", "book"],
    ],
    ex: [
      e("Write the diagnosis for a situation you face before proposing any action", 18, "weekly", 3, "artifact", 25, [
        "Have someone else read only the diagnosis and predict your action",
      ]),
      e("State the guiding policy and the three things it rules out", 20, "weekly", 4, "artifact", 25, [
        "Check whether your last month's actions were consistent with it",
      ]),
      e("Find a strategy document (yours or public) that is really a goal list, and rewrite it", 24, "weekly", 5, "artifact", 40, [
        "Include the diagnosis its author avoided making",
      ]),
    ],
  }),
];

export { e as exercise, n as node };
