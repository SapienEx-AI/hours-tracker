# CLAUDE.md — Hours Tracker

Authoritative guide for AI agents working on this codebase. **Read before editing anything.**

## Project purpose

A pure-static GitHub Pages app that logs consulting hours into per-consultant private GitHub data repos. Partner-branded (Sector Growth first), hosted by SapienEx. Full design: [`docs/superpowers/specs/2026-04-11-hours-tracker-design.md`](docs/superpowers/specs/2026-04-11-hours-tracker-design.md). Implementation plan: [`docs/superpowers/plans/2026-04-11-hours-tracker-plan.md`](docs/superpowers/plans/2026-04-11-hours-tracker-plan.md). Effort-tracking addition: [`docs/superpowers/specs/2026-04-14-effort-tracking-design.md`](docs/superpowers/specs/2026-04-14-effort-tracking-design.md). Effort source integrations (Slack + Gmail + extended calendar): [`docs/superpowers/specs/2026-04-15-effort-source-integrations-design.md`](docs/superpowers/specs/2026-04-15-effort-source-integrations-design.md).

## Non-negotiable invariants (spec §11)

1. **Integer math only** for `_cents` and `_hundredths` fields. All arithmetic goes through `src/calc/int.ts`. The ESLint rule `local-rules/no-float-money` enforces this — never disable it locally.
2. **Every write validates against the schema** via `src/schema/validators.ts` BEFORE hitting GitHub. Never bypass.
3. **Every commit uses a structured prefix** (see `src/data/commit-messages.ts`): `log:`, `edit:`, `delete:`, `bulk-edit:`, `snapshot:`, `config:`, `import:`.
4. **Partner logo is always primary.** Top-left in `AppShell.tsx`. SapienEx attribution is **footer only** in `Footer.tsx`, muted, 11px, no logo. Never co-brand.
5. **`profile.partner_id` is validated** against the selected partner on every load (`src/ui/screens/first-run/validate-data-repo.ts`).
6. **Rate is snapshotted on every entry** at log time (spec §5.3). Changing `config/rates.json` never moves historical numbers.
7. **Snapshots are immutable.** Never rewrite a file in `data/snapshots/`.
8. **Entry v4 effort fields.** `effort_kind` and `effort_count` are both null or both set — validator enforces. Do not log zero-hours entries even for lightweight activities — `hours_hundredths ≥ 1` stays invariant.
9. **Source-integration entries flow through the DigestPanel Accept path.** No background writes, no silent entry creation. Every Slack/Gmail/calendar auto-suggested row waits for a user click. Every resulting entry carries `source_ref` + `effort_kind` + `effort_count`.

## Do-not-touch-without-review list

- `src/calc/**` — every change re-runs **Gate A** (spec §7.2 Layer 4). Property tests + golden tests + multi-agent review must all pass. This now includes `src/calc/effort.ts` and `src/calc/effort-categories.ts` — they back dashboard aggregations and category mapping.
- `schemas/**` — any change is a schema bump. Update `src/schema/types.ts`, bump `schema_version`, write a migration note in `docs/architecture/adding-a-field.md`.
- `public/partners/<partner-id>/partner.json` — partner-facing config. Verify with the partner before committing theme changes.
- `tests/fixtures/2026-03-golden.json` and `tests/fixtures/2026-03-expected.json` — the immutable regression fixture. Regenerate only if the importer itself changes, and re-run **Gate C** when you do.

## Run commands

```sh
npm install             # deps
npm run dev             # local dev server (http://localhost:5173/hours-tracker/)
npm run typecheck       # tsc --noEmit (strict + exactOptionalPropertyTypes)
npm run lint            # eslint + no-float-money rule
npm test                # vitest: unit + property + golden (108 tests across 20 suites)
npm run test:golden     # just the golden regressions (mini + full)
npm run test:property   # just the fast-check invariants
npm run test:unit       # just the int unit tests
npm run build           # production build
npm run preview         # preview the production build locally
npm run import:march    # re-run the March 2026 importer (regenerates golden)
npm run release:patch "summary"   # bump app version + append release entry (see below)
```

