# Hours Tracker

A pure-static GitHub Pages app that logs consulting hours into private per-consultant GitHub data repos. Partner-branded (Sector Growth first), hosted by SapienEx.

**Live app:** `https://sapienex-ai.github.io/hours-tracker/` *(deployed after first push)*
**Design spec:** [`docs/superpowers/specs/2026-04-11-hours-tracker-design.md`](docs/superpowers/specs/2026-04-11-hours-tracker-design.md)
**Implementation plan:** [`docs/superpowers/plans/2026-04-11-hours-tracker-plan.md`](docs/superpowers/plans/2026-04-11-hours-tracker-plan.md)
**Backlog:** [`docs/superpowers/backlog.md`](docs/superpowers/backlog.md)
**AI-native development guide:** [`CLAUDE.md`](CLAUDE.md)

## Quick start (dev)

```sh
npm install
npm run dev
```

Opens at http://localhost:5173/hours-tracker/

## Adding yourself as a consultant

1. Have a partner admin create your private data repo at `sapienEx-AI/hours-data-<partner>-<your-slug>`.
2. Use `scripts/scaffold-data-repo.sh` to initialize it (see [`docs/architecture/data-repo-scaffold.md`](docs/architecture/data-repo-scaffold.md)).
3. Generate a fine-grained GitHub PAT scoped to your data repo (Contents: read + write).
4. Open the live app, complete the first-run flow, paste your PAT.

## Development

All contributions must pass:

```sh
npm run typecheck
npm run lint
npm test
```

108 tests across 20 suites, including property-based tests (fast-check) and golden-file regression on real March 2026 data.

See [`CLAUDE.md`](CLAUDE.md) for the full development rules and invariants.

## Architecture at a glance

- **Pure-static SPA** — Vite + React 18 + TypeScript strict
- **GitHub Pages hosting** at project scope (`/hours-tracker/`)
- **Fine-grained PAT auth** — no backend, token in localStorage, blast radius scoped to one data repo
- **All data as flat JSON** in private per-consultant GitHub repos
- **Integer math everywhere** — cents and hundredths, custom ESLint rule (`local-rules/no-float-money`) enforces
- **Partner-branded UI** — theme loaded from `public/partners/<id>/partner.json` at runtime
- **Three multi-agent review gates** passed during construction (Gate A: calc, Gate B: UI, Gate C: March golden)
