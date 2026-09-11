# Architecture decisions

The reasoning behind the choices that would otherwise look arbitrary, and the
ones a future contributor is most likely to want to undo.

---

## 1. Practice and competence are separate numbers

**Decision.** XP measures exposure. A separate competence estimate measures
ability, and it only moves on observations that could have gone badly.

**Why.** A single number that goes up when you click is the central dishonesty
of points-based learning products: forty self-certified daily ticks and one
scored diagnostic produce the same score, even though only one of them is
evidence. Once the two are merged you cannot un-merge them, because the history
no longer records which kind of thing each rep was.

**Consequence.** Most users will see high practice and low competence for a
long time. That is correct and it is the point. `lib/competence.ts` weights
self-report at 0.25 against 3.0 for a scored rep; there is a test asserting that
25 unscored ticks leave competence under 62%.

**Do not** "fix" the gap by raising the self-report weight. If it looks wrong,
the fix is more scored evidence, not a kinder estimator.

---

## 2. Six retention models, not one

**Decision.** `lib/retention.ts` implements knowledge, procedural, executive
habit, physical, social and meta retention separately.

**Why.** One forgetting curve for both "Method of Loci" and "Strength &
Conditioning" is wrong in both directions. Declarative knowledge follows a
spacing-sensitive stability curve; motor fluency degrades slowly from a high
floor; a habit is almost pure recency; physical adaptations detrain fast and
return fast.

**Consequence.** Every node needs a `kind`, because that is what selects the
model. `retentionModelFor()` falls back from kind when no explicit override is
set.

**The FSRS-like path is deliberately simplified.** It keeps the power
forgetting curve — `R = (1 + t/9S)^-1`, so `R(S) = 0.9` — and a stability
update that rewards reviewing late and penalises difficult material. It is not
a faithful FSRS implementation and does not claim to be.

---

## 3. Estimate confidence is capped by construct validity

**Decision.** No amount of evidence produces a "high confidence" estimate for a
node whose construct validity is `emerging` or `speculative`.

**Why.** This is the honest part of the whole system. Reflective Solitude has no
established measurement; a user who logs it two hundred times has produced two
hundred observations of something nobody knows how to measure. Reporting high
confidence there would be a category error dressed as rigour.

---

## 4. Gating edges and influence edges are different subgraphs

**Decision.** `lib/graph-intel.ts` maintains two directed graphs. Gating edges
(`prerequisite`, `enabling`) answer "what must I train first". Influence edges
(those plus `supporting`, `transfer`) answer "what would a gain here move".

**Why.** Using one set for both was a real bug. Ordering a plan by supporting
edges invents obligations the curriculum never asserted; computing leverage from
gating edges alone made leverage far too small, because most of the graph's
downstream value flows along supporting edges.

---

## 5. The core is capped at 140 nodes

**Decision.** `scripts/check-data.mjs` fails the build above 140.

**Why.** A map of general cognitive capability gets worse at that job with every
domain-specific node added to it. Without a hard limit the core accretes
whatever anyone happened to care about, and in three years it is a tag list.

**The escape hatch is skill packs** (`lib/packs.ts`), which anchor into the core
rather than extending it. A pack node must declare at least one core anchor;
the validator rejects one that anchors to nothing, because that is a separate
curriculum wearing a pack's clothes.

---

## 6. Migrations rewrite references and never delete logs

**Decision.** `lib/migrations.ts` declares renames, merges and splits as data.
They are applied once, in version order, are idempotent, and only ever rewrite
*references*.

**Why.** The ontology is meant to keep evolving. A user's two years of practice
history is not meant to evaporate when it does. A log the current curriculum
cannot place is still a record that the user did something, so it is parked
against its original id and surfaced as orphaned history rather than discarded.

**Splits are lossy and the policy is stated rather than guessed.** History
cannot be attributed to a narrower construct it was never measured against, so
the primary successor inherits it and the others start empty, with a note
explaining why.

---

## 7. The layout is baked, and node identity is cached

**Decision.** `data/layout.json` is computed at build time by
`scripts/bake-layout.mjs`. `lib/graph.ts` caches every node and edge object
against a derived signature.

