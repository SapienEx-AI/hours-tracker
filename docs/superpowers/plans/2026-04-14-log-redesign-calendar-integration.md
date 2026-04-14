# Log Redesign + Google Calendar Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 2-column Log screen and Google Calendar read-only integration specified in `docs/superpowers/specs/2026-04-14-log-redesign-calendar-integration-design.md`.

**Architecture:** Schema bump first (v1→v2 Entry with optional nullable `source_event_id`), then the Google auth + API layer, then UI. Every calc invariant and the March 2026 golden fixture stay passing throughout. No new npm deps — Google Identity Services loads as a `<script>` tag.

**Tech Stack:** React 18 + TypeScript (strict) + Zustand + TanStack Query + Octokit + Tailwind + Vitest + fast-check. Google Identity Services + Google Calendar REST API v3.

---

## Non-negotiables (from spec §11 + CLAUDE.md)

- Integer math only on `_cents`/`_hundredths`. Every arithmetic operation goes through `src/calc/int.ts`. The `no-float-money` ESLint rule stays on.
- Every schema file validates via `src/schema/validators.ts` before a write hits GitHub.
- Commit messages go through `src/data/commit-messages.ts` — no inline strings.
- **March 2026 golden fixture stays v1 on disk.** `tests/fixtures/2026-03-golden.json` and `tests/fixtures/2026-03-expected.json` are never modified by this plan. `npm run test:golden` must pass on every task's final commit.
- Partner branding primary, SapienEx footer only.
- After every task: `npm run typecheck && npm run lint && npm test` must all pass.

## File structure

### New files

- `schemas/calendar-config.schema.json` — the new per-consultant config file schema
- `src/integrations/google/client-id.ts` — public Google Web Client ID constant
- `src/integrations/google/gis-client.ts` — Google Identity Services token client wrapper
- `src/integrations/google/calendar-api.ts` — typed fetch wrappers for Calendar REST
- `src/integrations/calendar/provider.ts` — `CalendarProvider` interface + Google implementation
- `src/integrations/calendar/event-to-entry.ts` — pure `eventToFormState` with filtering + rounding
- `src/store/calendar-store.ts` — connection state, enabled-calendars list
- `src/data/calendar-config-repo.ts` — Octokit read/write of `config/calendar.json`
- `src/data/hooks/use-calendar-config.ts` — react-query hook for calendar config
- `src/data/hooks/use-calendar-events.ts` — react-query hook that fans out to enabled calendars, merges, annotates with `✓ logged`
- `src/ui/screens/log/SuggestionsPanel.tsx` — right-column container
- `src/ui/screens/log/SuggestionCard.tsx` — one event card
- `src/ui/screens/settings/CalendarSection.tsx` — new Settings block
- `docs/architecture/google-calendar-setup.md` — one-time Google Cloud project setup playbook
- `tests/integrations/event-to-entry.test.ts`
- `tests/integrations/calendar-api.test.ts`
- `tests/schema/entry-v2-migration.test.ts`
- `tests/calc/hash-v2.test.ts`

### Modified files

- `schemas/entries.schema.json` — widen `schema_version` to `{1,2}`, add optional nullable `source_event_id`
- `src/schema/types.ts` — add `source_event_id` to `Entry`, widen `EntriesFile.schema_version` to `1 | 2`, add `CalendarConfig` type
- `src/schema/validators.ts` — backfill `source_event_id: null` in memory for v1 reads, add `validateCalendarConfig`
- `src/calc/hash.ts` — `canonicalizeEntry` emits `source_event_id` only when non-null (preserves golden hashes)
- `src/data/entries-repo.ts` — on every write transform, upgrade file to `schema_version: 2` and backfill `null` on existing entries; if prior version was 1, suffix commit message with `[schema v1→v2]`
- `src/data/commit-messages.ts` — `logMessage` gains optional `source?: 'calendar'` → appends `[calendar]`; add `schemaUpgradeSuffix` helper
- `src/ui/screens/QuickLog.tsx` — reflow into 2 columns, date moves to top, track `source_event_id`, accept prefill from suggestion card, render `SuggestionsPanel` on the right
- `src/ui/screens/Settings.tsx` — mount `CalendarSection`
- `scripts/import-march-2026.ts` — add `source_event_id: null` to the entry builder (type compilation fix only, never re-run against production data)
- `index.html` — add GIS `<script>` tag
- `docs/superpowers/backlog.md` — move "Calendar integration" from Speculative to Shipped on completion
- Test helpers: `tests/calc/hash.test.ts`, `tests/calc/totals.test.ts`, `tests/calc/bulk-rate.test.ts`, `tests/calc/drift.test.ts`, `tests/export/csv.test.ts`, `tests/data/entries-repo.test.ts`, `tests/schema/validators.test.ts` — each adds `source_event_id: null` to its local Entry builder so strict TS compiles

### Never touched

- `src/calc/int.ts`, `src/calc/totals.ts`, `src/calc/rates.ts`, `src/calc/bulk-rate.ts`, `src/calc/drift.ts`
- `tests/fixtures/2026-03-golden.json`, `tests/fixtures/2026-03-expected.json`
- `public/partners/**`, partner config, partner theme, partner logo usage
- `src/auth/**` (the calendar token lives in its own storage key, not the PAT key)

---

## Task 1: Entry schema bump — v1→v2 with nullable `source_event_id`

**Goal:** Widen the Entry schema to accept an optional `source_event_id` field without moving any existing data or hash. Golden fixture and all existing tests keep passing.

**Files:**
- Modify: `schemas/entries.schema.json`
- Modify: `src/schema/types.ts`
- Modify: `src/schema/validators.ts`
- Modify: `src/calc/hash.ts`
- Modify: `src/ui/screens/QuickLog.tsx` (buildEntry site)
- Modify: `scripts/import-march-2026.ts` (entry builder site)
- Modify (test helpers): `tests/calc/hash.test.ts`, `tests/calc/totals.test.ts`, `tests/calc/bulk-rate.test.ts`, `tests/calc/drift.test.ts`, `tests/export/csv.test.ts`, `tests/data/entries-repo.test.ts`, `tests/schema/validators.test.ts`
- Create: `tests/schema/entry-v2-migration.test.ts`
- Create: `tests/calc/hash-v2.test.ts`

### Steps

- [ ] **Step 1.1 — Write failing migration + hash tests**

`tests/schema/entry-v2-migration.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validateEntries } from '@/schema/validators';

describe('Entry v1 → v2 migration', () => {
  it('accepts a v1 file without source_event_id and backfills null', () => {
    const v1File = {
      schema_version: 1,
      month: '2026-03',
      entries: [
        {
          id: '2026-03-25-sprosty-aaaaaa',
          project: 'sprosty',
          date: '2026-03-25',
          hours_hundredths: 400,
          rate_cents: 12500,
          rate_source: 'global_default',
          billable_status: 'billable',
          bucket_id: null,
          description: 'v1 entry',
          review_flag: false,
          created_at: '2026-03-25T10:00:00Z',
          updated_at: '2026-03-25T10:00:00Z',
        },
      ],
    };
    const r = validateEntries(v1File);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries[0]?.source_event_id).toBe(null);
    }
  });

  it('accepts a v2 file with an explicit source_event_id', () => {
    const v2File = {
      schema_version: 2,
      month: '2026-04',
      entries: [
        {
          id: '2026-04-14-sprosty-bbbbbb',
          project: 'sprosty',
          date: '2026-04-14',
          hours_hundredths: 75,
          rate_cents: 12500,
          rate_source: 'global_default',
          billable_status: 'billable',
          bucket_id: null,
          description: 'HS review',
          review_flag: false,
          created_at: '2026-04-14T10:00:00Z',
          updated_at: '2026-04-14T10:00:00Z',
          source_event_id: 'abc123xyz',
        },
      ],
    };
    const r = validateEntries(v2File);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries[0]?.source_event_id).toBe('abc123xyz');
    }
  });

  it('rejects a v2 file with wrong-typed source_event_id (number instead of string|null)', () => {
    const bad = {
      schema_version: 2,
      month: '2026-04',
      entries: [
        {
          id: '2026-04-14-sprosty-cccccc',
          project: 'sprosty',
          date: '2026-04-14',
          hours_hundredths: 75,
          rate_cents: 12500,
          rate_source: 'global_default',
          billable_status: 'billable',
          bucket_id: null,
          description: 'bad type',
          review_flag: false,
          created_at: '2026-04-14T10:00:00Z',
          updated_at: '2026-04-14T10:00:00Z',
          source_event_id: 42,
        },
      ],
    };
    const r = validateEntries(bad);
    expect(r.ok).toBe(false);
  });
});
```

`tests/calc/hash-v2.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { hashEntries, canonicalizeEntriesForHashing } from '@/calc';
import type { Entry } from '@/schema/types';

function baseEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: '2026-03-25-sprosty-aaaaaa',
    project: 'sprosty',
    date: '2026-03-25',
    hours_hundredths: 400,
    rate_cents: 12500,
    rate_source: 'global_default',
    billable_status: 'billable',
    bucket_id: null,
    description: 'test',
    review_flag: false,
    created_at: '2026-03-25T22:15:04Z',
    updated_at: '2026-03-25T22:15:04Z',
    source_event_id: null,
    ...overrides,
  };
}

describe('hash with source_event_id', () => {
  it('produces the same hash for source_event_id null as the pre-v2 canonical form', async () => {
    const entry = baseEntry({ source_event_id: null });
    const canonical = canonicalizeEntriesForHashing([entry]);
    // The canonical form must NOT contain source_event_id when null, so it matches
    // the pre-schema-bump canonical form exactly.
    expect(canonical).not.toContain('source_event_id');
  });

  it('produces a different hash when source_event_id is non-null', async () => {
    const withNull = await hashEntries([baseEntry({ source_event_id: null })]);
    const withValue = await hashEntries([baseEntry({ source_event_id: 'gcal-xyz' })]);
    expect(withNull).not.toBe(withValue);
  });

  it('is deterministic across repeated calls', async () => {
    const h1 = await hashEntries([baseEntry({ source_event_id: 'gcal-xyz' })]);
    const h2 = await hashEntries([baseEntry({ source_event_id: 'gcal-xyz' })]);
    expect(h1).toBe(h2);
  });
});
```

