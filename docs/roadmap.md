# Roadmap

What is next, and — more usefully — what is deliberately not.

---

## Known gaps in what already ships

These are real and worth fixing before anything new is built.

**188 edges have no recorded mechanism.** They were inherited from curriculum
1.0.0, are reported by `npm run check:data`, and show as unexplained in Research
Mode. Writing mechanisms for them is the single most valuable curriculum
contribution available, and it is tractable in small pieces.

**The graph is not an evidence-derived structure.** Prerequisite edges are a
curriculum author's judgement with a stated confidence, not an experimental
result. The UI says so, but the honest long-term answer is to downgrade edges
that nobody can justify and to be willing to delete them.

**No node has more than one diagnostic.** Eleven probes cover a fraction of 139
nodes. Most competence estimates will therefore rest on artifacts and
self-report, which is exactly the state the confidence cap exists to represent —
but more probes would be better than a better estimator.

**Transfer is asserted, not measured.** Missions produce transfer *evidence*, in
the sense that they require several capabilities to interact. Whether completing
one moves anything is unknown, and the app should not imply otherwise.

**The mobile map is usable, not good.** The list view carries mobile properly;
panning a 139-node graph on a 412px viewport does not become pleasant by being
tested.

---

## Next

**More diagnostic probes**, particularly for the executive and epistemic
clusters, where competence currently rests almost entirely on artifacts.

**Mechanisms for the legacy edges**, ideally with citations, ideally with some
edges deleted rather than justified.

**Graph comparison views** — current versus 30 days ago, desired path versus
current capability, one cluster against another. The data supports it; the
views do not exist yet.

**Better calibration tooling** — imported resolution from public forecasting
platforms, and per-domain calibration curves, because calibration is
domain-specific and a single number hides that.

**Sharper competence estimation from artifacts.** Right now a long written
response is weighted the same as a short one. Rubrics attached to specific
exercises would improve that without inviting self-inflation.

---

## Under consideration

**Local semantic search.** Only if it stays genuinely private — a small model
downloaded once and run in a worker, never a hosted embedding API. Keyword
search is inspectable and fails visibly, which counts for a lot.

**Spaced-repetition integration.** Reading true retention rates from Anki would
turn several knowledge nodes from self-reported into measured. It depends on an
export format staying stable, which is a real cost.

**Collaborative capstones.** Capstone rubrics are self-scored, which is their
weakest part. Review by another person would fix it and requires infrastructure
this project does not have.

**More skill packs.** Deliberately not maintained here. The schema exists so
packs do not have to live in this repository.

---

## Deliberately not

**Cloud sync as a default.** If it ever exists it is opt-in, end-to-end
encrypted, and the app keeps working without an account. The moment an account
is required, local-first was a marketing phrase.

**Social features, leaderboards, comparison to other users.** Neuron has no
standardisation sample, so any comparison it offered would be misleading. And
the thing being measured is not a competition.

**Streaks, daily goals, loss aversion, notifications that create urgency.**
These reliably increase engagement and have nothing to do with capability.

**A single "cognitive score".** Every proposal for one ends in the same place:
a number that goes up when you click. The four separate numbers are harder to
read and are the honest version.

**Growing the core past 140 nodes.** The cap is enforced by the validator. New
specialised capability goes in a pack.

**AI that awards anything.** Generated exercises are drafts. An AI that can
grant XP is an AI that can be asked to grant XP.

**Claiming transfer we cannot demonstrate.** If a future version cannot show
that training moved something outside the trained task, it will keep saying so.