**Why.** The force simulation costs ~400ms for 139 nodes, which is far too much
to spend on every page load for a result that never changes. And React Flow
shallow-compares: without the signature cache, logging one exercise recreates
138 unrelated node objects and re-renders all of them.

**Consequence.** Adding a node requires `npm run bake:layout`, and the validator
fails loudly if you forget — the silent fallback is `{x:0, y:0}`, which stacks
the node at the origin with no error anywhere.

**If you add a visual channel, add it to the signature**, and check that
`e2e/performance.spec.ts` still passes. That test tags DOM elements and asserts
they survive a state change, which is the only thing that actually proves the
cache works.

---

## 8. App-owned selection is the single source of truth

**Decision.** `NeuralGraph` owns `selectedId`. React Flow's internal selection
is never mirrored back into it via `onSelectionChange`.

**Why.** Two render loops. Both times, a selection change propagated into app
state while a close or switch update was already in flight, and the two
selections drove each other. `e2e/selection.spec.ts` exercises rapid churn
specifically to catch this returning.

**Related:** no effect may call `setState` synchronously in response to derived
state. Five such effects were removed during the 2.0 work — each became a lazy
initialiser, a derived value, or a remount key. The lint rule enforces it.

---

## 9. One clock, on the provider

**Decision.** `useProgress().nowMs` is the app's clock, refreshed with the
hourly decay tick. Views do not call `Date.now()` during render.

**Why.** A per-component clock makes every derived list unstable across
re-renders, and lets two panels disagree about whether the same prediction is
overdue.

---

## 10. Diagnostics compare only to your own history

**Decision.** No norms, no percentiles, no comparison to other users. A change
is reported as meaningful only when it clears two standard errors of a
proportion at that item count.

**Why.** Producing an honest percentile would require a standardisation sample
Neuron does not have. And with ten binary items the standard error near 0.5 is
about 0.16, so anything under roughly a third of the scale is noise — reporting
it as improvement would be the single easiest way to make the whole measurement
layer worthless.

---

## 11. Ranking explanations are generated from the ranking

**Decision.** `lib/workout.ts` returns the weighted factors that produced each
item's score, and the UI renders those. The displayed score is asserted in test
to equal the sum of the displayed factors.

**Why.** An explanation written separately from the decision drifts from it
within two refactors, and then the app is confidently explaining a decision it
did not make.

---

## 12. AI output cannot award anything

**Decision.** The coach shows the exact payload before sending, takes
per-category consent, defaults API keys to session-only, and its generated
exercises land in personal nodes as drafts.

**Why.** The reviewed curriculum is a curated artifact; generated content
entering it silently would destroy that property. And an AI that can award XP is
an AI that can be asked to award XP.

**On key storage:** the browser offers no encrypted credential store a page can
use. "Remember this key" means plaintext in IndexedDB, readable by any script on
the origin. The checkbox says so rather than implying safety it cannot provide.

---

## 13. The service worker version comes from the build

**Decision.** `public/sw.js` is generated from `sw.template.js` by
`scripts/build-sw.mjs`, stamped with a hash of the build output.

**Why.** The previous worker used a hand-edited cache name. Every release after
the last time someone remembered to bump it served the old application shell
indefinitely — the app loads, looks fine, and is months old.

---

## 14. The list view is not a fallback

**Decision.** `BrowseTab` is a complete alternative interface: browse, filter,
search, sort, inspect prerequisites, open a node — all without the canvas.

**Why.** WCAG 2.2 requires a single-pointer alternative to dragging, and the map
pans by drag. But the real reason is simpler: a capability map that only works
for people who can see and drag a canvas is a capability map for some people.
`e2e/a11y.spec.ts` asserts the whole graph is reachable from the keyboard alone.

---

## 15. Tests import the shipping code, not a copy

**Decision.** `scripts/tests/alias-hooks.mjs` teaches Node the `@/` alias so the
unit tests import the same data layer the app ships.

**Why.** The alternative — a test-only loader for the curriculum — lets the
tested code drift from the shipped code, which is the failure mode where the
suite is green and the app is broken.

**Consequence.** Relative imports inside `lib/` carry explicit `.ts`
extensions, because Node's type stripping does not do extension resolution.