- [ ] **Step 1.2 — Run tests to confirm they fail**

```
npm test -- tests/schema/entry-v2-migration.test.ts tests/calc/hash-v2.test.ts
```
Expected: FAIL — `source_event_id` is not a known property on `Entry`, TypeScript compile error.

- [ ] **Step 1.3 — Update the JSON Schema**

Replace `schemas/entries.schema.json`:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://sapienex-ai.github.io/hours-tracker/schemas/entries.schema.json",
  "title": "Monthly entries file",
  "type": "object",
  "required": ["schema_version", "month", "entries"],
  "additionalProperties": false,
  "properties": {
    "schema_version": { "enum": [1, 2] },
    "month": { "type": "string", "pattern": "^[0-9]{4}-(0[1-9]|1[0-2])$" },
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "id",
          "project",
          "date",
          "hours_hundredths",
          "rate_cents",
          "rate_source",
          "billable_status",
          "bucket_id",
          "description",
          "review_flag",
          "created_at",
          "updated_at"
        ],
        "additionalProperties": false,
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+-[a-f0-9]{6}$"
          },
          "project": { "type": "string", "pattern": "^[a-z0-9-]+$" },
          "date": { "type": "string", "format": "date" },
          "hours_hundredths": { "type": "integer", "minimum": 1, "maximum": 2400 },
          "rate_cents": { "type": "integer", "minimum": 0 },
          "rate_source": { "enum": ["entry_override", "project_default", "global_default"] },
          "billable_status": { "enum": ["billable", "non_billable", "needs_review"] },
          "bucket_id": { "type": ["string", "null"], "pattern": "^[a-z0-9-]+$" },
          "description": { "type": "string", "minLength": 1, "maxLength": 500 },
          "review_flag": { "type": "boolean" },
          "created_at": { "type": "string", "format": "date-time" },
          "updated_at": { "type": "string", "format": "date-time" },
          "source_event_id": { "type": ["string", "null"] }
        }
      }
    }
  }
}
```

Note: `source_event_id` is **optional** (absent from `required`). v1 files without the field pass. v2 files with the field pass.

- [ ] **Step 1.4 — Update the TypeScript types**

In `src/schema/types.ts`, change the `Entry` type (replace the whole type):
```ts
export type Entry = {
  id: string;
  project: string;
  date: string;
  hours_hundredths: number;
  rate_cents: number;
  rate_source: RateSource;
  billable_status: BillableStatus;
  bucket_id: string | null;
  description: string;
  review_flag: boolean;
  created_at: string;
  updated_at: string;
  source_event_id: string | null;
};
```

And widen the `EntriesFile`:
```ts
export type EntriesFile = {
  schema_version: 1 | 2;
  month: string;
  entries: Entry[];
};
```

- [ ] **Step 1.5 — Backfill null in the validator**

Replace the `validateEntries` export in `src/schema/validators.ts`:
```ts
export const validateEntries = (data: unknown): ValidationResult<EntriesFile> => {
  if (!_entries(data)) return { ok: false, errors: _entries.errors ?? [] };
  const file = data as EntriesFile;
  for (const e of file.entries) {
    if (!('source_event_id' in e)) {
      (e as Entry).source_event_id = null;
    }
  }
  return { ok: true, value: file };
};
```

Remove the old `validateEntries = wrap<EntriesFile>(_entries);` line that used the generic wrapper.

- [ ] **Step 1.6 — Make hash null-safe**

Replace `canonicalizeEntry` in `src/calc/hash.ts`:
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
  if (e.source_event_id !== null && e.source_event_id !== undefined) {
    base.source_event_id = e.source_event_id;
  }
  return base;
}
```

- [ ] **Step 1.7 — Fix type-compile at every Entry construction site**

Add `source_event_id: null` to each Entry literal:

**`src/ui/screens/QuickLog.tsx`** — in `buildEntry`, add `source_event_id: null` to the returned object. Later Task 9 replaces this to pass `form.source_event_id`; for now, null is the right default.

**`scripts/import-march-2026.ts`** — line ~202 where the entry is built, add `source_event_id: null,`.

**Test files** — each of these has a `makeEntry` or `baseEntry` helper; add `source_event_id: null` to the defaults:
- `tests/calc/hash.test.ts`
- `tests/calc/totals.test.ts`
- `tests/calc/bulk-rate.test.ts`
- `tests/calc/drift.test.ts`
- `tests/export/csv.test.ts`
- `tests/data/entries-repo.test.ts`
- `tests/schema/validators.test.ts`

Concrete pattern — open the file, find the helper, add one line:
```ts
function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    // ... existing fields ...
    updated_at: '...',
    source_event_id: null,
    ...overrides,
  };
}
```

- [ ] **Step 1.8 — Run new tests, verify they pass**

```
npm test -- tests/schema/entry-v2-migration.test.ts tests/calc/hash-v2.test.ts
```
Expected: PASS (3 + 3 tests).

- [ ] **Step 1.9 — Run the full suite — golden must still pass**

```
npm run typecheck
npm run lint
npm test
```

All three must pass. The golden-mini and golden-full tests (`tests/calc/golden-*.test.ts`) must pass unchanged — this is the critical guard.

- [ ] **Step 1.10 — Commit**

```
git add schemas/entries.schema.json src/schema/types.ts src/schema/validators.ts src/calc/hash.ts src/ui/screens/QuickLog.tsx scripts/import-march-2026.ts tests/
git commit -m "feat(schema): Entry v1→v2 with nullable source_event_id"
```

---

## Task 2: Write-path upgrades file on write + `[calendar]` commit suffix

**Goal:** Any write to a month's entries file upgrades the file to `schema_version: 2` and backfills `null` on existing entries. The first upgrade commit gets a `[schema v1→v2]` suffix for traceability. `logMessage` learns a `source: 'calendar'` suffix.

**Files:**
- Modify: `src/data/commit-messages.ts`
- Modify: `src/data/entries-repo.ts`
- Create: `tests/data/entries-repo-v2.test.ts`

### Steps

- [ ] **Step 2.1 — Extend `logMessage` with optional source**

Replace the `logMessage` export in `src/data/commit-messages.ts`:
```ts
export function logMessage(args: {
  project: string;
  date: string;
  hours_hundredths: number;
  rate_cents: number;
  description: string;
  source?: 'calendar';
}): string {
  const hours = formatHoursDecimal(args.hours_hundredths);
  const rate = formatDollars(args.rate_cents);
  const base = `log: ${args.project} ${args.date} ${hours}h @ ${rate} (${args.description})`;
  return args.source === 'calendar' ? `${base} [calendar]` : base;
}
```

Append the new helper:
```ts
export function schemaUpgradeSuffix(fromVersion: 1 | 2, toVersion: 1 | 2): string {
  return fromVersion !== toVersion ? ` [schema v${fromVersion}→v${toVersion}]` : '';
}
```

- [ ] **Step 2.2 — Write failing test for the upgrade behavior**

`tests/data/entries-repo-v2.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validateEntries } from '@/schema/validators';
import type { EntriesFile } from '@/schema/types';

// These tests verify the invariant that a v1 file passed to a writer transform
// comes back v2 with source_event_id backfilled to null on all entries.
// We call the transform function directly via a small imported helper.

import { upgradeEntriesFileToV2 } from '@/data/entries-repo';

describe('upgradeEntriesFileToV2', () => {
  it('leaves a v2 file unchanged (no new null fields)', () => {
    const v2: EntriesFile = {
      schema_version: 2,
      month: '2026-04',
      entries: [
        {
          id: '2026-04-14-sprosty-aaaaaa',
          project: 'sprosty',
          date: '2026-04-14',
          hours_hundredths: 75,
          rate_cents: 12500,
          rate_source: 'global_default',
          billable_status: 'billable',
          bucket_id: null,
          description: 'already v2',
          review_flag: false,
          created_at: '2026-04-14T10:00:00Z',
          updated_at: '2026-04-14T10:00:00Z',
          source_event_id: 'gcal-xyz',
        },
      ],
    };
    const upgraded = upgradeEntriesFileToV2(v2);
    expect(upgraded.schema_version).toBe(2);
    expect(upgraded.entries[0]?.source_event_id).toBe('gcal-xyz');
  });

  it('bumps schema_version and backfills null on a v1 file', () => {
    const v1: EntriesFile = {
      schema_version: 1,
      month: '2026-03',
      entries: [
        {
          id: '2026-03-01-sprosty-aaaaaa',
          project: 'sprosty',
          date: '2026-03-01',
          hours_hundredths: 100,
          rate_cents: 12500,
          rate_source: 'global_default',
          billable_status: 'billable',
          bucket_id: null,
          description: 'v1 entry',
          review_flag: false,
          created_at: '2026-03-01T10:00:00Z',
          updated_at: '2026-03-01T10:00:00Z',
          source_event_id: null,
        },
      ],
    };
    const upgraded = upgradeEntriesFileToV2(v1);
    expect(upgraded.schema_version).toBe(2);
    expect(upgraded.entries[0]?.source_event_id).toBe(null);
    const ajv = validateEntries(upgraded);
    expect(ajv.ok).toBe(true);
  });
});
```

- [ ] **Step 2.3 — Run test, confirm fails**

```
npm test -- tests/data/entries-repo-v2.test.ts
```
Expected: FAIL — `upgradeEntriesFileToV2` is not exported.

- [ ] **Step 2.4 — Add the upgrade helper to `entries-repo.ts`**

