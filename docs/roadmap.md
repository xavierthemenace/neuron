# Roadmap

What is next, and — more usefully — what is deliberately not.

---

## Known gaps in what already ships

These are real and worth fixing before anything new is built.

**188 edges have no recorded mechanism.** They were inherited from curriculum
1.0.0 and show as unexplained in Research Mode. `npm run check:data` now holds
that count as a budget: the build fails if it rises, and fails asking for the
budget to be lowered when it falls, so the debt can only move one way. Writing
mechanisms for them is the single most valuable curriculum contribution
available, and it is tractable in small pieces. Deleting an edge nobody can
justify counts.

**151 evidence-producing exercises have no rubric.** The eleven scored ones
state what a complete answer contains; the artifact ones do not, so the form
falls back to the capability's measurement method and says it is doing so. Held
as a budget on the same terms as the edges.

**The graph is not an evidence-derived structure.** Prerequisite edges are a
curriculum author's judgement with a stated confidence, not an experimental
result. The UI says so, but the honest long-term answer is to downgrade edges
that nobody can justify and to be willing to delete them.

**No node has more than one diagnostic, and 102 have none.** Seventeen probes
cover 37 of 139 nodes. Most competence estimates therefore rest on artifacts
and self-report, which is exactly the state the confidence cap and the
provenance label exist to represent.

A large part of that remainder cannot be closed by adding probes, and saying so
is more useful than a backlog item: negotiation, trust, compassion, sleep,
manual craft and the depth of someone's own field are not measurable by a
five-minute test in a browser. For those the instrument is the work produced
and what it is graded against, which is what the exercise rubrics are for.

**Transfer is asserted, not measured.** Missions produce transfer *evidence*, in
the sense that they require several capabilities to interact. Whether completing
one moves anything is unknown, and the app should not imply otherwise.

**The mobile map is usable, not good.** The list view carries mobile properly;
panning a 139-node graph on a 412px viewport does not become pleasant by being
tested.

---

## Done since this file was last true

Comparison views exist — today against 7, 30, 90 or 180 days ago, rebuilt from
the log as it stood then. Every citation carries a link, and the six that could
not be verified were removed. Every competence figure states what kind of
evidence it rests on. The app opens on Today rather than on the graph. An
example profile fills the views that need history.

## Next

**More diagnostic probes** where one is genuinely defensible. The executive and
epistemic clusters have just been covered; the remaining candidates are the
spatial and musical ones, which need audio and canvas item types the runner
does not have yet.

**Mechanisms for the legacy edges**, ideally with citations, ideally with some
edges deleted rather than justified.

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
