# Neuron

A local-first map of trainable intelligence. Every faculty is a node; real practice grows and lights that node, related synapses strengthen, and retention gradually fades when a skill goes unused.

The current curriculum contains **100 faculties, 188 links, 164 exercises, and 16 categories** spanning Gardner-style intelligences, EQ, fluid intelligence, and crystallized knowledge.

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
| `npm run bake:layout` | Recompute `data/layout.json` after editing nodes or links |
| `npm run lint` | ESLint |

CI runs `npm ci`, lint, and a production build on pull requests.

## Product capabilities

### Cognitive graph

- Translucent category hulls and ambient Gardner / EQ / Fluid / Crystallized regions.
- Smooth click-to-focus camera animation and a two-hop **Focus Mode**.
- Persistent minimap plus a Map Guide explaining prerequisites, downstream pathways, and synergy links.
- `Cmd/Ctrl + K` command palette for node jumps, ready tasks, analytics, map fitting, and Focus Mode.
- Keyboard-accessible nodes: Tab / Enter plus spatial Arrow-key navigation.
- Logging practice triggers luminous particle bursts across connected synapses.

### Training integrity, mastery, and analytics

Exercise completion is reset-gated in both the UI and the reducer: daily tasks reset at local midnight, weekly tasks use a rolling seven-day window, and session tasks use a four-hour cooldown. Typable tasks can be completed inside the app with work/evidence attached to the log; external practice can record notes and minutes.

Effective mastery uses an Ebbinghaus-inspired retention curve: a 14-day grace period followed by gradual exponential decay with a 120-day half-life and a Firing-tier floor for previously trained faculties. Lifetime awarded XP remains preserved. Consolidated/Mastered prerequisite nodes can give downstream exercises a **+25% synergy buff**.

The Analytics dashboard includes a radar profile across all live curriculum categories, category mastery bars, a 365-day activity heatmap, active streak, active days, and total practice minutes.

### Knowledge workspace

Progress, journals, attachments, and local settings live in **IndexedDB**. Existing `localStorage["neuron.progress.v1"]` data is migrated automatically on first use, with localStorage retained only as a fallback when IndexedDB is unavailable. BroadcastChannel keeps progress synchronized across tabs.

Every faculty has an autosaved Markdown journal with a safe lightweight preview and binary file attachments. Notes are stored independently from XP state so typing does not cause graph-wide progress updates.

The Data menu supports:

- Progress JSON export/import.
- **Anki CSV** export containing faculty-definition and exercise cards.
- **Obsidian Vault ZIP** export: one Markdown file per faculty, frontmatter, training tasks, resources, journal text, and `[[wikilinks]]` matching graph connections.

### Daily workout and optional AI coach

The **Daily Neuro Workout** chooses three currently eligible exercises using retention pressure, active synergy buffs, lower-mastery categories, and variety. Recommendations route into the normal task flow; they never bypass reset or completion rules.

The optional **AI Coach** supports local Ollama or an OpenAI-compatible endpoint. It can generate goal-specific exercises or explain/train the connection between two faculties. Ollama is the default local option. Remote providers receive data only when the user explicitly submits a coach request; an optional API key is stored locally in IndexedDB.

### PWA / offline

Neuron includes a native Next.js web-app manifest and service worker. After the first successful visit, the app shell and loaded same-origin assets are cached for offline reuse; progress, journals, attachments, workouts, and analytics already operate from local browser data. The app also requests persistent browser storage where supported and surfaces offline/update status.

## Repository layout

```text
app/                       shell, metadata, PWA manifest, dark global styles
components/                graph, node/edge UI, training, journal, analytics,
                           workout, AI coach, navigation and PWA status
data/
  intelligenceData.json    curriculum: categories, faculties, exercises, links
  layout.json              deterministic precomputed node positions
lib/
  db.ts                    IndexedDB stores and local settings
  graph.ts                 React Flow nodes/edges and render-identity caches
  mastery.ts               tiers, reset windows, retention/decay
  training.ts              graph-neighborhood and synergy logic
  workout.ts               daily workout ranking
  knowledge-export.ts      Anki CSV + Obsidian ZIP generation
  hulls.ts                 deterministic cluster geometry
  storage.ts               progress validation, migration and import/export
scripts/                    curriculum validation and layout baking
public/sw.js                offline cache/service worker
```

## Rendering and performance

Positions are baked rather than simulated at runtime. Node and edge objects are identity-cached by their derived visual signatures, so logging one exercise changes the trained faculty and affected synapses rather than recreating the entire graph surface. Journal state is deliberately outside the progress context for the same reason.

## Editing the curriculum

`data/intelligenceData.json` is the curriculum source of truth. After changing nodes or links:

```bash
npm run check:data
npm run bake:layout
```

Resources have an optional `url`: entries with one are links, while entries without one are citations rather than guessed URLs.

## Data & privacy

Neuron has no account requirement and no application server for core functionality. Progress, journals, attachments, settings, workouts, and analytics are local browser data. Clearing site data can remove them, so exports are still useful as backups.

The AI Coach is optional. Local Ollama can keep inference on the user's machine; choosing a remote OpenAI-compatible endpoint sends the explicitly submitted coach prompt to that configured provider.