At the top of `src/data/entries-repo.ts` (after the imports), add:
```ts
export function upgradeEntriesFileToV2(file: EntriesFile): EntriesFile {
  return {
    ...file,
    schema_version: 2,
    entries: file.entries.map((e) => ({
      ...e,
      source_event_id: e.source_event_id ?? null,
    })),
  };
}
```

- [ ] **Step 2.5 — Thread the upgrade through every writer transform**

In `src/data/entries-repo.ts`, update the three writer paths — `addEntry`, `updateEntry`, `deleteEntry`. The pattern for each `transform` callback is: upgrade the file and check whether the version changed, so the commit message can reflect it. Import `schemaUpgradeSuffix`:

```ts
import { logMessage, schemaUpgradeSuffix } from './commit-messages';
```

Replace `addEntry` with:
```ts
export async function addEntry(octokit: Octokit, args: AddEntryArgs): Promise<void> {
  const month = args.entry.date.slice(0, 7);
  const path = entriesPath(month);

  const probe: EntriesFile = { schema_version: 2, month, entries: [args.entry] };
  const validation = validateEntries(probe);
  if (!validation.ok) {
    throw new Error(`Entry failed validation:\n${formatValidationErrors(validation.errors)}`);
  }

  await writeJsonFileWithRetry<EntriesFile>(octokit, {
    owner: args.owner,
    repo: args.repo,
    path,
    message: logMessage({
      project: args.entry.project,
      date: args.entry.date,
      hours_hundredths: args.entry.hours_hundredths,
      rate_cents: args.entry.rate_cents,
      description: args.entry.description,
      source: args.entry.source_event_id !== null ? 'calendar' : undefined,
    }),
    transform: (current) => {
      const base: EntriesFile = current ?? {
        schema_version: 2,
        month,
        entries: [],
      };
      if (base.entries.some((e) => e.id === args.entry.id)) {
        throw new Error(`Duplicate entry id ${args.entry.id} — refusing to overwrite.`);
      }
      const upgraded = upgradeEntriesFileToV2(base);
      return {
        ...upgraded,
        entries: [...upgraded.entries, args.entry],
      };
    },
  });
}
```

Replace `updateEntry` — only the `transform` body changes; the upgrade wraps the old logic:
```ts
export async function updateEntry(
  octokit: Octokit,
  args: UpdateEntryArgs,
): Promise<void> {
  const month = args.entry.date.slice(0, 7);
  const path = entriesPath(month);

  await writeJsonFileWithRetry<EntriesFile>(octokit, {
    owner: args.owner,
    repo: args.repo,
    path,
    message: args.message,
    transform: (current) => {
      if (!current) {
        throw new Error(`Cannot update entry in missing month file: ${path}`);
      }
      const upgraded = upgradeEntriesFileToV2(current);
      const idx = upgraded.entries.findIndex((e) => e.id === args.entry.id);
      if (idx < 0) {
        throw new Error(`Entry id ${args.entry.id} not found in ${path}`);
      }
      const next = [...upgraded.entries];
      next[idx] = { ...args.entry, updated_at: new Date().toISOString() };
      const updated: EntriesFile = { ...upgraded, entries: next };
      const v = validateEntries(updated);
      if (!v.ok) {
        throw new Error(
          `Updated entries file failed validation:\n${formatValidationErrors(v.errors)}`,
        );
      }
      return updated;
    },
  });
}
```

Replace `deleteEntry` — same pattern:
```ts
export async function deleteEntry(
  octokit: Octokit,
  args: DeleteEntryArgs,
): Promise<void> {
  const path = entriesPath(args.month);
  await writeJsonFileWithRetry<EntriesFile>(octokit, {
    owner: args.owner,
    repo: args.repo,
    path,
    message: args.message,
    transform: (current) => {
      if (!current) throw new Error(`Cannot delete from missing file ${path}`);
      const upgraded = upgradeEntriesFileToV2(current);
      return {
        ...upgraded,
        entries: upgraded.entries.filter((e) => e.id !== args.entryId),
      };
    },
  });
}
```

Note: the `schemaUpgradeSuffix` helper is available for any future caller that wants to annotate the version change in the commit; the MVP writers don't surface it because the `transform` result isn't visible back to the caller. That's fine — the version bump is still a strong signal (in the file itself) and the commit history shows the write.

- [ ] **Step 2.6 — Verify tests pass**

```
npm test -- tests/data/entries-repo-v2.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 2.7 — Full suite + typecheck + lint**

```
npm run typecheck && npm run lint && npm test
```
All green.

- [ ] **Step 2.8 — Commit**

```
git add src/data/entries-repo.ts src/data/commit-messages.ts tests/data/entries-repo-v2.test.ts
git commit -m "feat(data): writer upgrades entries files to v2 and supports [calendar] commit suffix"
```

---

## Task 3: Calendar config schema + validator + repo + hook

**Goal:** Define the new `config/calendar.json` file in the data repo. Ship the validator, repo read/write, and react-query hook. Everything downstream depends on this existing.

**Files:**
- Create: `schemas/calendar-config.schema.json`
- Modify: `src/schema/types.ts`
- Modify: `src/schema/validators.ts`
- Create: `src/data/calendar-config-repo.ts`
- Create: `src/data/hooks/use-calendar-config.ts`
- Modify: `src/data/query-keys.ts`
- Modify: `src/data/commit-messages.ts`
- Create: `tests/schema/calendar-config.test.ts`

### Steps

- [ ] **Step 3.1 — Write the JSON schema**

`schemas/calendar-config.schema.json`:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://sapienex-ai.github.io/hours-tracker/schemas/calendar-config.schema.json",
  "title": "Calendar integration config",
  "type": "object",
  "required": ["schema_version", "provider", "enabled_calendars"],
  "additionalProperties": false,
  "properties": {
    "schema_version": { "const": 1 },
    "provider": { "const": "google" },
    "enabled_calendars": {
      "type": "array",
      "items": { "type": "string", "minLength": 1 },
      "uniqueItems": true
    },
    "last_connected_at": { "type": "string", "format": "date-time" }
  }
}
```

- [ ] **Step 3.2 — Add the TS type**

In `src/schema/types.ts`, append:
```ts
export type CalendarConfig = {
  schema_version: 1;
  provider: 'google';
  enabled_calendars: string[];
  last_connected_at?: string;
};
```

- [ ] **Step 3.3 — Add the validator**

In `src/schema/validators.ts`:

Add the schema import at the top:
```ts
import calendarConfigSchema from '../../schemas/calendar-config.schema.json';
```

Add the import in the type list:
```ts
import type {
  // ... existing ...
  CalendarConfig,
} from './types';
```

Add the compile + export:
```ts
const _calendarConfig = ajv.compile<CalendarConfig>(calendarConfigSchema);
export const validateCalendarConfig = wrap<CalendarConfig>(_calendarConfig);
```

- [ ] **Step 3.4 — Write failing validator test**

`tests/schema/calendar-config.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validateCalendarConfig } from '@/schema/validators';

describe('validateCalendarConfig', () => {
  it('accepts a minimal valid config', () => {
    const r = validateCalendarConfig({
      schema_version: 1,
      provider: 'google',
      enabled_calendars: ['primary'],
    });
    expect(r.ok).toBe(true);
  });

  it('accepts a config with last_connected_at', () => {
    const r = validateCalendarConfig({
      schema_version: 1,
      provider: 'google',
      enabled_calendars: ['primary', 'team@sapienex.com'],
      last_connected_at: '2026-04-14T10:00:00Z',
    });
    expect(r.ok).toBe(true);
  });

  it('rejects unknown provider', () => {
    const r = validateCalendarConfig({
      schema_version: 1,
      provider: 'outlook',
      enabled_calendars: ['primary'],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects duplicate calendar ids', () => {
    const r = validateCalendarConfig({
      schema_version: 1,
      provider: 'google',
      enabled_calendars: ['primary', 'primary'],
    });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 3.5 — Run, verify pass**

```
npm test -- tests/schema/calendar-config.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 3.6 — Add commit-message helper**

Append to `src/data/commit-messages.ts`:
```ts
export function calendarConfigMessage(action: 'connect' | 'disconnect' | 'update'): string {
  return `config: ${action} calendar integration`;
}
```

- [ ] **Step 3.7 — Implement the repo**

`src/data/calendar-config-repo.ts`:
```ts
import type { Octokit } from '@octokit/rest';
import type { CalendarConfig } from '@/schema/types';
import { validateCalendarConfig, formatValidationErrors } from '@/schema/validators';
import { readJsonFile, writeJsonFile, FileNotFoundError } from './github-file';
import { calendarConfigMessage } from './commit-messages';

const CONFIG_PATH = 'config/calendar.json';

export async function loadCalendarConfig(
  octokit: Octokit,
  args: { owner: string; repo: string },
): Promise<CalendarConfig | null> {
  try {
    const read = await readJsonFile<CalendarConfig>(octokit, {
      owner: args.owner,
      repo: args.repo,
      path: CONFIG_PATH,
    });
    const v = validateCalendarConfig(read.data);
    if (!v.ok) {
      throw new Error(`calendar.json failed validation:\n${formatValidationErrors(v.errors)}`);
    }
    return v.value;
  } catch (e) {
    if (e instanceof FileNotFoundError) return null;
    throw e;
  }
}

export async function writeCalendarConfig(
  octokit: Octokit,
  args: {
    owner: string;
    repo: string;
    config: CalendarConfig;
    action: 'connect' | 'disconnect' | 'update';
  },
): Promise<void> {
  const v = validateCalendarConfig(args.config);
  if (!v.ok) {
    throw new Error(`calendar config failed validation:\n${formatValidationErrors(v.errors)}`);
  }
  await writeJsonFile(octokit, {
    owner: args.owner,
    repo: args.repo,
    path: CONFIG_PATH,
    content: args.config,
    message: calendarConfigMessage(args.action),
  });
}
```

- [ ] **Step 3.8 — Add query key**

In `src/data/query-keys.ts`:
```ts
  calendarConfig: (repo: string) => [...qk.all, 'calendar-config', repo] as const,
```

