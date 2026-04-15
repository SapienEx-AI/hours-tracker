# Effort tracking — design

Spec for adding effort tracking alongside the existing hours-first model. Targets HubSpot leads who need to log day-to-day activities (workshops, Slack messages, emails, meetings, etc.) as **effort**, not just hours — while preserving every invariant of the hours model for existing consultants.

## 1. Purpose

Today's tracker captures `hours_hundredths` per entry. That fits hourly consultants at Sector Growth. It does **not** fit a full-time HubSpot lead whose day is dominated by short async activities (Slack pings, email follow-ups) and by activities whose meaning is better expressed as "one workshop" than "2.5 hours". This spec extends the data model so a single entry can carry both: the time it took and what kind of activity it was, with a count for batching.

**Primary user for this capability:** full-time, salaried HubSpot leads at the same agency as hourly consultants. They share partner config, repo structure, and auth. They differ in billing model (salaried, not hourly) and in what dashboard views matter to them (effort distribution, not billable $).

**Secondary user:** hourly consultants, who gain the option to tag entries with effort kinds if they find it useful. Their existing flow is untouched.

## 2. Non-goals

- **No agency-wide aggregation.** This v0 is a per-consultant view. Cross-consultant roll-ups (agency dashboard, lead leaderboards, company-wide effort distribution) require the aggregation infrastructure described in `docs/superpowers/research/2026-04-14-feature-research.md §4.1` and are a later spec.
- **No auto-pulled effort from Slack / email / calendar APIs.** All effort is entered manually via the Log form. Auto-capture is a later spec under "effort source integrations".
- **No AI-generated narratives or recommendations.** Explicitly deferred per user direction. Comes later once there is meaningful historical data to train on.
- **No effort weights or priorities.** Every effort activity counts as its own unit (`effort_count: 1` by default, or N for batching). Weighting workshops as "10× a Slack" is a layer we can add if count-based analysis proves insufficient.
- **No new partner / tenant.** HubSpot leads belong to the existing partner(s). No changes to `public/partners/**` or the first-run partner-selection flow.
- **No new authentication path.** Same PAT-based auth. No role system beyond the new `profile.logging_mode`.
- **No forced retroactive tagging.** Entries logged before schema v4 stay as they were; dashboards handle "no effort tagged" gracefully.
- **No zero-hours entries.** `hours_hundredths ≥ 1` stays invariant. Even a single Slack message is logged as at least 0.01h — honoring the existing calc, rate, and golden-fixture contracts.

## 3. Research

Activities surveyed across HubSpot solutions-partner agencies (SmartBug, RevPartners, Huble, Bluleadz, Unlimited Tech, Stratagon) and HubSpot's own Partner Onboarding guide. The day-to-day work factors into five distinct categories. These categories drive the `EffortKind` enum and the dashboard's derived groupings.

### 3.1 Client-sync (synchronous meetings)

- **Workshops / discovery / scoping sessions** — structured multi-hour blocks
- **Meetings** — kickoff calls, weekly syncs, status calls, working sessions, client 1:1s
- **Client training** — formal enablement sessions (virtual or on-site)

### 3.2 Technical execution

- **Config work** — HubSpot portal setup, user permissions, property definitions
- **Build** — custom modules, templates, workflows, automations
- **Integration** — connectors, APIs, webhooks, middleware setup
- **Data work** — migration, cleaning, dedup, mapping, validation
- **Reporting** — dashboards, reports, alerting
- **QA / UAT** — testing, validation, pre-launch sign-off

### 3.3 Client-async (asynchronous communication)

- **Slack** — messages / Teams / quick pings
- **Email** — threaded updates, Q&A, handoffs
- **Async video** — Loom, recorded walkthroughs
- **Tickets** — Jira, Zendesk, support-desk responses

### 3.4 Internal

- **Internal sync** — team stand-ups, planning, retros, internal 1:1s
- **Documentation** — internal runbooks, training materials, wiki
- **Peer review** — config reviews, code reviews, data validation reviews

### 3.5 Enablement / growth

- **Learning** — certifications, new-feature research, self-directed training
- **Scoping** — pre-sales input, SOW contributions

### 3.6 Catch-all

- **Other** — anything that doesn't map cleanly; UI exposes a description hint prompting the user to specify what it was. Rolls up into the `enablement` category for aggregation (§5.3). Dashboards may also surface `other` as its own line when the count is non-trivial.

## 4. Architecture decisions (locked from brainstorming 2026-04-14)

