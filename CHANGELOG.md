# Changelog

Application versions and curriculum versions move independently. The curriculum
has its own semantic version in `data/intelligenceData.json`, because the
ontology changing is a different kind of event from the app changing, and users
need to know which one happened.

## Unreleased

### Added

- **A static build.** `npm run build:static` writes `out/`, a plain folder any
  static host will serve. Nothing in the app needs a server, so the deployable
  artefact should not need one either. `next start` still works for the browser
  suite.
- **Backup, restore, reset and offline are now tested by doing them.** A browser
  test exports a real file, resets, re-imports that file from disk and checks
  the record came back; another goes offline, reloads, and asserts the app still
  opens from the service worker cache.
- **Text contrast is checked by the unit tests.** Eleven pairs, read out of
  `globals.css`, each against the surface it actually sits on. Three colours
  were below 4.5:1 after the move to paper and have been darkened: muted text,
  captions, and white on the action colour.

- **An example profile.** Six months of generated history — logs across fifteen
  capabilities, seven diagnostic runs, twenty-four resolved predictions, a
  concluded experiment and an underpowered one, a finished mission and an
  abandoned one. Offered during onboarding and from the Data menu. It is
  deliberately unflattering: two clusters trained properly, several dropped
  halfway, a holiday in the middle, and a calibration record that is
  overconfident by about sixteen points. Every screen that shows one of its
  figures says where they came from, and the label survives a reload, because a
  demo indistinguishable from a record will eventually be quoted as one.
- **"Is it working?" on the front door.** Today now carries the calibration
  line — Brier score, the direction you are off in, and the reminder that
  calibration is domain-specific — plus a way to write a new call and the count
  of predictions past their date.

### Fixed

- **The hidden map was still in the tab order.** With Today open, the graph
  behind it kept 139 focusable nodes, so reaching the navigation bar by keyboard
  meant tabbing through all of them. The canvas layer is now `inert` whenever it
  is not the screen you are on.
- **Onboarding ended by offering the map and an empty review queue.** It now
  finishes on Today, which has a session in it, with the map as the secondary
  choice.

### Curriculum 2.1.0

- **Every citation now has a link, and six did not survive the check.** All 129
  distinct sources were looked up. 123 were confirmed against a DOI, publisher
  page or ISBN and now carry that link. Six could not be confirmed and were
  removed from the 15 nodes that carried them: a title belonging to a different
  paper than its stated authors (Kellman & Garrigan), an author list that never
  wrote the named paper (Hall, Andrzejewski & Yopchick), two conflations of two
  real papers into one non-existent one (Fiorella & Mayer, Berkowitz & Ansari),
  a co-author added to a sole-authored paper (Metcalfe & Finn), and a chapter
  attributed to Gentner that Hofstadter wrote. No node dropped below one
  source. `npm run check:data` now fails on a citation with no link, because a
  reference nobody can open is decoration rather than evidence.
- **Rubrics on the eleven scored exercises.** Two to four concrete checks each,
  shown while the work is being written. The 151 artifact exercises still have
  none; the validator holds that number as a budget it can only go down from.

### Added

- **Provenance on every competence estimate.** Confidence already said how much
  evidence there was; provenance says what kind — not measured, self-reported,
  from your work, or measured. Most of the map sits at the first two for a long
  time and now says so, on Today, in the panel, in the browse table, and in
  what a screen reader reads off an untouched node.
- **A ratchet on the unexplained edges.** 188 edges inherited from curriculum
  1.0.0 state no mechanism. The build now fails if that number goes up, and
  fails asking for the budget to be lowered when it goes down, so the debt can
  only travel one way. Deleting an edge nobody can justify counts.

### Fixed

- **Progress could be lost on reload.** Saves to IndexedDB are debounced, and
  the unload handler started an async IndexedDB write that the browser abandons
  as it tears the page down. Logging an exercise and reloading within that
  window silently reset the profile to zero XP. Unload now writes a synchronous
  localStorage recovery snapshot, which the next load promotes into IndexedDB
  ahead of anything older and then clears. Covered by unit tests and a browser
  regression test that reloads without awaiting the save.
- **Standalone `tsc --noEmit` failed on a clean checkout.** `app/layout.tsx`
  used the generated `LayoutProps<"/">` global, which only exists after
  `next dev`/`next build`/`next typegen` has written `.next/dev/types` — a file
  no CI checkout has before the build step. The root layout is now typed
  explicitly; it has no dynamic params and no parallel-route slots, so nothing
  is given up.
- **Camera framing ignored `prefers-reduced-motion`.** Panning to a selection
  honoured it, but fit-all, Focus Mode and path framing still ran half-second
  tweens.
- **Visual baselines are now per-platform.** Glyph rasterisation differs between
  the Linux CI runner and a developer machine — same fonts and same metrics, so
  nothing reflows, but antialiased edges drift a text-heavy dialog 3-4% against
  a 2% tolerance. Baselines live under `e2e/__screenshots__/{platform}/` rather
  than the tolerance being loosened to hide it, and the `bake-snapshots`
  workflow regenerates the Linux set, which no developer machine can produce.
- **Visual snapshots rotted by the calendar.** The session planner seeds its
  ranking noise from the current date, so any snapshot containing a plan drifted
  day to day. The visual suite now pins the clock, and the whole browser suite
  pins the timezone, so a run in UTC CI and a run on a developer machine agree
  on what day it is. Existing baselines are unchanged.

## App 0.2.0 — Curriculum 2.0.0