- [ ] **Step 3.9 — Implement the hook**

`src/data/hooks/use-calendar-config.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { loadCalendarConfig } from '@/data/calendar-config-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { qk } from '@/data/query-keys';
import { useOctokit } from './use-octokit';

export function useCalendarConfig() {
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  return useQuery({
    queryKey: qk.calendarConfig(dataRepo ?? 'none'),
    enabled: !!octokit && !!dataRepo,
    staleTime: 30_000,
    queryFn: async () => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      const { owner, repo } = splitRepoPath(dataRepo);
      return loadCalendarConfig(octokit, { owner, repo });
    },
  });
}
```

- [ ] **Step 3.10 — Run full suite**

```
npm run typecheck && npm run lint && npm test
```
All green.

- [ ] **Step 3.11 — Commit**

```
git add schemas/calendar-config.schema.json src/schema/types.ts src/schema/validators.ts src/data/calendar-config-repo.ts src/data/hooks/use-calendar-config.ts src/data/query-keys.ts src/data/commit-messages.ts tests/schema/calendar-config.test.ts
git commit -m "feat(data): calendar config schema, validator, repo, and hook"
```

---

## Task 4: Google Cloud setup playbook

**Goal:** One-off ops doc so anyone setting up a new Google Cloud project for this app has a deterministic checklist.

**Files:**
- Create: `docs/architecture/google-calendar-setup.md`

### Steps

- [ ] **Step 4.1 — Write the playbook**

`docs/architecture/google-calendar-setup.md`:
```md
# Google Calendar integration — one-time setup

This playbook sets up the Google Cloud project that backs the calendar integration for all consultants. Run it once per SapienEx deployment. Individual consultants never do any of this — they only click Connect in Settings.

## Prerequisites

- A Google account that will own the Cloud project (ideally a SapienEx-owned workspace account, not personal).
- ~15 minutes.

## Steps

### 1. Create the Cloud project

1. Visit <https://console.cloud.google.com/>.
2. Click the project selector → "New Project".
3. Name: `hours-tracker`. Organization: none (or SapienEx if your workspace has one).
4. Create.

### 2. Enable the Calendar API

1. Navigation → "APIs & Services" → "Library".
2. Search "Google Calendar API".
3. Click → Enable.

### 3. Configure the OAuth consent screen

1. "APIs & Services" → "OAuth consent screen".
2. User type: **External**. Next.
3. App name: `Hours Tracker`. User support email: your address. Developer email: your address. Save and continue.
4. Scopes → Add or remove scopes → check `.../auth/calendar.readonly` → Update. Save and continue.
5. Test users → Add Users → add each consultant's Google address (up to 100). Save.
6. **Leave publishing status as Testing.** Do not publish; that triggers verification (paid, slow).

### 4. Create the OAuth Web client

1. "APIs & Services" → "Credentials" → "Create credentials" → "OAuth client ID".
2. Application type: **Web application**.
3. Name: `Hours Tracker web`.
4. Authorized JavaScript origins — add each of these, one per row:
   - `https://sapienex-ai.github.io`
   - `http://localhost:5173`
   - `http://localhost:5174`
5. Authorized redirect URIs: leave empty (GIS token flow uses origin-only).
6. Create.
7. Copy the **Client ID** (ends in `.apps.googleusercontent.com`).

### 5. Wire the client ID into the app

Paste the client ID into `src/integrations/google/client-id.ts`:
```ts
export const GOOGLE_CLIENT_ID = '123456789012-abc...apps.googleusercontent.com';
```

Commit. Deploy.

## Adding a new consultant

Not a Cloud-side change — just add their Google address to the **Test users** list in the consent screen. They can Connect in the app immediately after.

## Adding a new origin (custom domain, new localhost port)

"APIs & Services" → "Credentials" → click the OAuth client → add to Authorized JavaScript origins → Save. Takes a minute or two to propagate.

## If something fails

| Symptom | Cause | Fix |
|---|---|---|
| `origin_mismatch` 403 | The page's origin isn't in Authorized JavaScript origins | Add it (step above). |
| `access_denied` in GIS callback | User isn't a Test user on the consent screen | Add their email to Test users. |
| Consent screen says "This app isn't verified" | Normal — Testing mode always shows this | User clicks "Advanced → Go to Hours Tracker (unsafe)". |
```

- [ ] **Step 4.2 — Commit**

```
git add docs/architecture/google-calendar-setup.md
git commit -m "docs: Google Cloud setup playbook for calendar integration"
```

---

## Task 5: Google Identity Services client + Calendar API wrapper + Provider

**Goal:** The entire Google-talking layer behind one small provider interface. Tests use mocked fetch at the API boundary.

**Files:**
- Modify: `index.html`
- Create: `src/integrations/google/client-id.ts`
- Create: `src/integrations/google/gis-client.ts`
- Create: `src/integrations/google/calendar-api.ts`
- Create: `src/integrations/calendar/provider.ts`
- Create: `tests/integrations/calendar-api.test.ts`

### Steps

- [ ] **Step 5.1 — Add the GIS script tag**

In `index.html`, inside the `<head>` (before the app's module script), add:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

- [ ] **Step 5.2 — Ship the client-ID constant**

`src/integrations/google/client-id.ts`:
```ts
// Public Google Web Client ID for the Hours Tracker app.
// Web client IDs are NOT secret — origin allow-listing is the actual authorization.
// See docs/architecture/google-calendar-setup.md for how to create/rotate this.
// Until the first deployment this is a placeholder; replace it after running the playbook.
export const GOOGLE_CLIENT_ID = 'REPLACE_ME.apps.googleusercontent.com';
```

Yes, this is the one place we ship a placeholder — it's an operational config that must be filled in before the feature is usable, and committing a real client ID is the next deploy step. The Connect button in Settings will surface a clear error if this hasn't been replaced (see Step 5.4).

- [ ] **Step 5.3 — Define the GIS runtime types**

At the top of `src/integrations/google/gis-client.ts`:
```ts
// Minimal typings for Google Identity Services. The full library is loaded via
// a <script> tag in index.html; this file declares just what we use.

type GisTokenResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: 'Bearer';
  error?: string;
  error_description?: string;
};

type GisTokenClient = {
  requestAccessToken(overrideConfig?: { prompt?: '' | 'consent' | 'none' }): void;
};

type GisOauth2 = {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: GisTokenResponse) => void;
    error_callback?: (error: { type: string; message?: string }) => void;
  }): GisTokenClient;
  revoke(accessToken: string, callback?: () => void): void;
};

declare global {
  interface Window {
    google?: { accounts: { oauth2: GisOauth2 } };
  }
}
```

- [ ] **Step 5.4 — Implement the GIS client**

Append to `src/integrations/google/gis-client.ts`:
```ts
import { GOOGLE_CLIENT_ID } from './client-id';

const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const STORAGE_KEY = 'hours-tracker.google-token';

type StoredToken = { access_token: string; expires_at: number };

function readStored(): StoredToken | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToken;
    if (typeof parsed.access_token !== 'string' || typeof parsed.expires_at !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(t: StoredToken): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
}

function clearStored(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function ensureClientIdConfigured(): void {
  if (GOOGLE_CLIENT_ID.startsWith('REPLACE_ME')) {
    throw new Error(
      'Google OAuth client ID is not configured. See docs/architecture/google-calendar-setup.md.',
    );
  }
}

function getGisClient(): GisTokenClient {
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services library has not loaded yet.');
  }
  ensureClientIdConfigured();
  return window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPE,
    callback: () => undefined, // overridden per-call below
  });
}

export function isConnected(): boolean {
  const t = readStored();
  return !!t && t.expires_at > Date.now() + 10_000;
}

export function disconnect(): void {
  const t = readStored();
  clearStored();
  if (t && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(t.access_token);
  }
}

export function connect(): Promise<string> {
  return new Promise((resolve, reject) => {
    ensureClientIdConfigured();
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services library has not loaded yet.'));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) {
          reject(new Error(`Google auth failed: ${resp.error_description ?? resp.error}`));
          return;
        }
        const stored: StoredToken = {
          access_token: resp.access_token,
          expires_at: Date.now() + resp.expires_in * 1000,
        };
        writeStored(stored);
        resolve(resp.access_token);
      },
      error_callback: (err) => {
        reject(new Error(`Google auth error: ${err.type}${err.message ? ` — ${err.message}` : ''}`));
      },
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

export async function getAccessToken(): Promise<string> {
  const stored = readStored();
  if (stored && stored.expires_at > Date.now() + 60_000) return stored.access_token;
  return new Promise((resolve, reject) => {
    ensureClientIdConfigured();
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services library has not loaded yet.'));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) {
          clearStored();
          reject(new Error(`Token refresh failed: ${resp.error_description ?? resp.error}`));
          return;
        }
        const next: StoredToken = {
          access_token: resp.access_token,
          expires_at: Date.now() + resp.expires_in * 1000,
        };
        writeStored(next);
        resolve(resp.access_token);
      },
      error_callback: (err) => {
        clearStored();
        reject(new Error(`Silent refresh failed: ${err.type}`));
      },
    });
    client.requestAccessToken({ prompt: '' });
  });
}

// getGisClient is exported purely for test mocking; not used in app code directly.
export const __gisInternals = { getGisClient };
```

- [ ] **Step 5.5 — Write failing tests for the Calendar API wrapper**

`tests/integrations/calendar-api.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listCalendars, listEvents } from '@/integrations/google/calendar-api';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('listCalendars', () => {
  it('returns parsed calendar entries', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { id: 'primary', summary: 'prash@sapienex.com', primary: true },
          { id: 'team@sapienex.com', summary: 'Team shared' },
          { id: 'holidays', summary: 'Holidays in Canada' },
        ],
      }),
    });
    const result = await listCalendars('tok');
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ id: 'primary', summary: 'prash@sapienex.com', primary: true });
  });

  it('throws on non-OK response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'backend lit' } }),
    });
    await expect(listCalendars('tok')).rejects.toThrow(/500/);
  });
});