| # | Decision | Rationale |
|---|---|---|
| 1 | Effort is a tag on `Entry`, not a separate stream | Preserves calc / hash / validator / golden-fixture invariants. One unified data model; effort is an optional overlay. |
| 2 | `hours_hundredths` remains required (min 1 = 0.01h) | Honors "effort can correspond to hours" constraint. Every activity has some time; Slack pings log as 0.01h. Avoids breaking any calc code. |
| 3 | `effort_count` is a raw count, not a weighted score | Simplest model; weighting is a late-binding analytics concern we can add later. |
| 4 | 19-kind enum under 5 categories | Grounded in research. Kinds are the granularity users pick from; categories are the derived grouping for dashboards. Adding new kinds is additive (no schema bump). |
| 5 | `profile.logging_mode: 'hours' \| 'effort' \| 'both'` controls UI emphasis | HubSpot leads flip to `'effort'` once; UI promotes effort fields and defaults billable to `'non_billable'`. Default `'hours'` preserves every current user's flow. |
| 6 | v0 is per-consultant only; no agency-wide roll-up | Aligned with "iterate as we collect data" — ship the capture surface first, design analytics once there's signal. |
| 7 | Auto-capture from Slack/email/calendar is deferred | Manual logging first. Integrations come in later spec once the data model is proven. |
| 8 | Hash canonicalization emits effort fields only when non-null | Legacy entries (pre-v4) hash identically; March 2026 golden fixture unchanged. Gate A preserved. |
| 9 | Category is a derived function, not stored | Single source of truth for the kind→category mapping. Dashboards and filters compute it on the fly. |
| 10 | Calendar-sourced entries auto-tag `effort_kind: 'meeting'` on apply | Every calendar event is definitionally a meeting. Still overridable before save. |

## 5. Data model

### 5.1 Schema bump v3 → v4

`schemas/entries.schema.json` adds two optional fields and bumps the version:

```jsonc
{
  "schema_version": { "enum": [1, 2, 3, 4] },
  "entries": {
    "items": {
      "properties": {
        // ...all existing v3 fields unchanged...
        "effort_kind": {
          "oneOf": [
            { "type": "null" },
            { "enum": [
              "workshop", "meeting", "client_training",
              "config_work", "build", "integration", "data_work", "reporting", "qa",
              "slack", "email", "async_video", "ticket",
              "internal_sync", "documentation", "peer_review",
              "learning", "scoping",
              "other"
            ]}
          ]
        },
        "effort_count": {
          "oneOf": [
            { "type": "null" },
            { "type": "integer", "minimum": 1, "maximum": 100 }
          ]
        }
      }
    }
  }
}
```

The validator wrapper (`src/schema/validators.ts`) additionally enforces the cross-field constraint: **both null or both set**. A v4 entry with `effort_kind` set and `effort_count: null` (or vice versa) is rejected.

### 5.2 `EffortKind` and `EffortCategory` types

New types in `src/schema/types.ts`:

```ts
export type EffortKind =
  | 'workshop' | 'meeting' | 'client_training'
  | 'config_work' | 'build' | 'integration' | 'data_work' | 'reporting' | 'qa'
  | 'slack' | 'email' | 'async_video' | 'ticket'
  | 'internal_sync' | 'documentation' | 'peer_review'
  | 'learning' | 'scoping'
  | 'other';

export type EffortCategory =
  | 'client_sync'
  | 'technical'
  | 'client_async'
  | 'internal'
  | 'enablement';

export type Entry = {
  // ...existing v3 fields unchanged
  effort_kind: EffortKind | null;
  effort_count: number | null;
};

export type EntriesFile = {
  schema_version: 1 | 2 | 3 | 4;
  month: string;
  entries: Entry[];
};
```

### 5.3 Category derivation (pure)

New file `src/calc/effort-categories.ts`:

```ts
export function categoryOf(kind: EffortKind): EffortCategory {
  switch (kind) {
    case 'workshop':
    case 'meeting':
    case 'client_training':
      return 'client_sync';
    case 'config_work':
    case 'build':
    case 'integration':
    case 'data_work':
    case 'reporting':
    case 'qa':
      return 'technical';
    case 'slack':
    case 'email':
    case 'async_video':
    case 'ticket':
      return 'client_async';
    case 'internal_sync':
    case 'documentation':
    case 'peer_review':
      return 'internal';
    case 'learning':
    case 'scoping':
    case 'other':
      return 'enablement';
  }
}
```

Totality is enforced by TypeScript's exhaustive switch — adding a new `EffortKind` value will fail to compile until it's mapped.

