# Contributing to Neuron

Neuron has two kinds of contribution and they are held to different standards.

**Code** is reviewed the usual way: does it work, is it tested, does it fit.

**Curriculum** is reviewed as a claim about human cognition. A node on the map
asserts that a capability exists, that it can be trained, and — implicitly, by
being drawn next to other nodes — how it relates to them. Those are claims, they
are visible to every user, and getting them wrong makes the whole system less
trustworthy rather than just less useful.

---

## Before you start

```bash
npm install
npm run check:data   # curriculum schema + integrity
npm test             # pure-logic unit tests
npm run lint
npx tsc --noEmit
npm run build
npx playwright test  # browser suite (needs: npx playwright install chromium)
```

All of these run in CI and all of them must pass.

---

## Code contributions

**Put algorithms in `lib/` as pure functions.** Everything in `lib/` is a pure
module with no React and no DOM, imported directly by the Node test runner.
If a piece of logic cannot be tested without a browser, it is probably in the
wrong place.

**Add a regression test whenever you fix a runtime bug.** This is not a
formality. Two of the worst bugs in this project's history were render loops,
and the reason there is now an explicit `e2e/selection.spec.ts` test for rapid
selection churn is that nothing else would ever have caught them.

**Do not introduce effects that write state because derived state changed.**
`useEffect` calling `setState` synchronously is the shape both render loops
took. Derive it, use a lazy initialiser, or key the component to remount.
The lint config will reject it; do not reach for a disable comment.

**Do not let React Flow's internal selection and the app's selection become two
sources of truth.** The app owns selection. `onSelectionChange` must not write
back into it.

**Keep node and edge object identity stable.** `lib/graph.ts` caches by a
derived signature so that logging one exercise does not recreate 138 other
nodes. If you add a visual channel, add it to the signature — and check
`e2e/performance.spec.ts` still passes, because that is what proves it.

**Avoid new dependencies.** The whole app is Next, React, React Flow and
d3-force. A dependency has to earn its place against the cost of every user
downloading it.

---

## Curriculum contributions

### The bar for a new core node

The canonical core is capped at **140 nodes** and the validator enforces it.
The question is not "is this a real capability" — there are thousands of real
capabilities. The question is:

> **Is the core measurably worse at describing general cognitive capability
> without this node?**

Two things that are *not* arguments for inclusion:

- **Domain expertise.** Kubernetes, contract law, French grammar and jazz
  harmony are all real and all belong in a **skill pack** (`lib/packs.ts`),
  which anchors into the core without enlarging it.
- **A narrower framing of something already present.** If your node overlaps an
  existing one, the usual right answer is to sharpen that node's description,
  not to add a second one beside it.

### Run the proposal tool first

```bash
node scripts/propose-node.mjs --template > proposal.json
# fill it in
node scripts/propose-node.mjs proposal.json
```

It reports overlap with existing nodes, candidate prerequisites, missing
fields and graph problems. A clean report is a starting point, not a case.

### Every node must carry

| Field | Why it is required |
|---|---|
| `description` | What the construct *is*, precisely enough that a reader could tell whether they have it. |
| `why` | The rationale for inclusion. This is the argument, in one sentence. |
| `kind` | Ability, meta-skill, competency, knowledge, enabler, social, augmentation. These decay and are measured differently. |
| `constructs` | CHC mapping, or an empty array. An empty array is a legitimate answer; a wrong mapping is not. |
| `evidence.constructValidity` | Evidence the thing exists and can be measured. |
| `evidence.trainability` | Evidence practice moves it. |
| `evidence.transferEvidence` | Evidence it generalises. **Usually weaker than you want it to be.** |
| `evidence.measurementMethod` | How it would actually be measured — including "it cannot be, directly". |
| `evidence.knownLimitations` | What training this will **not** do. Never empty. |
| `evidence.sources` | Real citations. Negative results are welcome and often the most important ones. |
| `exercises` | At least one, with a difficulty anchor and a checkable success criterion. |
| `resources` | At least one genuine starting point. |

### Evidence bands

`strong` · `moderate` · `emerging` · `speculative`

Use them honestly. The validator rejects an overall `evidenceConfidence`
stronger than its pillars allow, but it cannot tell whether you picked the right
pillar in the first place — that is what review is for.

The house style is to be unflattering about our own nodes. `gwm-span` says
outright that span training moves the trained task and almost nothing else;
`intra-solitude` says Neuron includes it on weak evidence. If your entry reads
like marketing copy, it is wrong.

### Edges

Every edge needs a `relation`, a `strength`, a `confidence`, and — for anything
other than a plain `prerequisite` or `synergy` — a `mechanism`.

> An edge nobody can explain is an edge nobody should draw.

188 edges inherited from curriculum 1.0.0 have no recorded mechanism. They are
reported as a warning by `npm run check:data` and shown as unexplained in
Research Mode. Adding a mechanism to one of them is a genuinely useful and very
mergeable contribution.

`prerequisite` and `enabling` edges must not form a cycle; the validator
rejects it.

### Migrations

If you rename, merge or split a node, add a migration to `lib/migrations.ts`.
Never leave a user's practice history pointing at an id that no longer exists.

Splits are lossy, and the policy has to be stated rather than guessed: history
stays with the successor whose exercises actually trained it, the other
successors start empty, and the `note` field explains why. See the 2.0.0 entry
for the worked example.

---

## RFCs

Open an RFC issue (`.github/ISSUE_TEMPLATE/rfc.md`) before opening a PR for any
of:

- adding, removing, merging or splitting a core node
- adding or removing a category
- changing what an evidence band means
- changing the competence, retention or difficulty model
- changing how XP relates to competence

These change what the system claims about its users. They need discussion in
the open before code.

Small, non-RFC contributions that are always welcome: mechanisms for
unexplained edges, better citations (especially ones that make us *less*
confident), tighter limitations text, new exercises with checkable criteria,
skill packs, accessibility fixes, and browser tests for anything currently
untested.

---

## The line we do not cross

Neuron optimises for real-world capability, not engagement. In practice:

- No claim that training here raises general intelligence. Nothing supports it.
- No streaks, no manufactured urgency, no loss aversion.
- No metric that improves by clicking rather than by improving.
- Uncertainty is shown, not hidden. "Confidence: Low — 2 observations" is a
  feature.
- Careful language: *"this trains X"*, *"performance improved on Y"*,
  *"transfer is uncertain"* — never *"this makes you smarter"*.

A PR that makes the app more compelling by making it less honest will be
declined, however well it is written.