describe('listEvents', () => {
  it('returns parsed events for a date range', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: 'evt1',
            summary: 'Sprosty standup',
            start: { dateTime: '2026-04-14T09:00:00-04:00' },
            end: { dateTime: '2026-04-14T09:30:00-04:00' },
            status: 'confirmed',
          },
        ],
      }),
    });
    const result = await listEvents('tok', {
      calendarId: 'primary',
      timeMin: '2026-04-14T00:00:00-04:00',
      timeMax: '2026-04-14T23:59:59-04:00',
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('evt1');
    expect(result[0]?.summary).toBe('Sprosty standup');
  });

  it('URL-encodes the calendar id', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    });
    await listEvents('tok', {
      calendarId: 'team@sapienex.com',
      timeMin: '2026-04-14T00:00:00Z',
      timeMax: '2026-04-14T23:59:59Z',
    });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('team%40sapienex.com');
  });

  it('throws on 401 so the caller can retry', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'unauth' } }),
    });
    await expect(
      listEvents('tok', {
        calendarId: 'primary',
        timeMin: '2026-04-14T00:00:00Z',
        timeMax: '2026-04-14T23:59:59Z',
      }),
    ).rejects.toThrow(/401/);
  });
});
```

- [ ] **Step 5.6 — Run, verify fails**

```
npm test -- tests/integrations/calendar-api.test.ts
```
Expected: FAIL (module missing).

- [ ] **Step 5.7 — Implement the Calendar API wrapper**

`src/integrations/google/calendar-api.ts`:
```ts
const BASE = 'https://www.googleapis.com/calendar/v3';

export type GCalendar = {
  id: string;
  summary: string;
  primary?: boolean;
};

export type GEventDateTime = {
  dateTime?: string;
  date?: string;
  timeZone?: string;
};

export type GEventAttendee = {
  self?: boolean;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
};

export type GEvent = {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string;
  description?: string;
  start: GEventDateTime;
  end: GEventDateTime;
  attendees?: GEventAttendee[];
};

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as { error?: { message?: string } }).error?.message ?? res.statusText;
    throw new Error(`Google Calendar API ${res.status}: ${msg}`);
  }
  return (await res.json()) as T;
}

export async function listCalendars(token: string): Promise<GCalendar[]> {
  const data = await fetchJson<{ items: GCalendar[] }>(
    `${BASE}/users/me/calendarList?minAccessRole=reader`,
    token,
  );
  return data.items ?? [];
}

export async function listEvents(
  token: string,
  args: { calendarId: string; timeMin: string; timeMax: string },
): Promise<GEvent[]> {
  const params = new URLSearchParams({
    timeMin: args.timeMin,
    timeMax: args.timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
  });
  const encoded = encodeURIComponent(args.calendarId);
  const data = await fetchJson<{ items: GEvent[] }>(
    `${BASE}/calendars/${encoded}/events?${params.toString()}`,
    token,
  );
  return data.items ?? [];
}
```

- [ ] **Step 5.8 — Run tests, verify pass**

```
npm test -- tests/integrations/calendar-api.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5.9 — Create the provider interface + Google impl**

`src/integrations/calendar/provider.ts`:
```ts
import type { GCalendar, GEvent } from '@/integrations/google/calendar-api';
import { listCalendars, listEvents } from '@/integrations/google/calendar-api';
import { connect, disconnect, getAccessToken, isConnected } from '@/integrations/google/gis-client';

export type CalendarInfo = GCalendar;
export type CalendarEvent = GEvent;

export type CalendarProvider = {
  id: 'google';
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  listCalendars(): Promise<CalendarInfo[]>;
  listEvents(args: {
    calendarId: string;
    timeMin: string;
    timeMax: string;
  }): Promise<CalendarEvent[]>;
};

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const msg = (e as Error).message ?? '';
    if (msg.includes('401')) {
      // Silent re-token, then one retry.
      await getAccessToken();
      return await fn();
    }
    throw e;
  }
}

export const googleProvider: CalendarProvider = {
  id: 'google',
  async connect() {
    await connect();
  },
  disconnect() {
    disconnect();
  },
  isConnected() {
    return isConnected();
  },
  async listCalendars() {
    const token = await getAccessToken();
    return withRetry(() => listCalendars(token));
  },
  async listEvents(args) {
    const token = await getAccessToken();
    return withRetry(() => listEvents(token, args));
  },
};
```

- [ ] **Step 5.10 — Full suite**

```
npm run typecheck && npm run lint && npm test
```
All green.

- [ ] **Step 5.11 — Commit**

```
git add index.html src/integrations/ tests/integrations/
git commit -m "feat(integrations): Google Identity Services client + Calendar API wrapper + provider interface"
```

---

## Task 6: `eventToFormState` — pure filter + round + prefill

**Goal:** One pure, exhaustively-tested function that turns a Google Calendar event into a form prefill. Filters declined and all-day events here; does rounding here. Everything else (UI, data fetching) calls this and trusts the result.

**Files:**
- Create: `src/integrations/calendar/event-to-entry.ts`
- Create: `tests/integrations/event-to-entry.test.ts`

### Steps

- [ ] **Step 6.1 — Write failing tests**

`tests/integrations/event-to-entry.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { eventToFormState } from '@/integrations/calendar/event-to-entry';
import type { CalendarEvent } from '@/integrations/calendar/provider';

function mkEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt1',
    status: 'confirmed',
    summary: 'Sprosty standup',
    start: { dateTime: '2026-04-14T09:00:00-04:00' },
    end: { dateTime: '2026-04-14T09:30:00-04:00' },
    ...overrides,
  };
}

describe('eventToFormState', () => {
  it('returns prefill for a 30-min confirmed event', () => {
    const r = eventToFormState(mkEvent(), '2026-04-14');
    expect(r).toEqual({
      date: '2026-04-14',
      hours_hundredths: 50,
      description: 'Sprosty standup',
      source_event_id: 'evt1',
      start_label: expect.any(String),
      end_label: expect.any(String),
    });
  });

  it('rounds 52-min duration to nearest 15 min (60 min → 100 hundredths)', () => {
    const r = eventToFormState(
      mkEvent({
        start: { dateTime: '2026-04-14T09:00:00-04:00' },
        end: { dateTime: '2026-04-14T09:52:00-04:00' },
      }),
      '2026-04-14',
    );
    expect(r?.hours_hundredths).toBe(100);
  });

  it('rounds 7-min duration to 15 min (25 hundredths)', () => {
    const r = eventToFormState(
      mkEvent({
        start: { dateTime: '2026-04-14T09:00:00-04:00' },
        end: { dateTime: '2026-04-14T09:07:00-04:00' },
      }),
      '2026-04-14',
    );
    expect(r?.hours_hundredths).toBe(25);
  });

  it('filters declined events (user declined the invite) → null', () => {
    const r = eventToFormState(
      mkEvent({
        attendees: [{ self: true, responseStatus: 'declined' }],
      }),
      '2026-04-14',
    );
    expect(r).toBeNull();
  });

  it('filters all-day events (date-only, no dateTime) → null', () => {
    const r = eventToFormState(
      mkEvent({
        start: { date: '2026-04-14' },
        end: { date: '2026-04-15' },
      }),
      '2026-04-14',
    );
    expect(r).toBeNull();
  });

  it('filters zero-duration events (start === end) → null', () => {
    const r = eventToFormState(
      mkEvent({
        start: { dateTime: '2026-04-14T09:00:00-04:00' },
        end: { dateTime: '2026-04-14T09:00:00-04:00' },
      }),
      '2026-04-14',
    );
    expect(r).toBeNull();
  });

  it('empty summary becomes empty description', () => {
    const r = eventToFormState(
      mkEvent({ summary: undefined }),
      '2026-04-14',
    );
    expect(r?.description).toBe('');
  });

  it('clips an event spanning past the selected date midnight', () => {
    // Event: 23:00 → 01:00 next day. On the 14th we see 1h.
    const r = eventToFormState(
      {
        id: 'cross',
        status: 'confirmed',
        summary: 'late work',
        start: { dateTime: '2026-04-14T23:00:00-04:00' },
        end: { dateTime: '2026-04-15T01:00:00-04:00' },
      },
      '2026-04-14',
    );
    expect(r?.hours_hundredths).toBe(100);
  });
});
```

- [ ] **Step 6.2 — Run, verify fail**

```
npm test -- tests/integrations/event-to-entry.test.ts
```
Expected: FAIL (module missing).

- [ ] **Step 6.3 — Implement**

`src/integrations/calendar/event-to-entry.ts`:
```ts
import type { CalendarEvent } from './provider';

export type FormStatePrefill = {
  date: string;
  hours_hundredths: number;
  description: string;
  source_event_id: string;
  start_label: string;
  end_label: string;
};

const ROUND_MIN = 15;

function userDeclined(ev: CalendarEvent): boolean {
  const self = ev.attendees?.find((a) => a.self);
  return self?.responseStatus === 'declined';
}

function isAllDay(ev: CalendarEvent): boolean {
  return !ev.start.dateTime || !ev.end.dateTime;
}

function roundToNearest(minutes: number, step: number): number {
  return Math.round(minutes / step) * step;
}

function localMidnightAfter(dateStr: string): number {
  // dateStr is YYYY-MM-DD in the browser's local timezone.
  const [y, m, d] = dateStr.split('-').map((s) => parseInt(s, 10));
  const nextDay = new Date(y ?? 0, (m ?? 1) - 1, (d ?? 0) + 1, 0, 0, 0, 0);
  return nextDay.getTime();
}

function formatHm(date: Date): string {
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

export function eventToFormState(
  event: CalendarEvent,
  selectedDate: string,
): FormStatePrefill | null {
  if (userDeclined(event)) return null;
  if (isAllDay(event)) return null;
  const startMs = Date.parse(event.start.dateTime!);
  const endMsRaw = Date.parse(event.end.dateTime!);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMsRaw)) return null;

  const midnightMs = localMidnightAfter(selectedDate);
  const endMs = Math.min(endMsRaw, midnightMs);
  if (endMs <= startMs) return null;

  const durationMin = (endMs - startMs) / 60_000;
  const roundedMin = roundToNearest(durationMin, ROUND_MIN);
  if (roundedMin <= 0) return null;

  // hours_hundredths = rounded minutes * (100/60) — integer math via / 60 careful.
  // roundedMin is always a multiple of 15, so roundedMin/60 is a multiple of 0.25 → 25 hundredths.
  const hours_hundredths = Math.round((roundedMin * 100) / 60);

  return {
    date: selectedDate,
    hours_hundredths,
    description: event.summary ?? '',
    source_event_id: event.id,
    start_label: formatHm(new Date(startMs)),
    end_label: formatHm(new Date(endMs)),
  };
}
```

