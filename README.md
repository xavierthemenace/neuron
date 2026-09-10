# Neuron

A local-first map of trainable intelligence. Every faculty is a node; logging real
practice grows and lights that node, and the synapses between related faculties
quicken as both ends get trained. Over months the map should go from a dim
scatter to a lit-up brain.

100 faculties across four models — Gardner's Multiple Intelligences, Goleman/
Mayer-Salovey EQ, and Cattell-Horn-Carroll fluid and crystallized ability —
wired together with 188 links.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build (runs `check:data` first via `prebuild`) |
| `npm run check:data` | Referential integrity of the curriculum |
| `npm run bake:layout` | Recompute `data/layout.json` — **run after editing nodes or links** |
| `npm run lint` | ESLint |

## Layout

```
app/                 shell, dark-only global styles, page (dynamic ssr:false)
components/          NeuralGraph, ConceptNode, SynapseEdge, SidePanel, TopBar…
data/
  intelligenceData.json   the curriculum — 16 categories, 100 nodes, 188 links
  layout.json             precomputed node positions (generated)
lib/                 types, mastery curve, layout algorithm, graph builder, storage
scripts/             bake-layout.mjs, check-data.mjs
```

## How it works

**Progress is a log of events, not an XP counter.** `localStorage["neuron.progress.v1"]`
holds every logged rep with its timestamp; XP is summed from those. That is what
makes undo, per-node history and cadence tracking fall out for free, and it means
an export is a complete, replayable record.

**Mastery tiers** (`lib/mastery.ts`) — Dormant → Firing (50 XP) → Myelinated (150)
→ Consolidated (350) → Mastered (700). Orb radius follows `√(xp/700)` so early reps
produce visible growth and late ones don't blow the layout apart.

**Positions are baked, not simulated.** The d3-force pass costs ~500 ms for 100
nodes, which is far too much to spend blocking the main thread on every load for a
result that never changes. `npm run bake:layout` runs it once into
`data/layout.json`. Seeding is deterministic (phyllotaxis, never `Math.random`), so
the map is pixel-identical every reload — the spatial memory you build up is the
point. Clusters sit on concentric rings by domain: crystallized at the core, then
fluid, EQ, and the eight Gardner intelligences on the outside.

**Rendering.** `nodeTypes`/`edgeTypes` are declared at module scope (inline objects
make React Flow remount every node). Nodes carry explicit `width`/`height` rather
than relying on measurement, since the node array is rebuilt on every XP change and
fresh objects would otherwise read as unsized — which silently empties the MiniMap.
Only the node you logged re-renders, not all hundred.

**Multi-tab.** A `storage` listener pulls in work logged in another tab, and the
`pagehide` flush only writes when this tab actually has an unsaved change — without
that, reloading a stale tab would stamp its old state over newer progress.

## Editing the curriculum

`data/intelligenceData.json` is the whole dataset. After changing it:

```bash
npm run check:data     # catches dangling links, duplicate ids, bad cadences
npm run bake:layout    # only needed if you changed nodes or links
```

### A note on resources

Resources have an **optional** `url`. Entries with one are links; entries without
are citations (book, paper, author) and render as dashed, non-clickable chips. That
split is deliberate — inventing plausible-looking URLs across ~250 resources would
have produced a pile of dead links, so a URL is only present where it was known to
be real. Adding links to the citation entries over time is a natural improvement.

## Data & privacy

Everything stays in your browser. There is no server, no account, no telemetry.
Export writes a JSON file you can back up or move to another browser; Import
validates it before replacing your state. Clearing site data wipes progress, so
export occasionally.