### 5.4 Version compatibility matrix

| File's `schema_version` | Reader behavior | Writer behavior |
|---|---|---|
| `1` (pre-calendar) | Validator accepts. Backfills: `source_ref: null`, `effort_kind: null`, `effort_count: null`. | Any write upgrades file to `schema_version: 4`; commit message carries `[schema v1→v4]`. |
| `2` (calendar) | Validator accepts. Backfills: lifts `source_event_id` to `source_ref`, then `effort_kind: null`, `effort_count: null`. | Any write upgrades file to `schema_version: 4`; commit message carries `[schema v2→v4]`. |
| `3` (generalized source_ref) | Validator accepts. Backfills: `effort_kind: null`, `effort_count: null`. | Any write upgrades file to `schema_version: 4`; commit message carries `[schema v3→v4]`. |
| `4` (effort tracking) | Validator accepts. No backfill needed. | Writes stay at v4; no suffix. |

Historical files stay at their on-disk version until something writes them. Snapshot-closed months preserve their schema version forever — snapshot immutability holds.

### 5.5 Hash invariance (Gate A)

`canonicalizeEntriesForHashing` (`src/calc/hash.ts`) extends the existing v3 projection. Effort fields emit **only when non-null**, mirroring the `source_ref` pattern:

```ts
function canonicalizeEntry(e: Entry): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: e.id,
    project: e.project,
    date: e.date,
    hours_hundredths: e.hours_hundredths,
    rate_cents: e.rate_cents,
    rate_source: e.rate_source,
    billable_status: e.billable_status,
    bucket_id: e.bucket_id,
    description: e.description,
    review_flag: e.review_flag,
    created_at: e.created_at,
    updated_at: e.updated_at,
  };
  if (e.effort_kind !== null) base.effort_kind = e.effort_kind;
  if (e.effort_count !== null) base.effort_count = e.effort_count;
  const source = canonicalSource(e.source_ref);
  for (const [k, v] of Object.entries(source)) {
    base[k] = v;
  }
  return base;
}
```

Verification: `npm run test:golden` and the March 2026 regression fixture must pass **unchanged** after this work lands. Any movement in existing hashes is a bug in the canonicalization.

### 5.6 Profile schema extension

`schemas/profile.schema.json` adds one optional field. No version bump — this is an additive change to a schema that already tolerates optional fields.

```jsonc
{
  "properties": {
    // ...existing fields...
    "logging_mode": {
      "enum": ["hours", "effort", "both"]
    }
  }
}
```

Validator behavior: missing field → treated as `'hours'` in-memory. No backfill written to disk unless the profile is otherwise edited.

`src/schema/types.ts` `Profile` gains `logging_mode?: 'hours' | 'effort' | 'both'`.

### 5.7 `FormState` extension

`src/ui/screens/log/form-helpers.ts` `FormState` gains two fields that mirror the schema:

```ts
export type FormState = {
  // ...existing
  effort_kind: EffortKind | null;
  effort_count: number | null;
};

export const initialForm: FormState = {
  // ...existing defaults
  effort_kind: null,
  effort_count: null,
};
```

`buildEntry` passes them through to the constructed `Entry` unchanged.

## 6. UI

### 6.1 `LogForm` — inline Activity + Count row

A new row sits between the Hours+chips block and the Bucket row:

```
Date              [...]
Project           [Select]
Hours             [input]  0.01 0.1 0.25 0.5 1 ...  (existing chips)
Activity          [Select ▾]       Count  [  1  ]    ← NEW
Bucket            [Select]
Status            ( ) billable  ( ) non-billable  ( ) needs-review
Rate              [input]
Description       [textarea]
```

- **Activity select** uses `<optgroup>` to present 19 kinds under the 5 category headers (plus the "Other" fallback).
- **Count input** is only rendered when Activity ≠ null. Integer input, min 1, max 100, default 1.
- **Logging mode adaptation:** when `profile.logging_mode === 'effort'`, the Activity row moves **above** Hours (effort is primary), and the Rate + Status fields are collapsed into an "Advanced" disclosure. When `'hours'`, layout is unchanged from today. When `'both'`, all fields visible in natural top-to-bottom order.

### 6.2 `QuickActivityCard` — new Assist-panel card

A third card joins Timer and Calendar in `LogHelpersPanel`. Designed for HubSpot leads who fire off many small async activities through the day.