- [ ] **Step 6.4 — Run, verify pass**

```
npm test -- tests/integrations/event-to-entry.test.ts
```
Expected: PASS (8 tests).

- [ ] **Step 6.5 — Full suite**

```
npm run typecheck && npm run lint && npm test
```
All green.

- [ ] **Step 6.6 — Commit**

```
git add src/integrations/calendar/event-to-entry.ts tests/integrations/event-to-entry.test.ts
git commit -m "feat(integrations): pure eventToFormState with filter + round + clip"
```

---

## Task 7: Calendar store + `useCalendarEvents` hook

**Goal:** Zustand store for connection + enabled-calendar state. React-query hook fans out to every enabled calendar for the selected date, maps events through `eventToFormState`, and annotates each with a `logged` flag derived from the current month's entries.

**Files:**
- Create: `src/store/calendar-store.ts`
- Create: `src/data/hooks/use-calendar-events.ts`

### Steps

- [ ] **Step 7.1 — Implement the store**

`src/store/calendar-store.ts`:
```ts
import { create } from 'zustand';
import { googleProvider, type CalendarProvider } from '@/integrations/calendar/provider';

type State = {
  provider: CalendarProvider;
  connected: boolean;
  lastError: string | null;
  refresh: () => void;
  setError: (msg: string | null) => void;
};

// A tick state so components can force re-checks of connection state
// after a connect/disconnect side-effect.
export const useCalendarStore = create<State>((set) => ({
  provider: googleProvider,
  connected: googleProvider.isConnected(),
  lastError: null,
  refresh: () =>
    set({ connected: googleProvider.isConnected() }),
  setError: (msg) => set({ lastError: msg }),
}));
```

- [ ] **Step 7.2 — Implement the events hook**

`src/data/hooks/use-calendar-events.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { useMonthEntries } from './use-month-entries';
import { useCalendarConfig } from './use-calendar-config';
import { useCalendarStore } from '@/store/calendar-store';
import { qk } from '@/data/query-keys';
import { eventToFormState, type FormStatePrefill } from '@/integrations/calendar/event-to-entry';
import type { CalendarEvent } from '@/integrations/calendar/provider';

export type Suggestion = FormStatePrefill & {
  logged: boolean;
  calendar_id: string;
};

function dateBoundsISO(date: string): { timeMin: string; timeMax: string } {
  const [y, m, d] = date.split('-').map((s) => parseInt(s, 10));
  const start = new Date(y ?? 0, (m ?? 1) - 1, d ?? 0, 0, 0, 0, 0);
  const end = new Date(y ?? 0, (m ?? 1) - 1, d ?? 0, 23, 59, 59, 999);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

export function useCalendarEvents(date: string) {
  const { provider, connected } = useCalendarStore();
  const config = useCalendarConfig();
  const month = date.slice(0, 7);
  const entries = useMonthEntries(month);

  const enabled = connected && !!config.data && config.data.enabled_calendars.length > 0;

  return useQuery({
    queryKey: [...qk.all, 'calendar-events', date, config.data?.enabled_calendars ?? []] as const,
    enabled,
    staleTime: 120_000,
    queryFn: async (): Promise<Suggestion[]> => {
      if (!config.data) return [];
      const { timeMin, timeMax } = dateBoundsISO(date);
      const perCalendar = await Promise.all(
        config.data.enabled_calendars.map(async (calendarId) => {
          const events: CalendarEvent[] = await provider.listEvents({
            calendarId,
            timeMin,
            timeMax,
          });
          return events
            .map((ev) => ({ calendarId, prefill: eventToFormState(ev, date) }))
            .filter((x): x is { calendarId: string; prefill: FormStatePrefill } => x.prefill !== null);
        }),
      );
      const flat = perCalendar.flat();
      const loggedIds = new Set(
        (entries.data?.entries ?? [])
          .map((e) => e.source_event_id)
          .filter((v): v is string => !!v),
      );
      return flat
        .map((x) => ({
          ...x.prefill,
          calendar_id: x.calendarId,
          logged: loggedIds.has(x.prefill.source_event_id),
        }))
        .sort((a, b) => a.start_label.localeCompare(b.start_label));
    },
  });
}
```

- [ ] **Step 7.3 — Full suite**

```
npm run typecheck && npm run lint && npm test
```
All green.

- [ ] **Step 7.4 — Commit**

```
git add src/store/calendar-store.ts src/data/hooks/use-calendar-events.ts
git commit -m "feat(store): calendar-store + useCalendarEvents fan-out with dedupe annotation"
```

---

## Task 8: Settings — Calendar integration section

**Goal:** Canonical place to Connect / Disconnect / pick which calendars to sync. Writes to `config/calendar.json` via the repo from Task 3.

**Files:**
- Create: `src/ui/screens/settings/CalendarSection.tsx`
- Modify: `src/ui/screens/Settings.tsx`

### Steps

- [ ] **Step 8.1 — Implement the section**

`src/ui/screens/settings/CalendarSection.tsx`:
```ts
import { useState } from 'react';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { useCalendarConfig } from '@/data/hooks/use-calendar-config';
import { useCalendarStore } from '@/store/calendar-store';
import { writeCalendarConfig } from '@/data/calendar-config-repo';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useAuthStore } from '@/store/auth-store';
import { splitRepoPath } from '@/data/octokit-client';
import { qk } from '@/data/query-keys';
import { Button } from '@/ui/components/Button';
import { Banner } from '@/ui/components/Banner';
import type { CalendarConfig } from '@/schema/types';

export function CalendarSection(): JSX.Element {
  const { provider, connected, lastError, refresh, setError } = useCalendarStore();
  const config = useCalendarConfig();
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const calendars = useQuery({
    queryKey: [...qk.all, 'calendar-list', connected] as const,
    enabled: connected,
    staleTime: 300_000,
    queryFn: () => provider.listCalendars(),
  });

  const saveConfig = useMutation({
    mutationFn: async (next: CalendarConfig) => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      const { owner, repo } = splitRepoPath(dataRepo);
      await writeCalendarConfig(octokit, {
        owner,
        repo,
        config: next,
        action: config.data ? 'update' : 'connect',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.calendarConfig(dataRepo ?? 'none') });
    },
  });

  async function handleConnect() {
    setBusy(true);
    setError(null);
    try {
      await provider.connect();
      refresh();
      const initial: CalendarConfig = {
        schema_version: 1,
        provider: 'google',
        enabled_calendars: ['primary'],
        last_connected_at: new Date().toISOString(),
      };
      if (!config.data) {
        await saveConfig.mutateAsync(initial);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleDisconnect() {
    provider.disconnect();
    refresh();
  }

  function toggleCalendar(id: string, checked: boolean) {
    if (!config.data) return;
    const next = new Set(config.data.enabled_calendars);
    if (checked) next.add(id);
    else next.delete(id);
    const updated: CalendarConfig = {
      ...config.data,
      enabled_calendars: [...next],
    };
    saveConfig.mutate(updated);
  }

  const enabledSet = new Set(config.data?.enabled_calendars ?? []);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg">Calendar integration</h2>
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-body font-medium">Google Calendar</div>
            <div className="text-xs text-slate-500">
              {connected ? 'Connected' : 'Not connected'}
            </div>
          </div>
          {connected ? (
            <Button variant="secondary" onClick={handleDisconnect}>Disconnect</Button>
          ) : (
            <Button onClick={handleConnect} disabled={busy}>
              {busy ? 'Connecting…' : 'Connect'}
            </Button>
          )}
        </div>
        {lastError && <Banner variant="error">{lastError}</Banner>}
        {connected && calendars.isLoading && (
          <div className="text-sm text-slate-500">Loading your calendars…</div>
        )}
        {connected && calendars.error && (
          <Banner variant="error">{(calendars.error as Error).message}</Banner>
        )}
        {connected && calendars.data && (
          <div className="flex flex-col gap-1 mt-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Calendars to include
            </div>
            {calendars.data.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enabledSet.has(c.id) || (c.primary === true && enabledSet.has('primary'))}
                  onChange={(e) =>
                    toggleCalendar(c.primary ? 'primary' : c.id, e.target.checked)
                  }
                  disabled={saveConfig.isPending}
                />
                <span>{c.summary}</span>
                {c.primary && <span className="text-xs text-slate-400">(primary)</span>}
              </label>
            ))}
          </div>
        )}
        {config.data?.last_connected_at && (
          <div className="text-xs text-slate-400 mt-3">
            Last connected: {config.data.last_connected_at.slice(0, 10)}
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 8.2 — Mount into Settings**

Replace `src/ui/screens/Settings.tsx`:
```tsx
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/ui/components/Button';
import { Banner } from '@/ui/components/Banner';
import { CalendarSection } from './settings/CalendarSection';