**Before claiming any change is complete:**
1. `npm run typecheck` passes
2. `npm run lint` passes (max-warnings 0)
3. `npm test` — ALL tests pass
4. For calc changes: re-dispatch Gate A review (see spec §7.2)

**Before pushing a user-visible change to `main`:** bump the version.
- Run `npm run release:patch "short summary"` (or `:minor` / `:major`).
- The script reads `public/version.json`, bumps `app.version`, captures the `git log` since the previous release, and appends a new release entry with commit + changes.
- Commit `public/version.json` alongside the release payload: `git commit -m "release: vX.Y.Z — <summary>"`.
- The bottom-left Version badge in the UI reflects this; hovering surfaces the latest release's summary + commit list.
- Local dev builds render the badge in red bold as `v0.0.0-local` — never bump during local work.
- `version.json` also carries the authoritative `data.schema_versions` table. Schema bumps must update this.

## Where to find things

```
src/calc/       → all billing math (pure, tested to death, Gate A)
src/calc/effort.ts       → all effort aggregation (pure, Gate A)
src/calc/effort-categories.ts → kind → category mapping (pure, Gate A)
src/schema/     → types.ts + ajv validators.ts (single source of truth)
src/data/       → Octokit I/O + commit messages + repo modules + hooks
src/auth/       → TokenProvider interface + PAT implementation
src/partner/    → load-partner.ts + apply-theme.ts (partner config + runtime theme)
src/store/      → Zustand stores (auth-store)
src/format/     → display formatters (cents→dollars, hundredths→hours)
src/ui/         → React components (layout/, screens/, components/, ErrorBoundary, Router)
schemas/        → JSON Schemas (authoritative contracts)
public/partners/→ partner configs + logos + favicons
tests/          → unit, property, golden, integration
scripts/        → import-march-2026, scaffold-data-repo, compute-march-totals
docs/           → spec, plan, architecture playbooks
```

## Testing expectations

- **Unit tests** for every calc function. Hand-crafted inputs.
- **Property tests** for every invariant in spec §7.2. Uses `fast-check`.
- **Golden tests** for the March 2026 regression fixture. `npm run test:golden` must always pass.
- **Schema tests** for every validator.
- **Test names are full sentences** describing observable behavior (spec §15.4). Bad: `"sums entries"`. Good: `"computeMonthTotals sums only entries whose date falls within the target month"`.

## Common tasks (recipes)

- **Add a new field to an entry:** `docs/architecture/adding-a-field.md`
- **Add a new partner:** `docs/architecture/partner-onboarding.md`
- **Change default rate (forward or retro):** `docs/architecture/rate-change-sop.md`
- **Scaffold a new consultant data repo:** `docs/architecture/data-repo-scaffold.md`
- **Every calc invariant and its test:** `docs/architecture/calc-invariants.md`
- **Trace a log-hour write end to end:** `docs/architecture/data-flow.md`
- **Add a new effort kind:** `docs/architecture/effort-kinds.md`

## When to STOP and ask the human

- Any change to `schemas/*.json` that bumps `schema_version`
- Any change to `tests/fixtures/2026-03-expected.json` (hand-verified regression)
- Adding a new partner to `public/partners/index.json`
- Changing currency semantics
- Any change that would move historical billing totals

## No-go rules

- No metaprogramming, decorators, runtime type generation, dynamic imports in production paths.
- No mocks for the calc module — use real inputs (calc is pure).
- No floating-point arithmetic on money or hours fields outside `src/calc/int.ts`.
- No direct `localStorage` access outside `src/auth/` and `src/store/`.
- No SapienEx branding outside `src/ui/layout/Footer.tsx`.
- No silent write failures — always surface errors to the user.
- No disabling `local-rules/no-float-money` or `@typescript-eslint/consistent-type-imports`.