```
┌ QUICK ACTIVITY                    [SapienEx mark] ┐
│                                                    │
│   + Slack message      + Email thread             │
│   + Meeting            + Workshop                 │
│   + Documentation      + Other                    │
│                                                    │
│   Uses the project currently selected.            │
└────────────────────────────────────────────────────┘
```

Click behavior:

1. Reads the form's current `projectId` + `date`.
2. If no project is selected, bounce the Project field with a red outline pulse + tooltip "pick a project first". No toast, no popover.
3. Otherwise, **pre-fill the form** (not auto-save):
   - `effort_kind`: the clicked kind
   - `effort_count`: 1
   - `hours_hundredths`: sensible default per kind — `slack: 2`, `email: 10`, `meeting: 100`, `workshop: 200`, `documentation: 50`, `other: 25`
   - `description`: left empty; user types what it was
4. Fire the per-field magic-fill animation with a **new amber-orange tone** distinct from Calendar indigo and Timer amber, so users learn "this tone = activity prefill".

### 6.3 `Entries` display and filter

- **Row display:** a compact badge column next to the hours column shows `effort_kind × count` with the category tint (5-way palette §7.4). Entries without effort_kind leave the column empty.
- **Filter:** the existing Entries filter bar gains an "Activity type" optgroup'd Select with the same structure as the Log form. Combines with current project/date/status filters.

### 6.4 Timer integration

`TimerInlineEdit` (inside the Timer card, visible during run/paused) gains a third Select for `effort_kind`. Changes propagate to both the form (`setForm`) and the session snapshot (`updateSnapshot`), matching the existing project/bucket pattern. On timer load, the effort_kind (if any) is already in the form via the inline-edit sync path.

`TimerSession.snapshot` gains `effort_kind: EffortKind | null` in `src/store/timer-session.ts`. `HistoricalRecording` gains the same field so redrives restore full context.

### 6.5 Calendar integration

`applySuggestion` in `QuickLog.tsx` auto-sets `effort_kind: 'meeting'` and `effort_count: 1` when applying a calendar event. User can override before save. This is a small two-line addition — leverages the existing `applySuggestion` path.

### 6.6 CSV export

`src/export/csv.ts` appends two columns at the end of the existing CSV header: `effort_kind`, `effort_count`. Null fields export as empty strings (not `"null"` or `"undefined"`). Existing column order is preserved — scripts consuming current exports keep working.

## 7. Dashboard (v0, per-consultant)

### 7.1 `EffortSummaryCard` (new)

New component `src/ui/screens/dashboard/EffortSummaryCard.tsx`. Rendered next to the existing hours totals card on the Dashboard.

```
┌ EFFORT · April                                     ┐
│                                                    │
│   47  activities           split by category       │
│                            ▓▓▓▓▓▓ client-sync  18  │
│   12 workshops             ▓▓▓▓ technical      14  │
│    8 meetings              ▓▓ client-async    11  │
│   24 async pings           ▓ internal          3  │
│    3 internal syncs        ▏ enablement        1  │
└────────────────────────────────────────────────────┘
```

- Total = `sum(effort_count)` for entries this month where `effort_kind !== null`.
- Top-3 kinds-by-count on the left (text list).
- Horizontal stacked bar on the right by category (5-way palette).
- Click the card → navigates to Entries pre-filtered to "has activity type, this month".
- Empty state: when no entries this month have effort tagged, the card says "No activities tagged this month" with a CTA "Log an activity →" that focuses the Log screen's Activity field.

### 7.2 Per-project effort column

The existing per-project breakdown table on the Dashboard gains one column at the right:

```
Project          Billable    $       Non-bill  Review   Effort
Acme             12.5h       1,562   0.5h      0h       23 acts
Globex           4.25h       531     0h        0h       5 acts
Internal         —           —       3h        0h       2 acts
```

- `Effort` = `sum(effort_count)` across entries in that project this month where `effort_kind !== null`.
- Tooltip on hover reveals category split (mini stacked bar, same palette).

### 7.3 Calendar modal — daily effort row

The existing calendar modal (daily bar chart of hours) gains a small mono row under each day's bar:

```
  ██ 2.5h
    12 acts
```

Only shown when a day has `effort_kind !== null` entries. Zero is omitted. Text in `slate-500`. No color split at the daily granularity — keeps the modal compact.

### 7.4 Color palette

Shared across every effort surface (summary card bar, per-project tooltips, Entries badges, Quick Activity buttons):