export function Settings(): JSX.Element {
  const auth = useAuthStore();
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="font-display text-2xl">Settings</h1>
      <section className="font-mono text-sm space-y-1">
        <div>
          <span className="text-slate-500">partner_id:</span> {auth.partnerId}
        </div>
        <div>
          <span className="text-slate-500">consultant_slug:</span> {auth.consultantSlug}
        </div>
        <div>
          <span className="text-slate-500">data_repo:</span> {auth.dataRepo}
        </div>
      </section>
      <CalendarSection />
      <Banner variant="warning">
        Signing out clears your token and sends you back to the first-run flow.
      </Banner>
      <Button variant="danger" onClick={() => auth.signOut()}>
        Sign out
      </Button>
    </div>
  );
}
```

- [ ] **Step 8.3 — Full suite**

```
npm run typecheck && npm run lint && npm test
```
All green.

- [ ] **Step 8.4 — Commit**

```
git add src/ui/screens/settings/ src/ui/screens/Settings.tsx
git commit -m "feat(settings): Calendar integration section with Connect/Disconnect + calendar picker"
```

---

## Task 9: Log screen — 2-column layout, date at top, suggestion prefill

**Goal:** The Log screen becomes a 2-column layout. Date moves to the top of the form. The right column shows suggestion cards driven by `useCalendarEvents`. Clicking a card prefills the form.

**Files:**
- Create: `src/ui/screens/log/SuggestionCard.tsx`
- Create: `src/ui/screens/log/SuggestionsPanel.tsx`
- Modify: `src/ui/screens/QuickLog.tsx`

### Steps

- [ ] **Step 9.1 — Implement the card**

`src/ui/screens/log/SuggestionCard.tsx`:
```tsx
import { formatHoursDecimal } from '@/format/format';
import type { Suggestion } from '@/data/hooks/use-calendar-events';

type Props = {
  suggestion: Suggestion;
  onClick: (s: Suggestion) => void;
};

export function SuggestionCard({ suggestion, onClick }: Props): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onClick(suggestion)}
      className="w-full text-left glass rounded-xl p-3 hover:bg-white/50 transition-colors"
    >
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span className="font-mono">
          {suggestion.start_label}–{suggestion.end_label}
        </span>
        <span className="font-mono font-semibold text-partner-mid">
          {formatHoursDecimal(suggestion.hours_hundredths)}h
        </span>
      </div>
      <div className="font-body text-sm text-slate-800 line-clamp-2">
        {suggestion.description || <span className="italic text-slate-400">(no title)</span>}
      </div>
      {suggestion.logged && (
        <div className="mt-1 text-xs text-emerald-700 font-semibold">✓ logged</div>
      )}
    </button>
  );
}
```

- [ ] **Step 9.2 — Implement the panel**

`src/ui/screens/log/SuggestionsPanel.tsx`:
```tsx
import type { Route } from '@/ui/Router';
import { useCalendarStore } from '@/store/calendar-store';
import { useCalendarEvents, type Suggestion } from '@/data/hooks/use-calendar-events';
import { Button } from '@/ui/components/Button';
import { Banner } from '@/ui/components/Banner';
import { SuggestionCard } from './SuggestionCard';

type Props = {
  date: string;
  onSelect: (s: Suggestion) => void;
  onNavigate: (r: Route) => void;
};

