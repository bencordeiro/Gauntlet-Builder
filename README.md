# Gauntlet Builder

Build multi-agent evaluation and revision loops — "Gauntlets" — without writing a
large orchestration prompt by hand.

You describe what you want done and what would count as proof it worked. The app
turns that into a complete orchestration package: agent roles, ownership
boundaries, communication rules, evaluation rubrics, approval policy, revision
behaviour, regression protection, and stopping conditions — ready to paste into
Claude Code, Codex, a research agent, or a plain chat model.

## The point of it

An agent left to judge its own work will declare victory. A Gauntlet separates
the building from the reviewing, requires evidence rather than assertion, and —
the part that matters most — refuses to let a run claim success just because it
ran out of rounds. Every generated prompt states explicitly:

> Continue until every mandatory approval condition is satisfied, or stop
> honestly with an unresolved status when a safety, budget, conflict, or
> feasibility boundary is reached.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # test suite
npm run build    # production build
```

No account, no backend, no paid services. Everything is stored in your browser's
local storage.

## How it is put together

```
src/
  model/         Typed data model, plain-language catalogs, defaults, migration
  engine/        Prompt generation — pure, deterministic, no React
  validation/    Configuration rules, classified by severity
  presets/       14 project presets and the sample Gauntlets
  services/      Local storage, import/export
  state/         Single reducer over everything persisted
  components/    UI, grouped by concern
  views/         The seven top-level screens
  test/          Engine, validation, persistence, UI, and console-cleanliness
```

Two rules hold the architecture together:

**Prompt generation never touches presentation.** `generatePackage(config)` takes
a typed `GauntletConfig` and returns seven output documents. It is pure and
deterministic — the same config always produces byte-identical output, which the
test suite asserts directly.

**The catalog is the single source of wording.** Every option a user can pick
lives in `model/catalog.ts` with its label, its plain-language explanation, and
the rule text it contributes to the generated prompt. The UI renders from it and
the engine quotes from it, so the wording a user selected is the wording that
reaches the agent.

## What it generates

Seven outputs per Gauntlet:

| Output | What it is for |
| --- | --- |
| Master prompt | The whole workflow, ready to paste into an agent |
| Agent instructions | A standalone prompt per agent, for real sub-agents |
| Evaluation rubric | The scoring sheet reviewers judge against |
| Workflow JSON | Machine-readable configuration |
| Workflow YAML | The same, for orchestration tooling |
| Plain-English summary | How the Gauntlet behaves, without jargon |
| Execution checklist | Verify the AI actually followed the workflow |

When the target environment cannot spawn real sub-agents, the master prompt
switches to a sequential simulation mode with explicit role delimiters and
context resets — and says plainly that this is weaker than true isolation rather
than pretending otherwise.

## Data and schema

Saved Gauntlets carry a `schemaVersion`. Older exports are migrated forward on
import, one version at a time, with missing sections restored from defaults
rather than rejected — a partially-valid import is more useful than an error.
Agents, criteria, edges and checkpoints all carry stable IDs so references
survive renames, reordering, and export/import round-trips.