| Category | Color | Hex |
|---|---|---|
| Client-sync | partner-cyan | `#6BCFEE` |
| Technical | slate-700 | `#334155` |
| Client-async | indigo-500 | `#6366F1` |
| Internal | amber-500 | `#F59E0B` |
| Enablement | emerald-500 | `#10B981` |

## 8. Calc module

### 8.1 `computeMonthEffort`

New function in `src/calc/effort.ts`:

```ts
export type MonthEffortTotals = {
  month: string;
  total_activities: number;
  by_kind: Record<EffortKind, number>;
  by_category: Record<EffortCategory, number>;
  per_project: Array<{
    project: string;
    total_activities: number;
    by_kind: Record<EffortKind, number>;
  }>;
};

export function computeMonthEffort(
  args: { entries: Entry[] },
  month: string,
): MonthEffortTotals;
```

Month-scoped the same way `computeMonthTotals` is. Only entries whose `date` starts with the target month and whose `effort_kind !== null` are included. Pure function, no I/O.

### 8.2 Invariants (property tests)

- **Conservation:** `sum(by_category) === total_activities` for any entry set.
- **Additivity:** `sum(per_project.total_activities) === total_activities`.
- **Month scoping:** entries outside the target month contribute zero.
- **Category mapping is total:** every `EffortKind` maps to exactly one `EffortCategory` (checked via exhaustive switch compile error + runtime property test).
- **Null-effort entries ignored:** entries with `effort_kind === null` never appear in any aggregate.

### 8.3 Extension of existing `computeMonthTotals`

The existing `computeMonthTotals` is **unchanged structurally** — it still returns hours/billable totals. A sibling `per_project_effort_count` field is added as an optional extension, populated by composing `computeMonthEffort`. The existing billable-hours / billable-$ invariants are untouched.

## 9. File structure

### 9.1 New files

- `src/calc/effort.ts` — `computeMonthEffort`, `MonthEffortTotals`
- `src/calc/effort-categories.ts` — `categoryOf(kind): EffortCategory` pure mapping
- `src/ui/components/EffortBadge.tsx` — "slack ×3" pill with category tint, used in Entries and Quick Activity
- `src/ui/components/EffortKindSelect.tsx` — reusable Select with optgroup structure
- `src/ui/screens/dashboard/EffortSummaryCard.tsx` — this-month effort summary
- `src/ui/screens/log/QuickActivityCard.tsx` — Assist-panel quick-log buttons
- `tests/schema/entry-v4-migration.test.ts` — v1/v2/v3/v4 acceptance + backfills + cross-field rejection
- `tests/calc/effort.test.ts` — unit tests for aggregation
- `tests/calc/effort-property.test.ts` — fast-check invariants
- `tests/calc/hash-v4.test.ts` — hash invariance across v3→v4 boundary
- `tests/data/entries-repo-v4.test.ts` — upgrade-path-on-write tests
- `tests/export/csv-effort.test.ts` — effort columns in CSV
- `docs/architecture/effort-kinds.md` — reference doc for the 19 kinds with descriptions, examples, and the rule for adding new kinds

### 9.2 Modified files