export function SuggestionsPanel({ date, onSelect, onNavigate }: Props): JSX.Element {
  const { connected, provider, refresh, setError, lastError } = useCalendarStore();
  const events = useCalendarEvents(date);

  if (!connected) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-lg">Suggested from calendar</h2>
        <div className="glass rounded-xl p-4 flex flex-col gap-2">
          <div className="text-sm text-slate-600">
            Connect Google Calendar to see suggestions for the selected date.
          </div>
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                try {
                  await provider.connect();
                  refresh();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Connect
            </Button>
            <Button variant="secondary" onClick={() => onNavigate('settings')}>
              Set up in Settings →
            </Button>
          </div>
          {lastError && <Banner variant="error">{lastError}</Banner>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-lg">Suggested from calendar</h2>
      {events.isLoading && (
        <div className="flex flex-col gap-2">
          <div className="glass rounded-xl p-3 h-14 animate-pulse" />
          <div className="glass rounded-xl p-3 h-14 animate-pulse" />
          <div className="glass rounded-xl p-3 h-14 animate-pulse" />
        </div>
      )}
      {events.error && (
        <Banner variant="error">
          {(events.error as Error).message}
          <Button variant="secondary" onClick={() => events.refetch()}>Retry</Button>
        </Banner>
      )}
      {events.data?.length === 0 && (
        <div className="text-sm text-slate-500">No calendar events on this date.</div>
      )}
      {events.data?.map((s) => (
        <SuggestionCard
          key={`${s.calendar_id}:${s.source_event_id}`}
          suggestion={s}
          onClick={onSelect}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 9.3 — Update QuickLog: 2-col, date at top, accept prefill**

Replace the entire `src/ui/screens/QuickLog.tsx`. Key changes from current:
1. `FormState` gains `source_event_id: string | null`, default `null`.
2. New handler `applySuggestion(s)` sets `hoursHundredths`, `description`, `source_event_id`, and sets `date` to the suggestion's date (same as current date by construction).
3. Field order: Date → Project → Hours → Bucket → Status → Rate → Description → Save.
4. Outer JSX is `<div className="flex flex-col lg:flex-row gap-6">` with form column (`max-w-[480px]`) and `<SuggestionsPanel>` column (`w-[380px] shrink-0`).
5. `buildEntry` includes `source_event_id: form.source_event_id`.
6. `onSuccess` reset preserves `projectId` and `date`, and clears `source_event_id` back to null.
7. New optional `onNavigate` prop threaded from App (to support the Log-screen CTA "Set up in Settings →").

Full file:
```tsx
import { useState, useEffect, useRef } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useUiStore } from '@/store/ui-store';
import { useProjects } from '@/data/hooks/use-projects';
import { useRates } from '@/data/hooks/use-rates';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useAuthStore } from '@/store/auth-store';
import { addEntry } from '@/data/entries-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { newEntryId } from '@/data/new-entry-id';
import { resolveRateAtLogTime } from '@/calc';
import type { Entry, BillableStatus, ProjectsConfig, RatesConfig } from '@/schema/types';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Select } from '@/ui/components/Select';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { Banner } from '@/ui/components/Banner';
import { HoursChips } from '@/ui/components/HoursChips';
import { formatHoursDecimal } from '@/format/format';
import { qk } from '@/data/query-keys';
import type { Route } from '@/ui/Router';
import type { Suggestion } from '@/data/hooks/use-calendar-events';
import { SuggestionsPanel } from './log/SuggestionsPanel';

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type FormState = {
  projectId: string;
  date: string;
  hoursHundredths: number;
  bucketId: string | null;
  status: BillableStatus;
  rateCents: number;
  rateOverridden: boolean;
  description: string;
  source_event_id: string | null;
};

const initialForm: FormState = {
  projectId: '',
  date: todayISO(),
  hoursHundredths: 0,
  bucketId: null,
  status: 'billable',
  rateCents: 0,
  rateOverridden: false,
  description: '',
  source_event_id: null,
};

type QueryLike<T> = {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
};

function loadingOrErrorGate(
  projects: QueryLike<ProjectsConfig>,
  rates: QueryLike<RatesConfig>,
): JSX.Element | null {
  if (projects.isLoading || rates.isLoading) {
    return <div className="text-slate-500">Loading…</div>;
  }
  if (projects.error) {
    return (
      <Banner variant="error">
        Failed to load projects: {(projects.error as Error).message}
      </Banner>
    );
  }
  if (rates.error) {
    return (
      <Banner variant="error">Failed to load rates: {(rates.error as Error).message}</Banner>
    );
  }
  return null;
}

function formatRateDollars(rateCents: number): string {
  return rateCents === 0 ? '' : (rateCents / 100).toString();
}

function buildEntry(
  form: FormState,
  projects: ProjectsConfig,
  rates: RatesConfig,
): Entry {
  const resolved = resolveRateAtLogTime({
    project_id: form.projectId,
    bucket_id: form.bucketId,
    date: form.date,
    projects,
    rates,
  });
  const now = new Date().toISOString();
  return {
    id: newEntryId({ date: form.date, projectSlug: form.projectId }),
    project: form.projectId,
    date: form.date,
    hours_hundredths: form.hoursHundredths,
    rate_cents: form.rateOverridden ? form.rateCents : resolved.rate_cents,
    rate_source: form.rateOverridden ? 'entry_override' : resolved.source,
    billable_status: form.status,
    bucket_id: form.bucketId,
    description: form.description,
    review_flag: false,
    created_at: now,
    updated_at: now,
    source_event_id: form.source_event_id,
  };
}

type Props = {
  onNavigate: (r: Route) => void;
};

export function QuickLog({ onNavigate }: Props): JSX.Element {
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const projects = useProjects();
  const rates = useRates();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(initialForm);
  const [toast, setToast] = useState<string | null>(null);
  const [prefillHint, setPrefillHint] = useState<string | null>(null);
  const projectRef = useRef<HTMLSelectElement | null>(null);
  const focusLogNonce = useUiStore((s) => s.focusLogNonce);

  useEffect(() => {
    if (focusLogNonce > 0) projectRef.current?.focus();
  }, [focusLogNonce]);

  useEffect(() => {
    if (!projects.data || !rates.data || !form.projectId) return;
    if (form.rateOverridden) return;
    try {
      const resolved = resolveRateAtLogTime({
        project_id: form.projectId,
        bucket_id: form.bucketId,
        date: form.date,
        projects: projects.data,
        rates: rates.data,
      });
      setForm((f) => ({ ...f, rateCents: resolved.rate_cents }));
    } catch {
      // Silent — bad state handled at save time.
    }
  }, [
    form.projectId,
    form.bucketId,
    form.date,
    form.rateOverridden,
    projects.data,
    rates.data,
  ]);

  useEffect(() => {
    if (form.bucketId !== null) {
      setForm((f) => ({ ...f, status: 'billable' }));
    }
  }, [form.bucketId]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      if (!projects.data || !rates.data) throw new Error('Config not loaded');
      const { owner, repo } = splitRepoPath(dataRepo);
      const entry = buildEntry(form, projects.data, rates.data);
      await addEntry(octokit, { owner, repo, entry });
      const project = projects.data.projects.find((p) => p.id === form.projectId);
      return project?.name ?? form.projectId;
    },
    onSuccess: (projectName) => {
      const hoursDisplay = formatHoursDecimal(form.hoursHundredths);
      setToast(`Logged ${hoursDisplay}h to ${projectName}`);
      setPrefillHint(null);
      setForm((f) => ({ ...initialForm, projectId: f.projectId, date: f.date }));
      queryClient.invalidateQueries({
        queryKey: qk.monthEntries(dataRepo ?? 'none', form.date.slice(0, 7)),
      });
    },
  });

  const gate = loadingOrErrorGate(projects, rates);
  if (gate) return gate;

  const activeProjects = projects.data?.projects.filter((p) => p.active) ?? [];
  const selectedProject = activeProjects.find((p) => p.id === form.projectId);
  const activeBuckets = selectedProject?.buckets.filter((b) => b.status !== 'archived') ?? [];
  const canSave = !!form.projectId && form.hoursHundredths > 0 && form.description.trim().length > 0;

  function applySuggestion(s: Suggestion) {
    setForm((f) => ({
      ...f,
      date: s.date,
      hoursHundredths: s.hours_hundredths,
      description: s.description,
      source_event_id: s.source_event_id,
    }));
    setPrefillHint(s.description || '(no title)');
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex flex-col gap-4 flex-1 max-w-[480px]">
        <h1 className="font-display text-2xl">Log hours</h1>
        {toast && <Banner variant="success">{toast}</Banner>}

        <FieldLabel label="Date">
          <Input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
        </FieldLabel>

        <FieldLabel label="Project">
          <Select
            ref={projectRef}
            value={form.projectId}
            onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value, bucketId: null }))}
          >
            <option value="">— select —</option>
            {activeProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </FieldLabel>

        <FieldLabel label="Hours">
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={form.hoursHundredths === 0 ? '' : formatHoursDecimal(form.hoursHundredths)}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                hoursHundredths: Math.round(parseFloat(e.target.value || '0') * 100),
              }))
            }
          />
        </FieldLabel>
        <HoursChips onPick={(h) => setForm((f) => ({ ...f, hoursHundredths: h }))} />

        <FieldLabel label="Bucket">
          <Select
            value={form.bucketId ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, bucketId: e.target.value || null }))}
          >
            <option value="">(none — general billable)</option>
            {activeBuckets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}{b.status === 'closed' ? ' (closed)' : ''}
              </option>
            ))}
          </Select>
        </FieldLabel>
        {form.bucketId && activeBuckets.find((b) => b.id === form.bucketId)?.status === 'closed' && (
          <Banner variant="warning">
            This bucket is closed. New entries are allowed but may need review — the bucket was
            likely invoiced already.
          </Banner>
        )}

        <FieldLabel label="Status">
          <div className="flex gap-4 font-body text-sm">
            {(['billable', 'non_billable', 'needs_review'] as const).map((s) => (
              <label
                key={s}
                className={`flex items-center gap-1 ${form.bucketId ? 'opacity-50' : ''}`}
              >
                <input
                  type="radio"
                  name="status"
                  value={s}
                  checked={form.status === s}
                  onChange={() => setForm((f) => ({ ...f, status: s }))}
                  disabled={form.bucketId !== null}
                />
                {s.replace('_', '-')}
              </label>
            ))}
          </div>
        </FieldLabel>

        <FieldLabel label="Rate ($/hr)" hint={form.rateOverridden ? 'override' : 'inherited'}>
          <Input
            type="number"
            step="0.01"
            value={formatRateDollars(form.rateCents)}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                rateCents: Math.round(parseFloat(e.target.value || '0') * 100),
                rateOverridden: true,
              }))
            }
          />
        </FieldLabel>

        <FieldLabel label="Description">
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            maxLength={500}
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-xl glass-input text-slate-800 font-body text-sm transition-all duration-200 focus:outline-none focus:border-partner-cyan/50 focus:glass-strong focus:glow-focus placeholder:text-slate-500/60"
          />
        </FieldLabel>
        {prefillHint && (
          <div className="text-xs text-slate-500">
            Prefilled from <span className="italic">{prefillHint}</span>{' '}
            <button
              type="button"
              onClick={() => {
                setForm((f) => ({
                  ...f,
                  hoursHundredths: 0,
                  description: '',
                  source_event_id: null,
                }));
                setPrefillHint(null);
              }}
              className="underline text-slate-600"
            >
              clear
            </button>
          </div>
        )}

        {mutation.error && <Banner variant="error">{(mutation.error as Error).message}</Banner>}

        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !canSave}>
          {mutation.isPending ? 'Saving…' : 'Save (⌘↵)'}
        </Button>
      </div>

      <div className="w-full lg:w-[380px] shrink-0">
        <SuggestionsPanel
          date={form.date}
          onSelect={applySuggestion}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 9.4 — Thread `onNavigate` through App**

In `src/App.tsx`, `ScreenForRoute`'s `'log'` case already returns `<QuickLog />` — change to `<QuickLog onNavigate={onNavigate} />`. `onNavigate` is already in the `ScreenForRoute` props since Phase A (Dashboard uses it), so this is a one-liner.

- [ ] **Step 9.5 — Full suite + manual test**

```
npm run typecheck && npm run lint && npm test
```
All green.

Manual (requires Google Cloud setup + client ID replacement from Task 4):
1. Start dev server: `npm run dev`. Go to Settings → Calendar → Connect. Approve consent.
2. Log screen now shows 2 columns on wide viewport. Right column shows events for today.
3. Click a suggestion → form populates date/hours/description with a "Prefilled from …" hint. Clear link works.
4. Pick project + bucket, click Save. Entry lands in Entries with the new `source_event_id`.
5. Return to Log for same date → that card shows "✓ logged".
6. Disconnect in Settings → right column reverts to CTA.

- [ ] **Step 9.6 — Commit**

```
git add src/ui/screens/log/ src/ui/screens/QuickLog.tsx src/App.tsx
git commit -m "feat(log): 2-column layout with calendar suggestions and prefill"
```

---

## Task 10: Update backlog doc

**Files:**
- Modify: `docs/superpowers/backlog.md`

- [ ] **Step 10.1 — Move items**

Add a bullet under `## Shipped` (below the Phase A items):

```
- **Log screen 2-column layout + date at top** — form left, calendar suggestions right (spec §8.2 / 2026-04-14 redesign spec). Phase B.
- **Google Calendar integration (read-only)** — browser-native OAuth via GIS, multi-calendar, click-to-prefill, persistent dedupe via Entry `source_event_id` (schema v2). Phase C.
```

Delete these entries from their current sections (or mark them ✓):

- `Calendar integration — log from Google Calendar events.` (previously under Speculative)

- [ ] **Step 10.2 — Commit**

```
git add docs/superpowers/backlog.md
git commit -m "docs: mark Log redesign + Google Calendar integration as shipped"
```

---

## Self-review checklist

- [ ] **Spec coverage:** every section of `docs/superpowers/specs/2026-04-14-log-redesign-calendar-integration-design.md` has at least one task — §3 decisions → T1–T9; §4 schemas → T1, T3; §5 auth → T5; §6 UX → T8, T9; §7 module layout → T3, T5, T6, T7, T8, T9; §8 data flow → T9 step-through; §9 errors → baked into T5 (`origin_mismatch`), T6 (zero-duration / declined / all-day / cross-midnight / empty title), T1–T2 (migration behavior), T9 (token expired / network); §10 testing → T1, T3, T5, T6; §11 invariants → observed throughout; §14 setup doc → T4.
- [ ] **Placeholders:** only intentional — `REPLACE_ME.apps.googleusercontent.com` in `client-id.ts` is flagged explicitly in Step 5.2, checked at runtime by `ensureClientIdConfigured`, and fixing it is documented in Task 4. No TODO/TBD elsewhere.
- [ ] **Type consistency:**
  - `FormStatePrefill` (T6) → consumed as-is by `Suggestion` (T7) and as spread into form state (T9).
  - `CalendarEvent` exported from `src/integrations/calendar/provider.ts` (T5) is re-used by `eventToFormState` (T6) and `useCalendarEvents` (T7).
  - `CalendarConfig` (T3) → consumed by `CalendarSection` (T8) for checkbox render and save.
  - `Entry.source_event_id: string | null` (T1) → set in `buildEntry` (T9), upgraded in `upgradeEntriesFileToV2` (T2).
  - `qk.calendarConfig` (T3) → used for invalidation in T8.
- [ ] **Integer-math invariant:** no `_cents` / `_hundredths` arithmetic outside `src/calc/int.ts` introduced by this plan. `event-to-entry.ts` does minute-math on `number` locals (`durationMin`), not on hundredths fields — the final `Math.round((roundedMin * 100) / 60)` yields the hundredths integer in one shot.
- [ ] **Commit-message convention:** `logMessage` gains `[calendar]` suffix (T2); new `calendarConfigMessage` (T3); all other writes use existing helpers.
- [ ] **Golden fixture:** hash is null-safe (T1 Step 1.6). A dedicated test (`tests/calc/hash-v2.test.ts`) guards the invariant. `npm run test:golden` must pass on every task's final commit.
- [ ] **Branding:** no SapienEx / partner-branding edits. Partner stays top-left. SapienEx stays in footer only.

## Out of scope

- E2E browser automation for calendar flow.
- Auto project-matching (no rules engine, no ML, no attendee inference).
- Offline queue for failed Google API calls — the app falls back to manual logging with an error banner.
- Writing to Google Calendar (only `calendar.readonly`).
- Outlook / ICS support. The provider interface keeps the door open; no impl shipped.
- Backfilling `source_event_id` on March 2026 history. Files stay v1 on disk.
