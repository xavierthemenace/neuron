# Neuron

A local-first cognitive operating system: a map of 139 trainable capabilities,
an honest record of what you can actually demonstrate, and a planner that
decides what to train next and tells you why.

It is built to answer four questions well.

**What can I do?** — Every capability carries four separate numbers: practice,
competence, retention, and how much the competence figure deserves to be
believed. They are allowed to disagree, and when they do, that is the
information.

**What should I train next?** — Tell it how long you have and what state you
are in. It fits a session to that, weighted by what is decaying, what gates the
most, what you are weakest at, and what you have neglected.

**Why that?** — Every recommendation shows the weighted factors that produced
it. The displayed score is the sum of the displayed factors; there is a test
that says so.

**Is any of this working?** — Eleven diagnostic probes and a calibration record
with Brier scoring. Results are compared only to your own history, and only when
the change clears the noise floor for that item count.

---

## What it is not

It is not a brain-training app, and it will keep saying so at the points where
that matters. There is no credible evidence that practising here raises general
intelligence, and the curriculum states this per node — `gwm-span` says outright
that working-memory span training moves the trained task and almost nothing
else, with the meta-analyses cited.

No streaks. No manufactured urgency. No metric that improves by clicking rather
than by improving.

---

## Run it

```bash
npm install
npm run dev
```

Everything is local. No account, no server, no telemetry. Your practice log,
journals and attachments live in IndexedDB on your device and leave it only when
you export them — or when you explicitly consent, per category, to sending
something to an AI endpoint you configured.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run check:data     # curriculum schema, integrity, prerequisite cycles
npm test               # 159 pure-logic unit tests
npm run build
npx playwright test    # 79 browser tests (npx playwright install chromium first)
```

---

## How it works

### The curriculum is data, and it is validated like code

`data/intelligenceData.json` holds 139 nodes across 23 categories with 280
edges. `npm run check:data` rejects an incomplete node, an invalid vocabulary, a
dangling edge, a prerequisite cycle, a semantic edge with no stated mechanism,
an evidence band stronger than its pillars allow, or growth past the 140-node
ceiling.

Every node declares:

- **What kind of construct it is** — ability, meta-skill, competency, knowledge,
  physiological enabler, social-emotional skill, augmentation skill. These are
  measured differently and decay differently.
- **Its scientific classification** — CHC broad abilities, with the two
  non-CHC buckets flagged rather than quietly presented as equivalent.
- **Three separate evidence claims** — that the construct exists and can be
  measured, that practice moves it, and that the improvement generalises.
  Conflating these is how brain training is sold.
- **How it would be measured**, including where it cannot be.
- **What training it will not do.** Never empty.
- **Real citations**, several of which are the negative result for that node.

### The learner model

`lib/` is pure TypeScript with no React and no DOM, imported directly by the
Node test runner.

| Module | What it does |
|---|---|
| `retention.ts` | Six retention models. FSRS-style stability for knowledge, fluency decay for procedural skill, recency for habits, detraining for physical capability, demonstration recency for social skill, application frequency for meta-skills. |
| `competence.ts` | Estimates ability from observations that could have gone badly, weighted by evidence kind, difficulty and recency. Confidence is capped by how measurable the construct is. |
| `difficulty.ts` | Adaptive difficulty targeting a 45–85% success band, replayed from the log. Grinding an easier framing cannot promote you. |
| `diagnostics.ts` | Eleven probes, generated per run where that is defensible. |
| `predictions.ts` | Brier score with Murphy's decomposition, so hedging at the base rate cannot look like skill. |
| `workout.ts` | Constraint-based session planning with fourteen weighted factors. |
| `graph-intel.ts` | Bottlenecks, prerequisite gaps, isolated strengths, unproven practice, cluster imbalance — each with its numbers. |
| `goals.ts` | Plain language to curated paths, topological plan ordering. |
| `inbox.ts` | What is actually going stale, ranked, capped per kind. |
| `migrations.ts` | Renames, merges and splits as declared data. Never deletes a log. |

### The product loop

```
goal → relevant subgraph → baseline → plan → session → practice
  → evidence → updated competence → review → revised plan
```

Paths illuminate subsets of the same graph rather than duplicating it. Missions
force several capabilities to interact on one real problem and require written
work at each step. Capstones ask for an artifact someone else could inspect.

### Personal layer

Personal nodes train, decay, plan and export exactly like core nodes. Skill
packs let specialised expertise anchor into the core without enlarging it, under
a validated third-party schema. The journal supports `[[links]]`, backlinks,
tags, templates and five line markers, any of which converts into a dated
prediction or a capability.

### Stack

Next.js 16 App Router, React 19, TypeScript, React Flow, IndexedDB, Tailwind 4,
dark OKLCH palette, offline-first PWA. No state library, no UI kit, no
analytics.

---

## Design commitments

These are constraints, not preferences. `CONTRIBUTING.md` has the full version.

1. **Practice is not competence.** XP is a progression signal and is labelled as
   one.
2. **Uncertainty is visible.** "Confidence: Low — 2 observations" is a feature.
3. **Everything explains itself.** Explanations are generated from the same
   values that made the decision.
4. **Nothing overclaims.** *"This trains X."* *"Performance improved on Y."*
   *"Transfer is uncertain."* Never *"this makes you smarter."*
5. **Local-first.** No account required, ever. Cloud sync, if it ever exists,
   is opt-in and end-to-end encrypted.
6. **Data is portable and never lost.** Full backup including journals and
   attachments; reset exports first; migrations rewrite references rather than
   deleting history.
7. **Usable without the map.** The full graph is browsable, searchable and
   operable from the keyboard alone.

---

## Documentation

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to contribute, and the bar for
  curriculum changes
- [`docs/architecture.md`](docs/architecture.md) — the decisions behind the
  parts that would otherwise look arbitrary
- [`CHANGELOG.md`](CHANGELOG.md) — app and curriculum versions, tracked
  separately
- [`docs/roadmap.md`](docs/roadmap.md) — what is next, and what is deliberately
  not

## Licence

MIT. The curriculum content is part of the repository and carries the same
licence; if you use it, attribution is appreciated and honesty about its limits
is required.