- `schemas/entries.schema.json` — `schema_version 4`, `effort_kind`, `effort_count`
- `schemas/profile.schema.json` — `logging_mode` optional enum
- `src/schema/types.ts` — `EffortKind`, `EffortCategory`, `Entry.effort_*`, `Profile.logging_mode`, `EntriesFile.schema_version`
- `src/schema/validators.ts` — accept v1/v2/v3/v4; backfill `effort_*` on read; enforce cross-field constraint; profile validator unchanged (optional field self-validates)
- `src/calc/hash.ts` — `canonicalizeEntry` emits effort fields when non-null (Gate A-sensitive)
- `src/calc/totals.ts` — optional `per_project_effort_count` composition
- `src/calc/index.ts` — re-export `computeMonthEffort`, `categoryOf`
- `src/data/entries-repo.ts` — `upgradeEntriesFileToV4` replaces v3 helper; upgrade paths for v1/v2/v3; commit message suffix logic
- `src/data/commit-messages.ts` — schema-upgrade suffix extended to v4
- `src/store/timer-session.ts` — `Form.effort_kind`, `HistoricalRecording.effort_kind`
- `src/store/timer-store.ts` — `updateSnapshot` accepts `effort_kind`
- `src/ui/screens/log/form-helpers.ts` — `FormState.effort_*`, `initialForm` defaults, `buildEntry` passthrough
- `src/ui/screens/log/LogForm.tsx` — Activity + Count row, `logging_mode`-driven layout variation
- `src/ui/screens/log/LogHelpersPanel.tsx` — host `QuickActivityCard` as third card
- `src/ui/screens/log/TimerInlineEdit.tsx` — Activity Select
- `src/ui/screens/QuickLog.tsx` — wire effort flash fields; calendar applySuggestion auto-tag meeting
- `src/ui/screens/Entries.tsx` — Activity filter Select; `EffortBadge` column
- `src/ui/screens/Dashboard.tsx` — render `EffortSummaryCard`; per-project effort column
- `src/ui/screens/dashboard/CalendarModal.tsx` — per-day effort count under bar
- `src/ui/screens/Settings.tsx` — new control for `profile.logging_mode` (Select: Hours / Effort / Both); writes through the existing profile-write path
- `src/data/profile-repo.ts` (if distinct from first-run writer) — passthrough for the new optional `logging_mode` field; no new API surface
- `src/export/csv.ts` — effort columns in CSV header + row output
- Existing test fixtures where `Entry` literals appear: `tests/calc/bulk-rate.test.ts`, `tests/calc/daily.test.ts`, `tests/calc/drift.test.ts`, `tests/calc/hash.test.ts`, `tests/calc/property.test.ts`, `tests/calc/totals.test.ts`, `tests/data/entries-repo.test.ts`, `tests/data/entries-repo-v3.test.ts`, `tests/export/csv.test.ts`, `tests/schema/entry-v3-migration.test.ts` — append `effort_kind: null, effort_count: null` to each literal
- `tests/store/timer-session.test.ts`, `tests/store/timer-store.test.ts` — `Form` literals and snapshot expectations include `effort_kind: null`

### 9.3 Unchanged (must remain green)

- `tests/fixtures/2026-03-golden.json`, `tests/fixtures/2026-03-expected.json` — immutable regression. Byte-for-byte hash preservation.
- `src/calc/int.ts` — integer math primitives, unaffected.

## 10. Testing strategy

All tests follow the CLAUDE.md conventions: full-sentence test names, unit + property + schema + integration coverage.

### 10.1 Schema

- Validator accepts v1 file with no effort fields; backfills `effort_kind: null, effort_count: null`.
- Validator accepts v2 file with `source_event_id`; lifts to `source_ref`; backfills effort fields null.
- Validator accepts v3 file; backfills effort fields null.
- Validator accepts v4 file with `effort_kind` set and `effort_count: 1`.
- Validator rejects v4 with `effort_kind` null but `effort_count: 5`.
- Validator rejects v4 with `effort_kind: 'workshop'` but `effort_count: null`.
- Validator rejects v4 with `effort_kind: 'slack'` and `effort_count: 0` (min 1).
- Validator rejects v4 with `effort_kind: 'slack'` and `effort_count: 101` (max 100).
- Validator rejects v4 with unknown `effort_kind` value.
- Validator does NOT mutate input (structuredClone pattern from v3 work).

### 10.2 Hash (Gate A)

- v4 entry with `effort_kind: null, effort_count: null` hashes identically to the equivalent v3 entry.
- March 2026 golden fixture hash unchanged after full codepath runs.
- Tagging a previously-null entry with `effort_kind: 'slack', effort_count: 1` changes its hash.
- Changing `effort_count` on a tagged entry changes its hash.
- Changing `effort_kind` on a tagged entry changes its hash.
- Key order in canonical JSON is deterministic across shuffles of entry arrays.

### 10.3 Calc

- `computeMonthEffort` on empty month → zeros for every kind and category.
- Single workshop entry → `by_kind.workshop: 1`, `by_category.client_sync: 1`, `total_activities: 1`.
- 3 Slack + 2 emails to one project → correct per-project breakdown.
- Cross-month entries excluded.
- Null-effort entries excluded from every aggregate.
- `categoryOf` total for every kind (exhaustive switch + runtime assertion on every kind).

### 10.4 Property

- **Conservation:** `sum(by_category) === total_activities`.
- **Additivity:** `sum(per_project.total_activities) === total_activities`.
- **Month scoping:** entries outside target month never contribute.
- **Null-effort ignored:** adding a null-effort entry to any input doesn't change `MonthEffortTotals`.

### 10.5 Writer upgrade path

- `addEntry` on v1 file → file upgrades to v4; commit message contains `[schema v1→v4]`.
- `addEntry` on v3 file → file upgrades to v4; commit message contains `[schema v3→v4]`.
- `addEntry` on v4 file → no schema suffix.
- Upgrade preserves existing entries' `source_ref` and backfills `effort_*` as null.
- Retry semantics: per-attempt message construction still sees the correct on-disk version.