The map became a learner model. Previously Neuron tracked XP and drew a graph;
it now separates what you have practised from what you can demonstrate, records
how much it actually knows about each capability, and says so.

### Curriculum 2.0.0

- **139 canonical nodes**, up from 100, across 23 categories. The 39 new nodes
  cover executive control, epistemic intelligence, decision intelligence,
  creative cognition, augmented cognition, learning control and long-horizon
  cognition — the capabilities that were missing rather than the ones that were
  easy to add. The core is now capped at 140 and the validator enforces it.
- **Node kinds.** Every node declares whether it is a cognitive ability, a
  meta-skill, a learned competency, a knowledge asset, a physiological enabler,
  a social-emotional skill or an augmentation skill. These are measured
  differently, they decay differently, and the data model now reflects that.
- **Scientific taxonomy overlay.** Nodes map onto CHC broad abilities.
  `executive-control` and `socio-emotional` are flagged as outside the CHC core
  rather than quietly presented as equivalent.
- **Three-pillar evidence on every node**: construct validity, trainability and
  transfer, recorded separately because conflating them is how brain training
  gets sold. Plus a measurement method, a required statement of what training
  will *not* do, and real citations — several of which are the negative result
  for the node they are attached to.
- **Richer edges.** Relation, strength, confidence, mechanism and conditional.
  Inhibition edges are representable and four genuine trade-offs are drawn.
- **Exercises** gain difficulty anchors, evidence kind, duration and a
  progression ladder.

**Migration:** `gwm-updating` ("Updating & Inhibition") was split. Practice
history stays with working-memory updating, because that is what its exercises
trained; the new `exec-inhibition` node starts empty. That is not missing data
— it is data that was never collected. The migration is declared in
`lib/migrations.ts`, runs once, and never deletes a log.

### Learner model

- **Practice and competence are separate numbers.** XP remains the progression
  signal and is labelled as one. Competence is estimated only from observations
  that could have gone badly — scored probes, judged artifacts, completed
  missions, capstones — weighted by evidence kind, difficulty and recency.
- **Estimate confidence** is capped by the node's construct validity. No volume
  of evidence buys a confident number about something nobody can measure well.
- **Six retention models** instead of one forgetting curve: FSRS-style
  stability for knowledge, fluency decay for procedural skill, recency for
  executive habits, detraining for physical capability, demonstration recency
  for social skill, application frequency for meta-skills. Each explains itself
  in plain language.
- **Adaptive difficulty** targeting a 45–85% success band, replayed from the
  log rather than stored. Attempts at an easier framing cannot promote you.

### Measurement

- **Eleven diagnostic probes** — reasoning, working memory, processing speed,
  estimation, calibration, retrieval, planning, mental rotation, reading,
  source evaluation and evidence interpretation. Items are generated per run
  where generation is defensible and drawn from authored banks where it is not.
- Results are compared **only to your own history**, and only when the change
  clears a noise floor derived from the standard error of a proportion. A
  5-point move on ten items is reported as noise, because it is.
- **Predictions and calibration** with Brier scores and Murphy's decomposition,
  so hedging at the base rate cannot masquerade as skill.

### Training

- **Session planner** replaces the fixed Daily Workout: state a time budget,
  your energy and an emphasis, and get a packed session back. Fourteen weighted
  ranking factors, all shown. The displayed score is asserted to equal the sum
  of the factors shown, so the explanation cannot drift from the decision.
- **Goals** route plain language to curated paths, pull in weak prerequisites,
  and order a plan topologically.
- **12 curated paths**, **8 missions**, **8 capstones**.
- **Review inbox** ranking what is actually going stale, with per-kind caps so
  a user returning after two months does not get forty retention rows.
- **Graph intelligence**: bottlenecks, prerequisite gaps, isolated strengths,
  unproven practice and cluster imbalance — each with the numbers attached.

### Personal layer

- **Personal nodes** train, decay, plan and export exactly like core nodes.
- **Skill packs** with a validated third-party schema. Specialised expertise
  anchors into the core instead of enlarging it.
- **Journal as a thinking system**: `[[links]]`, backlinks, tags, templates and
  five line markers, any of which converts into a prediction or a capability.
- **Full versioned backup** including journals and attachments.

### AI

- Per-category consent, and the exact payload shown before sending.
- API keys are **session-only by default**, with the persistence trade-off
  spelled out rather than buried.
- Generated exercises are drafts. They land in personal nodes on request, never
  in the reviewed curriculum, and never award XP or move a competence estimate.

### Production hardening

- **79 Playwright tests** across selection, training, workbench, persistence,
  offline, accessibility, mobile, visual regression and performance budgets.
  They run against a production build.
- The render-loop class of bug has an **explicit regression test**.
- **159 unit tests**, up from 45.
- Service worker is generated and stamped with a hash of the build output,
  replacing a hand-maintained cache version that served a stale application
  shell after every release where someone forgot to bump it.
- WCAG 2.2 AA work, including a complete non-spatial view of the whole graph.

### Bugs fixed, found by the new tests

- Focus was never restored after closing a modal with Escape.
- Screen readers were told they could drag and delete graph nodes.
- A diagnostic result was counted twice in its own history.
- New users were shown a migration notice about a change that predated them.
- The mobile session launcher was invisible but still focusable.
- An unanswered multiple-choice item scored as if the first option had been
  picked.

---

## App 0.1.0 — Curriculum 1.0.0

Initial release. 100 nodes, 16 categories, XP, decay, daily workout, journal,
analytics, PWA.