### 10.6 CSV export

- Header row ends with `...,effort_kind,effort_count`.
- Row with `effort_kind: 'slack', effort_count: 3` exports as `...,slack,3`.
- Row with null effort exports as `...,,` (empty strings).
- Existing column order unchanged before the append.

### 10.7 Golden regression

- `npm run test:golden` passes **unchanged** after this feature lands. March 2026 totals, source hash, and snapshot immutability all hold.
- Gate A acceptance requires property + golden + independent code-reviewer pass per CLAUDE.md.

## 11. Documentation impact

This spec drives concrete updates to multiple docs during implementation. Each is called out so the plan can schedule them.

### 11.1 `CLAUDE.md`

- **"Non-negotiable invariants" section** — add: *"Entry v4 schema: `effort_kind` and `effort_count` are both-null-or-both-set. Validator enforces. Do not log zero-hours entries even for lightweight activities — `hours_hundredths ≥ 1` stays."*
- **"Do-not-touch-without-review list"** — extend the `src/calc/**` entry to reference `src/calc/effort.ts` and `src/calc/effort-categories.ts` as additionally Gate A-sensitive (they change totals and category mapping used by dashboards).
- **Run commands** — no new scripts.
- **Where to find things** map — add:
  - `src/calc/effort.ts → all effort aggregation (pure, Gate A)`
  - `src/calc/effort-categories.ts → kind → category mapping (pure, Gate A)`
- **Common tasks** — add a row: *"Add a new effort kind → `docs/architecture/effort-kinds.md`"*.
- **When to STOP and ask** — no changes (schema v4 is a v-bump that follows the existing "stop and ask" rule already captured).
- **Cross-reference** — add a link to this spec: `docs/superpowers/specs/2026-04-14-effort-tracking-design.md`.

### 11.2 Architecture playbooks

- **`docs/architecture/adding-a-field.md`** — append a v3 → v4 migration section using the same pattern as the v2 → v3 case, documenting the `effort_kind` / `effort_count` addition, the both-null-or-both-set constraint, and the hash-canonicalization pattern (emit only when non-null).

- **`docs/architecture/calc-invariants.md`** — add an "Effort invariants" section enumerating the four property invariants from §10.4 above plus the categoryOf totality check. Reference the property tests in `tests/calc/effort-property.test.ts`.

- **`docs/architecture/data-flow.md`** — extend the Log-write data-flow to show effort fields threading through `FormState → buildEntry → addEntry → entries file`. Extend the Dashboard read-flow to show effort aggregation via `computeMonthEffort`. Add a small box covering the `logging_mode`-driven UI adaptation.

- **`docs/architecture/partner-onboarding.md`** — **unchanged**. Effort kinds are app-global; partner config has no effort-related settings.

- **`docs/architecture/rate-change-sop.md`** — **unchanged**.

- **`docs/architecture/data-repo-scaffold.md`** — unchanged. No new files in the data repo.

- **`docs/architecture/google-calendar-setup.md`** — minor note added mentioning calendar-sourced entries auto-tag `effort_kind: 'meeting'` on apply.

### 11.3 New doc: `docs/architecture/effort-kinds.md`

New reference doc capturing:
- The 19 `EffortKind` values with one-line descriptions and an example log entry for each
- The 5 `EffortCategory` values and which kinds roll up into each
- The color palette (§7.4)
- **Rules for adding a new kind**: (a) pick the category it belongs to; (b) extend the `EffortKind` union in `types.ts` and the JSON schema enum; (c) add a case in `categoryOf`; (d) update this doc; (e) no schema version bump needed, additive change. (f) golden fixture unaffected because no existing entry will have the new kind.

### 11.4 `docs/superpowers/backlog.md`

- Add to "Shipped" once implementation merges: *"Effort tracking — 19-kind taxonomy, Quick Activity card, Dashboard EffortSummaryCard, per-consultant v0. HubSpot lead mode via `profile.logging_mode`. Cross-consultant agency aggregation deferred."*
- Move the "AI-native effort analytics" idea explicitly to "Speculative" (it was already in the catalog; this is just re-pointing at the parked research doc).

### 11.5 `docs/superpowers/research/2026-04-14-feature-research.md`

- Cross-reference: add a note in §5 (AI-native features) that effort data is now the primary substrate for many of those ideas (AI8 work-type classification becomes trivial with effort_kind labels; AI6 weekly narrative has cleaner inputs; AI13 project scope planner can correlate kinds-over-time).
- Update the "parked" Activity-Monitoring section to mention effort as a complementary manual signal that doesn't require the desktop-agent backend.

## 12. Rollout / risks

| Risk | Mitigation |
|---|---|
| Schema v4 breaks a historical snapshot's hash | §5.5 canonicalization is exhaustively tested against the March 2026 fixture. Gate A re-dispatch required per CLAUDE.md before merging. |
| 19 kinds feel overwhelming to users | Optgroup-by-category organization; Quick Activity card surfaces the top 6 for 90%+ of daily log actions. |
| `effort_count` misused (negative, fractional, huge numbers) | Schema enforces integer 1..100; validator rejects; form input constrained with `type="number"` min/max. |
| Users tempted to log zero-hours Slack pings | UI enforces `min="0.01"`; schema stays at `hours_hundredths ≥ 1`; tooltip on first effort-only log mentions "even a Slack ping takes a moment — round up to 0.01h". |
| `logging_mode` creates two parallel UIs that drift | One component, conditionally-styled. Unit-tested in both modes. Default is `'hours'` — zero impact on current users. |
| Existing test fixtures blow up from Entry literal changes | Append `effort_kind: null, effort_count: null` mechanically; typecheck will surface any miss. Low-risk repetitive edit. |
| Calendar auto-tag `meeting` conflicts with user intent | Override is one Select change in the form before Save. Dismiss the auto-tag by selecting `— none —` in the Activity select. |
| Adding a new `EffortKind` value at runtime fails silently | Exhaustive switch in `categoryOf` forces compile error until mapping is added. Schema enum rejects unknown values at validation time. |

## 13. Deferred (later specs)

The following are intentionally out of scope for this spec. Each deserves its own spec → plan → implementation cycle:

- **Agency-wide effort dashboard** — cross-consultant roll-up, per-lead distribution, trend lines, effort-by-client views. Requires aggregation infrastructure per `docs/superpowers/research/2026-04-14-feature-research.md §4.1`.
- **Effort source integrations** — automatic pulling of effort from Slack, email (Gmail/Outlook), calendar, Jira, Zendesk. Follows the calendar-integration pattern established in `2026-04-14-log-redesign-calendar-integration-design.md`.
- **Effort weights / priorities** — e.g., workshop = 10 units, Slack = 0.5 units. Add once raw-count analysis shows this is needed.
- **Effort budgets / targets** — "plan 8 workshops this quarter, 200 client-async activities". Requires a budgeting UI akin to bucket budgets.
- **AI-native features on effort data** — weekly narratives, anomaly detection, work-type classification, proposal generation. See research doc §5 for the full catalog.
- **Per-partner kind customization** — partners hide/show/rename kinds. Not needed until a partner asks.
- **Historical backfill tools** — "tag all my past meetings as effort_kind: meeting". Deferred; can be scripted ad-hoc if needed.

## 14. Acceptance criteria

- [ ] Schema v4 accepted by validator; every legacy version (v1/v2/v3) backfills cleanly.
- [ ] Cross-field constraint (`effort_kind` and `effort_count` both null or both set) enforced and tested.
- [ ] Hash invariance: March 2026 golden fixture passes byte-for-byte unchanged.
- [ ] `computeMonthEffort` passes all unit and property tests including conservation, additivity, month-scoping, null-effort-ignored.
- [ ] `categoryOf` is an exhaustive total mapping (TypeScript-enforced + runtime tested).
- [ ] Log form renders Activity + Count row; `logging_mode: 'effort'` reorders and collapses hours-focused fields.
- [ ] Quick Activity card fires per-field magic-fill with a new amber-orange tone distinct from Calendar and Timer.
- [ ] Entries list shows badge column + Activity filter; both work independently of existing filters.
- [ ] Dashboard renders EffortSummaryCard and per-project effort column; empty state handled.
- [ ] Calendar modal shows daily effort count when non-zero.
- [ ] CSV export includes `effort_kind` and `effort_count` columns; null exports as empty string.
- [ ] Calendar suggestion auto-tags `effort_kind: 'meeting'`; override works.
- [ ] Timer inline-edit adds Activity select; session snapshot persists it; redrive restores it.
- [ ] `profile.logging_mode` setting in Settings persists and drives UI mode.
- [ ] `npm run typecheck && npm run lint && npm test && npm run test:golden && npm run test:property && npm run build` all pass.
- [ ] Gate A review (independent code-reviewer) dispatched and clean before merge.
- [ ] All documentation updates per §11 landed in the same PR.
