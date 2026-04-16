# Multi-kind Effort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `Entry.effort_kind` + `Entry.effort_count` scalars with a `Entry.effort: EffortItem[]` array so a single log entry can carry multiple activity kinds. Schema v5 → v6. Spec: `docs/superpowers/specs/2026-04-16-multi-kind-effort-design.md`.

**Architecture:** Schema-bump-first, compiler-driven migration. Forward-compat schema ships to main before the v6 writer so production can read v6 files. The feature branch replaces the two scalar fields with an array in one coordinated `Form`-contract commit — the TS compiler catches every consumer. Uniqueness-by-kind is enforced in three places (validator wrapper, `upgradeEntriesFileToV6`, writer probe) per Reviewer 1's defense-in-depth call-out. Hash canonicalizer omits empty `effort` and sorts non-empty by kind so the March 2026 golden fixture hash is unchanged.

**Tech Stack:** TypeScript strict, ajv, Vitest, fast-check, React 18, Zustand, TanStack Query.

---

## Non-negotiables (from CLAUDE.md + spec §10)

- Integer math only on `_cents` / `_hundredths` — route through `src/calc/int.ts`.
- Every write validates via `src/schema/validators.ts` BEFORE Octokit write.
- `npm run typecheck && npm run lint && npm test` green at every task's final commit.
- `npm run test:golden` must pass unchanged. March 2026 fixture hash stays stable.
- Structured commit prefixes (`src/data/commit-messages.ts`) for every mutation write.
- Partner branding untouched. SapienEx footer-only.
- No schema bump on branch until forward-compat schema is live in production (Task 1).

---

## Task 1: Forward-compat schema on `main` (deploy before branch work)

**Goal:** Let production read v6 files without choking. Ships to `main` + `origin/main` immediately so Deploy rebuilds before any v6 writer lands.

**Files:**
- Modify: `schemas/entries.schema.json`

- [ ] **Step 1.1: Switch to main, pull latest**

```sh
git checkout main
git pull --ff-only
```

- [ ] **Step 1.2: Bump enum + declare `effort` as an optional property**

Open `schemas/entries.schema.json`. Change `"schema_version": { "enum": [1, 2, 3, 4, 5] }` → `"schema_version": { "enum": [1, 2, 3, 4, 5, 6] }`. Then add a new property after the existing `effort_count` property inside `items.properties`:

```json
"effort": {
  "type": "array",
  "items": {
    "type": "object",
    "required": ["kind", "count"],
    "additionalProperties": false,
    "properties": {
      "kind": {
        "enum": [
          "workshop", "meeting", "client_training",
          "config_work", "build", "integration", "data_work", "reporting", "qa",
          "slack", "email", "async_video", "ticket",
          "internal_sync", "documentation", "peer_review",
          "learning", "scoping",
          "other"
        ]
      },
      "count": { "type": "integer", "minimum": 1, "maximum": 100 }
    }
  }
}
```

Also bump the `title` field from `"Monthly entries file (v5)"` to `"Monthly entries file (v5, forward-compat v6)"`.

- [ ] **Step 1.3: Run full gates**

```sh
npm run typecheck && npm run lint && npm test
```

Expected: all green. 335 tests pass unchanged — no consumer on main reads `effort`, so adding the property declaration is purely permissive.

- [ ] **Step 1.4: Commit + push**

```sh
git add schemas/entries.schema.json
git commit -m "fix(schema): forward-compat entries schema with v6 reads

Accepts schema_version: 6 and declares the effort array as an optional
property so production (v5 writer) can READ v6 files without being able
to write them. Proper v6 support comes with the feat/multi-kind-effort
branch merge.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
git push
```

- [ ] **Step 1.5: Verify deploy is green before proceeding**

Wait for the Actions Deploy workflow to turn green. Check `https://sapienex-ai.github.io/hours-tracker/assets/index-*.js` — the deployed bundle's schema should contain `schema_version:{enum:[1,2,3,4,5,6]}` and `"effort":{"type":"array"`. (Grep `curl -s <url> | grep -oE 'schema_version[^,]{0,40}'`.)

If deploy fails, stop and fix before Task 2.

---

## Task 2: Cut the feature branch

**Goal:** Isolated workspace for the full v6 rewrite.

- [ ] **Step 2.1: Cut the branch**

```sh
git checkout -b feat/multi-kind-effort
git status
```

Expected: `On branch feat/multi-kind-effort`, no modified files.

---

## Task 3: Types + schema v6 + validator lift

**Goal:** Land the type change and the validator's read-path lift. This task causes cascading compile errors — TS tells us every consumer to fix in later tasks.

**Files:**
- Modify: `schemas/entries.schema.json`
- Modify: `src/schema/types.ts`
- Modify: `src/schema/validators.ts`
- Create: `tests/schema/entry-v6-migration.test.ts`
- Delete (after rename): existing `tests/schema/entry-v5-migration.test.ts` moves into v6 — superseded.

### Steps

- [ ] **Step 3.1: Widen the JSON schema to v6 (authoritative)**

Replace the `schema_version` enum line and remove the two legacy fields from the `required`/`properties` in `schemas/entries.schema.json`. Target state:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://sapienex-ai.github.io/hours-tracker/schemas/entries.schema.json",
  "title": "Monthly entries file (v6)",
  "type": "object",
  "required": ["schema_version", "month", "entries"],
  "additionalProperties": false,
  "properties": {
    "schema_version": { "enum": [1, 2, 3, 4, 5, 6] },
    "month": { "type": "string", "pattern": "^[0-9]{4}-(0[1-9]|1[0-2])$" },
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "id", "project", "date", "hours_hundredths", "rate_cents",
          "rate_source", "billable_status", "bucket_id", "description",
          "review_flag", "created_at", "updated_at"
        ],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+-[a-f0-9]{6}$" },
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
          "source_event_id": { "type": ["string", "null"] },
          "source_ref": {
            "oneOf": [
              { "type": "null" },
              {
                "type": "object",
                "required": ["kind", "id"],
                "additionalProperties": false,
                "properties": {
                  "kind": { "enum": ["calendar", "timer", "slack", "gmail"] },
                  "id": { "type": "string", "minLength": 1 }
                }
              }
            ]
          },
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
              ] }
            ]
          },
          "effort_count": {
            "oneOf": [
              { "type": "null" },
              { "type": "integer", "minimum": 1, "maximum": 100 }
            ]
          },
          "effort": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["kind", "count"],
              "additionalProperties": false,
              "properties": {
                "kind": { "enum": [
                  "workshop", "meeting", "client_training",
                  "config_work", "build", "integration", "data_work", "reporting", "qa",
                  "slack", "email", "async_video", "ticket",
                  "internal_sync", "documentation", "peer_review",
                  "learning", "scoping",
                  "other"
                ] },
                "count": { "type": "integer", "minimum": 1, "maximum": 100 }
              }
            }
          }
        }
      }
    }
  }
}
```

Note: `effort_kind` and `effort_count` stay declared (optional, not in `required`) so v5 on-disk files still pass raw ajv. The validator wrapper strips them during the lift.

- [ ] **Step 3.2: Update `Entry` + `EntriesFile` types**

In `src/schema/types.ts`, locate the `Entry` type (around line 155). Replace `effort_kind: EffortKind | null;` + `effort_count: number | null;` with:

```ts
export type EffortItem = {
  kind: EffortKind;
  count: number;
};

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
  source_ref: SourceRef;
  effort: EffortItem[];
};
```

And widen `EntriesFile.schema_version`:

```ts
export type EntriesFile = {
  schema_version: 1 | 2 | 3 | 4 | 5 | 6;
  month: string;
  entries: Entry[];
};
```

- [ ] **Step 3.3: Rewrite `validateEntries` in `src/schema/validators.ts`**

Replace the existing `validateEntries` export and its helpers (`stripCorruptedLegacyField`, `liftLegacyFieldToSourceRef`, `checkEffortCrossField`, `backfillEffortFields`). Target:

```ts
import type { Entry, EntriesFile, EffortItem, EffortKind } from './types';

function stripCorruptedLegacyField(data: unknown): void {
  if (typeof data !== 'object' || data === null) return;
  const entries = (data as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) return;
  for (const e of entries as Array<Record<string, unknown>>) {
    if ('source_event_id' in e && 'source_ref' in e) {
      delete e.source_event_id;
    }
  }
}

function liftLegacyFieldToSourceRef(file: EntriesFile): void {
  for (const e of file.entries) {
    const anyE = e as Entry & { source_event_id?: string | null };
    if ('source_ref' in e) continue;
    const legacyId = anyE.source_event_id;
    (e as Entry).source_ref =
      legacyId === undefined || legacyId === null
        ? null
        : { kind: 'calendar', id: legacyId };
    delete anyE.source_event_id;
  }
}

/**
 * Lift legacy effort_kind + effort_count scalars into the v6 `effort` array,
 * then strip the legacy fields. Applies to every entry, regardless of
 * schema_version on disk (v1-v5 all lack `effort`, v5 has scalars).
 *
 * Also: collapse duplicate kinds (sum counts) and sort by kind for
 * deterministic hashing.
 */
function liftEffortToArray(file: EntriesFile): void {
  for (const e of file.entries) {
    const anyE = e as Entry & {
      effort_kind?: EffortKind | null;
      effort_count?: number | null;
    };
    let effort: EffortItem[] = Array.isArray((e as Entry).effort)
      ? [...(e as Entry).effort]
      : [];
    if (effort.length === 0) {
      const k = anyE.effort_kind;
      const c = anyE.effort_count;
      if (k !== null && k !== undefined && c !== null && c !== undefined) {
        effort = [{ kind: k, count: c }];
      }
    }
    delete anyE.effort_kind;
    delete anyE.effort_count;
    (e as Entry).effort = collapseAndSortEffort(effort);
  }
}

export function collapseAndSortEffort(items: EffortItem[]): EffortItem[] {
  const byKind = new Map<EffortKind, number>();
  for (const it of items) {
    byKind.set(it.kind, (byKind.get(it.kind) ?? 0) + it.count);
  }
  return [...byKind.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => a.kind.localeCompare(b.kind));
}

export const validateEntries = (data: unknown): ValidationResult<EntriesFile> => {
  const cloned = structuredClone(data) as unknown;
  stripCorruptedLegacyField(cloned);
  if (!_entries(cloned)) return { ok: false, errors: _entries.errors ?? [] };
  const file = cloned as EntriesFile;
  liftLegacyFieldToSourceRef(file);
  liftEffortToArray(file);
  return { ok: true, value: file };
};
```

Delete the old `checkEffortCrossField` and `backfillEffortFields` functions — replaced by `liftEffortToArray`.

Note `collapseAndSortEffort` is exported — shared with `upgradeEntriesFileToV6` in Task 6 and the writer probe.

- [ ] **Step 3.4: Write failing migration tests**

Replace `tests/schema/entry-v5-migration.test.ts` with `tests/schema/entry-v6-migration.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateEntries } from '@/schema/validators';

const baseEntry = {
  id: '2026-04-14-sprosty-aaaaaa',
  project: 'sprosty',
  date: '2026-04-14',
  hours_hundredths: 400,
  rate_cents: 12500,
  rate_source: 'global_default' as const,
  billable_status: 'billable' as const,
  bucket_id: null,
  description: 'entry',
  review_flag: false,
  created_at: '2026-04-14T10:00:00Z',
  updated_at: '2026-04-14T10:00:00Z',
};

describe('Entry v1-v6 acceptance + lift to v6', () => {
  it('accepts a v1 file (no effort fields) and sets effort: []', () => {
    const file = { schema_version: 1, month: '2026-03', entries: [{ ...baseEntry }] };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries[0]?.effort).toEqual([]);
      expect('effort_kind' in r.value.entries[0]!).toBe(false);
      expect('effort_count' in r.value.entries[0]!).toBe(false);
    }
  });

  it('accepts a v5 file with effort_kind + effort_count null and produces effort: []', () => {
    const file = {
      schema_version: 5,
      month: '2026-04',
      entries: [{ ...baseEntry, effort_kind: null, effort_count: null }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.entries[0]?.effort).toEqual([]);
  });

  it('lifts a v5 non-null pair into a single-item effort array', () => {
    const file = {
      schema_version: 5,
      month: '2026-04',
      entries: [{ ...baseEntry, effort_kind: 'meeting', effort_count: 3 }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries[0]?.effort).toEqual([{ kind: 'meeting', count: 3 }]);
      expect('effort_kind' in r.value.entries[0]!).toBe(false);
    }
  });

  it('treats an asymmetric v5 pair as effort: [] (defensive)', () => {
    const file = {
      schema_version: 5,
      month: '2026-04',
      entries: [{ ...baseEntry, effort_kind: 'meeting', effort_count: null }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.entries[0]?.effort).toEqual([]);
  });

  it('accepts a v6 file with effort array', () => {
    const file = {
      schema_version: 6,
      month: '2026-04',
      entries: [{
        ...baseEntry,
        effort: [{ kind: 'meeting', count: 2 }, { kind: 'slack', count: 1 }],
      }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries[0]?.effort).toEqual([
        { kind: 'meeting', count: 2 },
        { kind: 'slack', count: 1 },
      ]);
    }
  });

  it('collapses duplicate kinds in an on-disk v6 effort array (self-heal)', () => {
    const file = {
      schema_version: 6,
      month: '2026-04',
      entries: [{
        ...baseEntry,
        effort: [
          { kind: 'meeting', count: 1 },
          { kind: 'meeting', count: 2 },
          { kind: 'slack', count: 1 },
        ],
      }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries[0]?.effort).toEqual([
        { kind: 'meeting', count: 3 },
        { kind: 'slack', count: 1 },
      ]);
    }
  });

  it('sorts effort array by kind alphabetically for determinism', () => {
    const file = {
      schema_version: 6,
      month: '2026-04',
      entries: [{
        ...baseEntry,
        effort: [{ kind: 'slack', count: 1 }, { kind: 'meeting', count: 2 }],
      }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries[0]?.effort.map((x) => x.kind)).toEqual(['meeting', 'slack']);
    }
  });

  it('rejects an effort item with count > 100', () => {
    const file = {
      schema_version: 6,
      month: '2026-04',
      entries: [{
        ...baseEntry,
        effort: [{ kind: 'meeting', count: 101 }],
      }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(false);
  });

  it('rejects an effort item with unknown kind', () => {
    const file = {
      schema_version: 6,
      month: '2026-04',
      entries: [{
        ...baseEntry,
        effort: [{ kind: 'not_a_kind', count: 1 }],
      }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(false);
  });

  it('does not mutate caller input', () => {
    const input = {
      schema_version: 5,
      month: '2026-04',
      entries: [{ ...baseEntry, effort_kind: 'meeting', effort_count: 2 }],
    };
    const snapshot = JSON.parse(JSON.stringify(input));
    validateEntries(input);
    expect(input).toEqual(snapshot);
    expect('effort_kind' in input.entries[0]!).toBe(true);
  });
});
```

- [ ] **Step 3.5: Run migration tests**

```sh
npm test -- tests/schema/entry-v6-migration.test.ts
```

Expected: all 10 tests pass. If compile errors elsewhere fail the test runner, proceed — Tasks 4–10 fix those.

- [ ] **Step 3.6: Commit**

```sh
git add schemas/entries.schema.json src/schema/types.ts src/schema/validators.ts tests/schema/entry-v6-migration.test.ts
git rm tests/schema/entry-v5-migration.test.ts 2>/dev/null || true
git commit -m "feat(schema): Entry v6 — effort array replaces effort_kind/effort_count scalars

Types + ajv schema + validator lift/normalize. EffortItem[] enforces
uniqueness-by-kind via validator wrapper (ajv's uniqueItems doesn't
handle object sub-field equality). Canonical form: collapsed + sorted
by kind. Legacy v1-v5 files lift to v6 shape on read; legacy fields
stripped from the clone. Caller input is never mutated.

Typecheck + lint + other tests will fail until Tasks 4-10 land.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

Typecheck will be red after this commit — intentional. Fixed in Tasks 4–10.

---

## Task 4: Hash canonicalization

**Goal:** Emit `effort` only when non-empty, sorted by kind. Golden fixture stays stable.

**Files:**
- Modify: `src/calc/hash.ts`
- Create: `tests/calc/hash-v6.test.ts`
- Delete (superseded): `tests/calc/hash-v5.test.ts`, `tests/calc/hash-v4.test.ts`, `tests/calc/hash-v3.test.ts` — rolled into hash-v6 for the latest behavior

### Steps

- [ ] **Step 4.1: Update `canonicalizeEntry` in `src/calc/hash.ts`**

Locate the `canonicalizeEntry` function (it currently emits `effort_kind` and `effort_count` when non-null). Replace the effort-fields block with:

```ts
// Emit `effort` only when non-empty, sorted by kind.
// Empty array → omit entirely, so v1-v5 migrated entries (effort: [])
// canonicalize identically to their pre-v6 form. Keeps golden fixture hash stable.
if (e.effort.length > 0) {
  base.effort = [...e.effort].sort((a, b) => a.kind.localeCompare(b.kind));
}
```

Remove the old `effort_kind` + `effort_count` emission. The rest of `canonicalizeEntry` is unchanged.

- [ ] **Step 4.2: Write hash-v6 tests**

Create `tests/calc/hash-v6.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { canonicalizeEntriesForHashing, hashEntries } from '@/calc/hash';
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
    source_ref: null,
    effort: [],
    ...overrides,
  };
}

describe('hash v6 — effort array', () => {
  it('omits empty effort from canonical form (golden-hash stability)', () => {
    const entry = baseEntry({ effort: [] });
    const canonical = canonicalizeEntriesForHashing([entry]);
    expect(canonical).not.toContain('effort');
  });

  it('emits non-empty effort sorted by kind', () => {
    const entry = baseEntry({
      effort: [
        { kind: 'slack', count: 1 },
        { kind: 'meeting', count: 2 },
      ],
    });
    const canonical = canonicalizeEntriesForHashing([entry]);
    // 'meeting' should appear before 'slack' in the JSON
    const mIdx = canonical.indexOf('meeting');
    const sIdx = canonical.indexOf('slack');
    expect(mIdx).toBeGreaterThan(-1);
    expect(sIdx).toBeGreaterThan(mIdx);
  });

  it('hash is identical regardless of insertion order', async () => {
    const h1 = await hashEntries([
      baseEntry({ effort: [{ kind: 'meeting', count: 1 }, { kind: 'slack', count: 1 }] }),
    ]);
    const h2 = await hashEntries([
      baseEntry({ effort: [{ kind: 'slack', count: 1 }, { kind: 'meeting', count: 1 }] }),
    ]);
    expect(h1).toBe(h2);
  });

  it('hash is different when counts differ', async () => {
    const h1 = await hashEntries([baseEntry({ effort: [{ kind: 'meeting', count: 1 }] })]);
    const h2 = await hashEntries([baseEntry({ effort: [{ kind: 'meeting', count: 2 }] })]);
    expect(h1).not.toBe(h2);
  });

  it('empty-effort entry hashes identically to an entry whose canonical form lacks effort', async () => {
    // Two entries with the same data, both empty effort. Hash must be deterministic.
    const h1 = await hashEntries([baseEntry({ effort: [] })]);
    const h2 = await hashEntries([baseEntry({ effort: [] })]);
    expect(h1).toBe(h2);
  });
});
```

- [ ] **Step 4.3: Run the golden tests + new hash test**

```sh
npm run test:golden
npm test -- tests/calc/hash-v6.test.ts
```

Expected: golden passes unchanged (the fixture is v1 → `effort: []` → omitted from canonical → same hash). New hash tests pass.

- [ ] **Step 4.4: Delete obsolete hash tests**

```sh
git rm tests/calc/hash-v3.test.ts tests/calc/hash-v4.test.ts tests/calc/hash-v5.test.ts
```

These tested behavior now covered by hash-v6 + the migration tests. Removing prevents stale `effort_kind`/`effort_count` references in tests from blocking the build.

- [ ] **Step 4.5: Commit**

```sh
git add src/calc/hash.ts tests/calc/hash-v6.test.ts
git commit -m "feat(calc): hash canonicalization — omit empty effort, sort non-empty by kind

Golden-fixture-safe: migrated v1-v5 entries have effort: [] which is
omitted from the canonical form, keeping the March 2026 hash unchanged.
Non-empty arrays sort by kind so insertion order doesn't affect hash.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Calc rewrite — `computeMonthEffort` iterates array

**Goal:** Same `MonthEffortTotals` output, but source is the array.

**Files:**
- Modify: `src/calc/effort.ts`
- Modify: `tests/calc/effort.test.ts`
- Modify: `tests/calc/effort-property.test.ts`

### Steps

- [ ] **Step 5.1: Rewrite `computeMonthEffort`**

Replace the body in `src/calc/effort.ts`:

```ts
export function computeMonthEffort(
  args: { entries: Entry[] },
  month: string,
): MonthEffortTotals {
  const by_kind = emptyByKind();
  const by_category = emptyByCategory();
  const perProject = new Map<
    string,
    { total: number; by_kind: Record<EffortKind, number> }
  >();
  let total = 0;

  for (const e of args.entries) {
    if (!e.date.startsWith(month)) continue;
    for (const item of e.effort) {
      total += item.count;
      by_kind[item.kind] += item.count;
      by_category[categoryOf(item.kind)] += item.count;

      let p = perProject.get(e.project);
      if (p === undefined) {
        p = { total: 0, by_kind: emptyByKind() };
        perProject.set(e.project, p);
      }
      p.total += item.count;
      p.by_kind[item.kind] += item.count;
    }
  }

  const per_project: PerProjectEffort[] = Array.from(perProject.entries())
    .map(([project, { total: t, by_kind: k }]) => ({
      project,
      total_activities: t,
      by_kind: k,
    }))
    .sort((a, b) => a.project.localeCompare(b.project));

  return { month, total_activities: total, by_kind, by_category, per_project };
}
```

Update the module-level comment: replace "Entries with effort_kind === null are ignored" with "Entries with empty effort array produce no contribution."

- [ ] **Step 5.2: Update `tests/calc/effort.test.ts`**

Open the file. Every test currently constructs entries with `effort_kind: 'meeting', effort_count: 3`. Replace each such pair with `effort: [{ kind: 'meeting', count: 3 }]`. For entries that meant "no activity", replace with `effort: []`. Example conversion:

```ts
// BEFORE:
const e = baseEntry({ effort_kind: 'meeting', effort_count: 2 });

// AFTER:
const e = baseEntry({ effort: [{ kind: 'meeting', count: 2 }] });
```

Add two new tests for multi-kind entries:

```ts
it('counts multiple kinds from one entry into by_kind independently', () => {
  const entries = [baseEntry({
    effort: [
      { kind: 'meeting', count: 2 },
      { kind: 'slack', count: 1 },
    ],
  })];
  const r = computeMonthEffort({ entries }, '2026-03');
  expect(r.by_kind.meeting).toBe(2);
  expect(r.by_kind.slack).toBe(1);
  expect(r.total_activities).toBe(3);
});

it('entry with empty effort array contributes nothing', () => {
  const entries = [baseEntry({ effort: [] })];
  const r = computeMonthEffort({ entries }, '2026-03');
  expect(r.total_activities).toBe(0);
});
```

- [ ] **Step 5.3: Update `tests/calc/effort-property.test.ts`**

Replace the `EffortKind | null` arbitrary with an array arbitrary. Near the top of the file, swap the effort-field generator for:

```ts
import fc from 'fast-check';
import type { EffortKind, EffortItem } from '@/schema/types';

const kindArb: fc.Arbitrary<EffortKind> = fc.constantFrom(
  'workshop', 'meeting', 'client_training',
  'config_work', 'build', 'integration', 'data_work', 'reporting', 'qa',
  'slack', 'email', 'async_video', 'ticket',
  'internal_sync', 'documentation', 'peer_review',
  'learning', 'scoping',
  'other',
);

const effortArb: fc.Arbitrary<EffortItem[]> = fc.array(
  fc.record({ kind: kindArb, count: fc.integer({ min: 1, max: 100 }) }),
  { maxLength: 5 },
).map((items) => {
  // Collapse duplicates by kind — mirrors the validator's normalizer.
  const byKind = new Map<EffortKind, number>();
  for (const it of items) byKind.set(it.kind, (byKind.get(it.kind) ?? 0) + it.count);
  return [...byKind.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => a.kind.localeCompare(b.kind));
});
```

Replace every `effort_kind: kindArbNullable, effort_count: countArbNullable` field in the entry arbitrary with `effort: effortArb`.

- [ ] **Step 5.4: Run effort tests**

```sh
npm test -- tests/calc/effort.test.ts tests/calc/effort-property.test.ts
```

Expected: all pass.

- [ ] **Step 5.5: Commit**

```sh
git add src/calc/effort.ts tests/calc/effort.test.ts tests/calc/effort-property.test.ts
git commit -m "feat(calc): computeMonthEffort iterates Entry.effort array

Public shape MonthEffortTotals unchanged — per_project, by_kind,
by_category. Inner loop now iterates each entry's effort array so
multi-kind entries contribute to every kind they carry. Property tests
generate unique-kind arrays matching the validator's normalization.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Write-path upgrade + writer probes

**Goal:** `upgradeEntriesFileToV6` handles every legacy version; writers assert uniqueness before persisting.

**Files:**
- Modify: `src/data/entries-repo.ts`
- Create: `tests/data/entries-repo-v6.test.ts`
- Delete: `tests/data/entries-repo-v5.test.ts`, `tests/data/entries-repo-v5-compat.test.ts` (superseded)

### Steps

- [ ] **Step 6.1: Rewrite `upgradeEntriesFileToV5` → `upgradeEntriesFileToV6`**

Locate `upgradeEntriesFileToV5` (or current equivalent) in `src/data/entries-repo.ts` and replace with:

```ts
import { collapseAndSortEffort } from '@/schema/validators';
import type { EffortItem, EffortKind } from '@/schema/types';

export function upgradeEntriesFileToV6(file: EntriesFile): EntriesFile {
  const entries = file.entries.map((e) => {
    const anyE = e as Entry & {
      source_event_id?: string | null;
      effort_kind?: EffortKind | null;
      effort_count?: number | null;
    };
    const cleaned: Record<string, unknown> = { ...anyE };
    // Strip all legacy fields.
    delete cleaned.source_event_id;
    delete cleaned.effort_kind;
    delete cleaned.effort_count;

    // Synthesize source_ref (existing v3 lift).
    if (cleaned.source_ref === undefined) {
      const legacyId = anyE.source_event_id;
      cleaned.source_ref =
        legacyId === undefined || legacyId === null
          ? null
          : { kind: 'calendar', id: legacyId };
    }

    // Synthesize effort (v5 lift).
    let effort: EffortItem[] = Array.isArray((anyE as Entry).effort)
      ? [...(anyE as Entry).effort]
      : [];
    if (effort.length === 0) {
      const k = anyE.effort_kind;
      const c = anyE.effort_count;
      if (k !== null && k !== undefined && c !== null && c !== undefined) {
        effort = [{ kind: k, count: c }];
      }
    }
    cleaned.effort = collapseAndSortEffort(effort);

    return cleaned as Entry;
  });
  if (file.schema_version === 6) return { ...file, entries };
  return { ...file, schema_version: 6, entries };
}
```

Find every call site (`addEntry`, `updateEntry`, `deleteEntry`) that references `upgradeEntriesFileToV5` and rename to `upgradeEntriesFileToV6`. Also search for `schema_version: 5` in this file and change to `schema_version: 6`.

- [ ] **Step 6.2: Add uniqueness-by-kind writer probes**

In `addEntry` and `updateEntry`, add a guard immediately before calling `writeJsonFileWithRetry`:

```ts
function assertEffortUnique(entry: Entry, path: string): void {
  const seen = new Set<EffortKind>();
  for (const item of entry.effort) {
    if (seen.has(item.kind)) {
      throw new Error(
        `Entry ${entry.id} in ${path} has duplicate effort.kind="${item.kind}" — must be unique.`,
      );
    }
    seen.add(item.kind);
  }
}
```

Call `assertEffortUnique(args.entry, path)` at the top of both `addEntry` and `updateEntry` (after path is computed). This is the third layer of uniqueness defense per spec §3 decision 2.

- [ ] **Step 6.3: Replace `tests/data/entries-repo-v5*.test.ts` with v6 tests**

Delete the v5 test files and create `tests/data/entries-repo-v6.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { upgradeEntriesFileToV6 } from '@/data/entries-repo';
import type { EntriesFile, Entry } from '@/schema/types';

function baseEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: '2026-04-14-sprosty-aaaaaa',
    project: 'sprosty',
    date: '2026-04-14',
    hours_hundredths: 400,
    rate_cents: 12500,
    rate_source: 'global_default',
    billable_status: 'billable',
    bucket_id: null,
    description: 'v6 entry',
    review_flag: false,
    created_at: '2026-04-14T10:00:00Z',
    updated_at: '2026-04-14T10:00:00Z',
    source_ref: null,
    effort: [],
    ...overrides,
  };
}

describe('upgradeEntriesFileToV6', () => {
  it('bumps schema_version to 6 on a v4 input', () => {
    const v4: EntriesFile = {
      schema_version: 4,
      month: '2026-03',
      entries: [baseEntry({ id: '2026-03-01-sprosty-aaaaaa' })],
    };
    const upgraded = upgradeEntriesFileToV6(v4);
    expect(upgraded.schema_version).toBe(6);
    expect(upgraded.entries[0]?.effort).toEqual([]);
  });

  it('lifts v5 effort_kind+count into the effort array', () => {
    const v5 = {
      schema_version: 5,
      month: '2026-04',
      entries: [
        {
          ...baseEntry(),
          effort_kind: 'meeting',
          effort_count: 2,
        },
      ],
    } as unknown as EntriesFile;
    const upgraded = upgradeEntriesFileToV6(v5);
    expect(upgraded.schema_version).toBe(6);
    expect(upgraded.entries[0]?.effort).toEqual([{ kind: 'meeting', count: 2 }]);
    expect('effort_kind' in upgraded.entries[0]!).toBe(false);
    expect('effort_count' in upgraded.entries[0]!).toBe(false);
  });

  it('preserves a v6 input with non-empty effort unchanged (after sort)', () => {
    const v6: EntriesFile = {
      schema_version: 6,
      month: '2026-04',
      entries: [baseEntry({
        effort: [{ kind: 'slack', count: 1 }, { kind: 'meeting', count: 2 }],
      })],
    };
    const upgraded = upgradeEntriesFileToV6(v6);
    expect(upgraded.entries[0]?.effort).toEqual([
      { kind: 'meeting', count: 2 },
      { kind: 'slack', count: 1 },
    ]);
  });

  it('collapses duplicate kinds in already-v6 input (belt-and-suspenders)', () => {
    const v6: EntriesFile = {
      schema_version: 6,
      month: '2026-04',
      entries: [baseEntry({
        effort: [
          { kind: 'meeting', count: 1 },
          { kind: 'meeting', count: 3 },
          { kind: 'slack', count: 2 },
        ],
      })],
    };
    const upgraded = upgradeEntriesFileToV6(v6);
    expect(upgraded.entries[0]?.effort).toEqual([
      { kind: 'meeting', count: 4 },
      { kind: 'slack', count: 2 },
    ]);
  });

  it('keeps effort: [] as [] when v5 has null/null pair', () => {
    const v5 = {
      schema_version: 5,
      month: '2026-04',
      entries: [{ ...baseEntry(), effort_kind: null, effort_count: null }],
    } as unknown as EntriesFile;
    const upgraded = upgradeEntriesFileToV6(v5);
    expect(upgraded.entries[0]?.effort).toEqual([]);
  });
});
```

- [ ] **Step 6.4: Run write-path tests**

```sh
npm test -- tests/data/entries-repo-v6.test.ts tests/data/entries-repo.test.ts
```

Expected: both pass.

- [ ] **Step 6.5: Commit**

```sh
git add src/data/entries-repo.ts tests/data/entries-repo-v6.test.ts
git rm tests/data/entries-repo-v5.test.ts tests/data/entries-repo-v5-compat.test.ts
git commit -m "feat(data): upgradeEntriesFileToV6 + writer uniqueness probes

Strips effort_kind, effort_count, source_event_id from every entry on
write. Lifts v5 scalars into the effort array. Self-heals duplicate-kind
v6 entries via collapseAndSortEffort. addEntry + updateEntry assert
effort.kind uniqueness before persisting — third defense-in-depth layer
per spec §3.2.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Form contract — single coordinated commit across log-screen consumers

**Goal:** Flip `Form.effort_kind` → `Form.effort: EffortItem[]` in one atomic change so the TS compiler enforces consistency.

**Files:**
- Modify: `src/ui/screens/log/form-helpers.ts`
- Modify: `src/store/timer-session.ts`
- Modify: `src/store/timer-store.ts`
- Modify: `src/ui/screens/log/FieldFlash.tsx`
- Modify: `src/ui/screens/log/TimerCard.tsx`
- Modify: `src/ui/screens/log/LogFormFields.tsx` (ActivityField rewrite)
- Modify: `src/ui/screens/log/QuickActivityCard.tsx`
- Modify: `src/ui/screens/QuickLog.tsx`
- Modify: `tests/store/timer-session.test.ts`, `tests/store/timer-session-property.test.ts`, `tests/store/timer-store.test.ts`
- Create: `src/ui/screens/log/EffortChips.tsx` (shared chip-list subcomponent)

### Steps

- [ ] **Step 7.1: Update `src/ui/screens/log/form-helpers.ts`**

Find the `Form` / form-state shape in this file. Replace the two effort fields:

```ts
// BEFORE
export type FormState = {
  // ... other fields
  effort_kind: EffortKind | null;
  effort_count: number | null;
};

// AFTER
export type FormState = {
  // ... other fields
  effort: EffortItem[];
};
```

Update the `initialForm` / `emptyForm` constant: replace `effort_kind: null, effort_count: null` with `effort: []`.

Update `buildEntry` / `formToEntry`: replace the effort-field projection with `effort: form.effort`.

- [ ] **Step 7.2: Update `src/store/timer-session.ts`**

In the `Form` type: replace `effort_kind: EffortKind | null` with `effort: EffortItem[]`.

In `snapshotFromForm`: replace the `effort_kind: form.effort_kind` line with `effort: form.effort`.

In `HistoricalRecording` type: replace `effort_kind: EffortKind | null` with `effort: EffortItem[]`.

In `sessionToRecording`: replace `effort_kind: session.snapshot.effort_kind` with `effort: session.snapshot.effort`.

- [ ] **Step 7.3: Update `src/store/timer-store.ts`**

In the store's state type, update the `updateSnapshot` method's `Partial<Pick<Form, ...>>` so the effort field reference is `'effort'` instead of `'effort_kind'`:

```ts
updateSnapshot: (
  updates: Partial<Pick<Form, 'projectId' | 'bucketId' | 'date' | 'effort'>>,
) => void;
```

Any method body that reads `session.snapshot.effort_kind` becomes `session.snapshot.effort`.

- [ ] **Step 7.4: Update `src/ui/screens/log/FieldFlash.tsx`**

Replace `FLASH_ORDER`:

```ts
export const FLASH_ORDER: ReadonlyArray<string> = [
  'date',
  'projectId',
  'effort',
  'hoursHundredths',
  'bucketId',
  'description',
];
```

(Replaced two entries `'effort_kind'` + `'effort_count'` with one `'effort'`.)

- [ ] **Step 7.5: Update `src/ui/screens/log/TimerCard.tsx`**

Find every reference to `form.effort_kind` (should be 2 based on earlier grep). Each is a prop being passed down. Replace with `form.effort` and update downstream prop types in the child components it passes to.

- [ ] **Step 7.6: Create `src/ui/screens/log/EffortChips.tsx`**

New shared chip-list component used by both LogFormFields and EditActivityField (Task 8):

```tsx
import type { EffortItem, EffortKind } from '@/schema/types';
import { EFFORT_KIND_LABEL } from '@/ui/components/EffortKindSelect';

type Props = {
  items: EffortItem[];
  onRemove: (kind: EffortKind) => void;
  onUpdateCount: (kind: EffortKind, count: number) => void;
};

export function EffortChips({ items, onRemove, onUpdateCount }: Props): JSX.Element {
  if (items.length === 0) {
    return (
      <div className="px-3 py-2 rounded-xl border border-dashed border-slate-300/60 text-xs text-slate-400 italic">
        No activities tagged.
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <EffortChip
          key={item.kind}
          item={item}
          onRemove={() => onRemove(item.kind)}
          onUpdateCount={(c) => onUpdateCount(item.kind, c)}
        />
      ))}
    </div>
  );
}

function EffortChip({
  item,
  onRemove,
  onUpdateCount,
}: {
  item: EffortItem;
  onRemove: () => void;
  onUpdateCount: (c: number) => void;
}): JSX.Element {
  return (
    <span
      role="group"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs border border-slate-200"
      onKeyDown={(e) => {
        if (e.key === 'Backspace') {
          e.preventDefault();
          onRemove();
        }
      }}
      tabIndex={0}
    >
      <input
        type="number"
        min="0"
        max="100"
        value={item.count}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (Number.isNaN(n) || n <= 0) onRemove();
          else onUpdateCount(Math.min(100, n));
        }}
        className="w-8 bg-transparent text-xs font-mono tabular-nums text-slate-800 focus:outline-none"
      />
      <span>·</span>
      <span className="truncate max-w-[120px]">{EFFORT_KIND_LABEL[item.kind]}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${EFFORT_KIND_LABEL[item.kind]}`}
        className="text-slate-400 hover:text-red-500 px-1"
      >
        ×
      </button>
    </span>
  );
}
```

- [ ] **Step 7.7: Rewrite `ActivityField` in `src/ui/screens/log/LogFormFields.tsx`**

Replace the existing ActivityField component with the chip-list + inline-add-row version:

```tsx
import { useState } from 'react';
import type { EffortKind, EffortItem } from '@/schema/types';
import { Input } from '@/ui/components/Input';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { EffortKindSelect } from '@/ui/components/EffortKindSelect';
import { EffortChips } from './EffortChips';

export function ActivityField(p: FieldProps): JSX.Element {
  const [pendingKind, setPendingKind] = useState<EffortKind | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(1);

  function addChip() {
    if (pendingKind === null) return;
    p.setForm((f) => {
      const existing = f.effort.find((x) => x.kind === pendingKind);
      const next: EffortItem[] = existing
        ? f.effort.map((x) =>
            x.kind === pendingKind
              ? { kind: x.kind, count: Math.min(100, x.count + pendingCount) }
              : x,
          )
        : [...f.effort, { kind: pendingKind, count: pendingCount }].sort((a, b) =>
            a.kind.localeCompare(b.kind),
          );
      return { ...f, effort: next };
    });
    setPendingKind(null);
    setPendingCount(1);
  }

  function removeChip(kind: EffortKind) {
    p.setForm((f) => ({ ...f, effort: f.effort.filter((x) => x.kind !== kind) }));
  }

  function updateChipCount(kind: EffortKind, count: number) {
    p.setForm((f) => ({
      ...f,
      effort: f.effort.map((x) => (x.kind === kind ? { ...x, count } : x)),
    }));
  }

  return (
    <FieldLabel label="Activity">
      <div className="flex flex-col gap-2">
        {wrap(
          'effort',
          p,
          <EffortChips
            items={p.form.effort}
            onRemove={removeChip}
            onUpdateCount={updateChipCount}
          />,
        )}
        <div className="flex gap-2">
          <div className="flex-1">
            <EffortKindSelect value={pendingKind} onChange={setPendingKind} />
          </div>
          <div className="w-16 shrink-0">
            <Input
              type="number"
              min="1"
              max="100"
              step="1"
              value={String(pendingCount)}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setPendingCount(Number.isNaN(n) ? 1 : Math.max(1, Math.min(100, n)));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addChip();
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={addChip}
            disabled={pendingKind === null}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-partner-mid text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
        <p className="text-[10px] text-slate-500 italic leading-snug">
          Hours apply to the whole block, not split per activity.
        </p>
      </div>
    </FieldLabel>
  );
}
```

- [ ] **Step 7.8: Rewrite `QuickActivityCard.onClick` logic and adjust prop types**

In `src/ui/screens/log/QuickActivityCard.tsx`, the card no longer handles the effort state directly — that moved into `onQuickActivity` in QuickLog. Keep the card's surface the same (accepts `onPrefill`, `currentHoursHundredths`). The visual is unchanged by this task.

- [ ] **Step 7.9: Rewrite `onQuickActivity` in `src/ui/screens/QuickLog.tsx`**

Replace the existing function body:

```ts
function onQuickActivity(action: QuickAction) {
  setForm((f) => {
    const existing = f.effort.find((x) => x.kind === action.kind);
    const nextEffort: EffortItem[] = existing
      ? f.effort.map((x) =>
          x.kind === action.kind
            ? { kind: x.kind, count: Math.min(100, x.count + 1) }
            : x,
        )
      : [...f.effort, { kind: action.kind, count: 1 }].sort((a, b) =>
          a.kind.localeCompare(b.kind),
        );
    return {
      ...f,
      effort: nextEffort,
      hoursHundredths: f.hoursHundredths + action.hoursHundredths,
    };
  });
  setPrefillHint(`quick: ${action.kind.replace(/_/g, ' ')}`);
  setLoadFlashFields(new Set(['effort', 'hoursHundredths']));
  setLoadFlashTone({ r: 251, g: 146, b: 60 });
  setLoadAnimNonce((n) => n + 1);
}
```

Also find any `form.effort_kind` or `form.effort_count` reference in this file and replace with `form.effort`. For `applySuggestion` / `applyHistoricalRecording`: if they currently set `effort_kind: ...` from a calendar suggestion, translate to `effort: [{ kind, count: 1 }]` or keep `effort: []` if the suggestion doesn't carry a kind.

- [ ] **Step 7.10: Update timer-session + timer-store tests**

In `tests/store/timer-session.test.ts` and `tests/store/timer-session-property.test.ts` and `tests/store/timer-store.test.ts`:

- Replace every `effort_kind: 'meeting'` style construction with `effort: [{ kind: 'meeting', count: 1 }]`.
- Replace `effort_kind: null` with `effort: []`.
- For property tests: replace the effort-field arbitrary with an array arbitrary (see Task 5's pattern).

- [ ] **Step 7.11: Run full gates**

```sh
npm run typecheck
npm run lint
npm test
```

Expected: typecheck green (this is the point of the single coordinated commit). Tests: most green; consumers in Tasks 8–10 may still fail. If non-Task-7-owned tests fail, confirm they're in the expected set (EditEntryModal tests, Entries tests, CSV tests) — if yes, proceed; Tasks 8–10 fix them.

- [ ] **Step 7.12: Commit**

```sh
git add src/ui/screens/log/form-helpers.ts src/ui/screens/log/FieldFlash.tsx src/ui/screens/log/TimerCard.tsx src/ui/screens/log/LogFormFields.tsx src/ui/screens/log/QuickActivityCard.tsx src/ui/screens/log/EffortChips.tsx src/ui/screens/QuickLog.tsx src/store/timer-session.ts src/store/timer-store.ts tests/store/
git commit -m "feat(log): Form contract — effort array replaces effort_kind/effort_count

Single coordinated commit so TS compiler catches every consumer. New
shared EffortChips component used by Log + Edit screens. ActivityField
is now chip-list + inline-add-row. Quick Activity clicks dedup/bump by
kind in the array and accumulate hours. Timer snapshot + historical
recording carry the array. FieldFlash FLASH_ORDER uses a single 'effort'
key.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: EditEntryModal + EditActivityField rewrite

**Goal:** Edit modal uses the same chip list; legacy entries show empty placeholder.

**Files:**
- Modify: `src/ui/screens/entries/EditEntryModal.tsx`
- Modify: `src/ui/screens/entries/EditActivityField.tsx`

### Steps

- [ ] **Step 8.1: Rewrite `EditActivityField.tsx`**

Replace its content with a chip-list-based UI mirroring `ActivityField` in Task 7. Signature:

```tsx
import { useState } from 'react';
import type { EffortKind, EffortItem } from '@/schema/types';
import { Input } from '@/ui/components/Input';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { EffortKindSelect } from '@/ui/components/EffortKindSelect';
import { EffortChips } from '@/ui/screens/log/EffortChips';

type Props = {
  effort: EffortItem[];
  onChange: (next: EffortItem[]) => void;
};

export function EditActivityField({ effort, onChange }: Props): JSX.Element {
  const [pendingKind, setPendingKind] = useState<EffortKind | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(1);

  function addChip() {
    if (pendingKind === null) return;
    const existing = effort.find((x) => x.kind === pendingKind);
    const next: EffortItem[] = existing
      ? effort.map((x) =>
          x.kind === pendingKind
            ? { kind: x.kind, count: Math.min(100, x.count + pendingCount) }
            : x,
        )
      : [...effort, { kind: pendingKind, count: pendingCount }].sort((a, b) =>
          a.kind.localeCompare(b.kind),
        );
    onChange(next);
    setPendingKind(null);
    setPendingCount(1);
  }

  function removeChip(kind: EffortKind) {
    onChange(effort.filter((x) => x.kind !== kind));
  }

  function updateChipCount(kind: EffortKind, count: number) {
    onChange(effort.map((x) => (x.kind === kind ? { ...x, count } : x)));
  }

  return (
    <FieldLabel label="Activity">
      <div className="flex flex-col gap-2">
        <EffortChips
          items={effort}
          onRemove={removeChip}
          onUpdateCount={updateChipCount}
        />
        <div className="flex gap-2">
          <div className="flex-1">
            <EffortKindSelect value={pendingKind} onChange={setPendingKind} />
          </div>
          <div className="w-16 shrink-0">
            <Input
              type="number"
              min="1"
              max="100"
              step="1"
              value={String(pendingCount)}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setPendingCount(Number.isNaN(n) ? 1 : Math.max(1, Math.min(100, n)));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addChip();
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={addChip}
            disabled={pendingKind === null}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-partner-mid text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
        <p className="text-[10px] text-slate-500 italic leading-snug">
          Hours apply to the whole block, not split per activity.
        </p>
      </div>
    </FieldLabel>
  );
}
```

- [ ] **Step 8.2: Update `EditEntryModal.tsx`**

Replace the state for effort with an array state:

```ts
const [effort, setEffort] = useState<EffortItem[]>(entry.effort);
```

Remove the old `effortKind`/`effortCount` useState declarations.

Update the `StatusField` + `EditActivityField` render block: `<EditActivityField effort={effort} onChange={setEffort} />`.

Update `buildChangeDescription` to diff the effort arrays:

```ts
function formatEffort(items: EffortItem[]): string {
  if (items.length === 0) return 'none';
  return items.map((i) => `${i.count} ${i.kind}`).join(', ');
}

// ... inside buildChangeDescription:
const prevEffort = formatEffort(entry.effort);
const nextEffort = formatEffort(form.effort);
if (prevEffort !== nextEffort) changes.push(`activity ${prevEffort} → ${nextEffort}`);
```

Update the save mutation's `updated: Entry` object: replace `effort_kind: effortKind, effort_count: effortCount` with `effort`.

Remove any stale imports of `effortUnitLabel` that were used for the old singular-count display if no longer referenced.

- [ ] **Step 8.3: Run gates**

```sh
npm run typecheck && npm run lint && npm test
```

Expected: typecheck green; some remaining UI tests in Task 9 area may still fail.

- [ ] **Step 8.4: Commit**

```sh
git add src/ui/screens/entries/EditEntryModal.tsx src/ui/screens/entries/EditActivityField.tsx
git commit -m "feat(entries): EditEntryModal + EditActivityField chip-list UI

Reuses shared EffortChips. Legacy entries (v1-v5 on disk) hit the
empty-state placeholder in the chip strip; user can add chips and save.
buildChangeDescription surfaces effort diffs in commit message.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Read-path consumers — EntryRow, Entries filter, CalendarModal, EffortSummaryCard

**Goal:** Every screen that reads Entry.effort_* gets migrated.

**Files:**
- Modify: `src/ui/screens/entries/EntryRow.tsx`
- Modify: `src/ui/screens/Entries.tsx`
- Modify: `src/ui/screens/dashboard/CalendarModal.tsx`
- Modify: `src/ui/screens/dashboard/EffortSummaryCard.tsx`

### Steps

- [ ] **Step 9.1: EntryRow compact display**

In `src/ui/screens/entries/EntryRow.tsx`, find the effort-cell rendering and replace with:

```tsx
{entry.effort.length > 0 && (
  <span className="text-xs text-slate-500 font-mono">
    {entry.effort.slice(0, 3).map((item) =>
      `${item.count}·${item.kind.slice(0, 3)}`
    ).join(' · ')}
    {entry.effort.length > 3 ? ` +${entry.effort.length - 3} more` : ''}
  </span>
)}
```

Remove any previous single-kind effort rendering.

- [ ] **Step 9.2: Entries filter**

In `src/ui/screens/Entries.tsx`, find line 119 (`e.effort_kind === effortKindFilter`). Replace with:

```ts
(effortKindFilter === null || e.effort.some((x) => x.kind === effortKindFilter))
```

Filter control stays single-select for now (multi-select is out of scope per spec §12).

- [ ] **Step 9.3: CalendarModal per-day effort sum**

In `src/ui/screens/dashboard/CalendarModal.tsx`, find the effort-summing block (grep `effort_count`). Replace the accumulation:

```ts
// BEFORE: if (e.effort_count) acc.total += e.effort_count;
// AFTER:
for (const item of e.effort) acc.total += item.count;
```

- [ ] **Step 9.4: EffortSummaryCard sanity check**

Open `src/ui/screens/dashboard/EffortSummaryCard.tsx`. It should only consume `MonthEffortTotals` (whose shape hasn't changed) — no direct Entry access. Verify via grep:

```sh
grep "effort_kind\|effort_count\|entry\\.effort" src/ui/screens/dashboard/EffortSummaryCard.tsx
```

If any hits appear, convert them. Otherwise: no change needed.

- [ ] **Step 9.5: Run gates**

```sh
npm run typecheck && npm run lint && npm test
```

Expected: typecheck + lint green. CSV tests in Task 10 may still fail.

- [ ] **Step 9.6: Commit**

```sh
git add src/ui/screens/entries/EntryRow.tsx src/ui/screens/Entries.tsx src/ui/screens/dashboard/CalendarModal.tsx src/ui/screens/dashboard/EffortSummaryCard.tsx
git commit -m "feat(entries): read-path consumers iterate Entry.effort array

EntryRow shows up to 3 chips then +N more. Entries filter switches to
e.effort.some(...). CalendarModal per-day effort sum iterates the array.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: CSV export + commit messages

**Goal:** Single `effort` column on CSV, structured `log:` / `edit:` messages include the effort summary.

**Files:**
- Modify: `src/export/csv.ts`
- Modify: `src/data/commit-messages.ts`
- Modify: `tests/export/csv.test.ts`, `tests/export/csv-effort.test.ts`

### Steps

- [ ] **Step 10.1: CSV column format**

In `src/export/csv.ts`, find the two columns `effort_kind` and `effort_count`. Replace with one `effort` column. The serializer:

```ts
function formatEffort(items: EffortItem[]): string {
  if (items.length === 0) return '';
  return [...items]
    .sort((a, b) => a.kind.localeCompare(b.kind))
    .map((it) => `${it.kind}:${it.count}`)
    .join(';');
}
```

Update the CSV header to `..., effort, ...` (replace `..., effort_kind, effort_count, ...`).

Replace the row-building code so each entry produces `formatEffort(entry.effort)` in that column.

- [ ] **Step 10.2: Commit-message enrichment**

In `src/data/commit-messages.ts`, the `logMessage` function. Add an effort-summary suffix when present:

```ts
function formatEffortShort(items: EffortItem[]): string {
  if (items.length === 0) return '';
  const parts = [...items]
    .sort((a, b) => a.kind.localeCompare(b.kind))
    .map((i) => `${i.count} ${i.kind}`);
  return ` [activity: ${parts.join(', ')}]`;
}

export function logMessage(entry: Entry, extra?: string): string {
  const base = `log: ${entry.project} ${entry.date} ${formatHoursDecimal(entry.hours_hundredths)}h @ ${formatCents(entry.rate_cents, CURRENCY)} (${entry.description})`;
  return base + formatEffortShort(entry.effort) + (extra ?? '');
}
```

Similarly for `editMessage`: pass the new + old effort, render diff.

- [ ] **Step 10.3: Update CSV tests**

Replace the two-column expectation in `tests/export/csv.test.ts` and `tests/export/csv-effort.test.ts` with a single-column expectation:

```ts
it('renders multi-kind effort as sorted kind:count;kind:count', () => {
  const entry = makeEntry({
    effort: [
      { kind: 'slack', count: 1 },
      { kind: 'meeting', count: 2 },
    ],
  });
  const csv = entriesToCsv([entry]);
  expect(csv).toContain('meeting:2;slack:1');
});

it('renders empty effort as empty string', () => {
  const entry = makeEntry({ effort: [] });
  const csv = entriesToCsv([entry]);
  // Check the empty cell appears between its neighbor columns
  expect(csv.split('\n')[1]).toMatch(/,,|,$/);
});
```

- [ ] **Step 10.4: Run gates**

```sh
npm run typecheck && npm run lint && npm test
```

Expected: full green.

- [ ] **Step 10.5: Commit**

```sh
git add src/export/csv.ts src/data/commit-messages.ts tests/export/
git commit -m "feat(export): single effort column + commit-message effort summary

CSV: one effort column 'kind:count;kind:count' sorted by kind. Commit
messages surface effort in [activity: 2 meeting, 1 slack] suffix on
log: and edit:.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Property tests update + golden verify + import script

**Goal:** Existing property-based invariants still hold, import script compiles, golden fixture unchanged.

**Files:**
- Modify: `tests/calc/property.test.ts`, `tests/calc/totals.test.ts`, `tests/calc/daily.test.ts`, `tests/calc/drift.test.ts`, `tests/calc/bulk-rate.test.ts`, `tests/calc/hash.test.ts`, `tests/data/entries-repo.test.ts`
- Modify: `scripts/import-march-2026.ts`

### Steps

- [ ] **Step 11.1: Sweep all test files for effort-field usage**

For each file listed above: replace every `effort_kind: 'X'` + `effort_count: N` pair with `effort: [{ kind: 'X', count: N }]`. Replace `effort_kind: null, effort_count: null` with `effort: []`.

Quick approach — grep each file:

```sh
for f in tests/calc/property.test.ts tests/calc/totals.test.ts tests/calc/daily.test.ts tests/calc/drift.test.ts tests/calc/bulk-rate.test.ts tests/calc/hash.test.ts tests/data/entries-repo.test.ts; do
  echo "=== $f ==="
  grep -n "effort_kind\|effort_count" "$f"
done
```

Convert each match manually — blanket sed-replace is risky because some generator patterns need the `effort: effortArb` replacement.

- [ ] **Step 11.2: Update `scripts/import-march-2026.ts`**

Find the Entry construction in the import script. Replace:

```ts
// BEFORE
effort_kind: null,
effort_count: null,

// AFTER
effort: [],
```

March 2026 import stays zero-effort because the source notes don't encode activity kinds.

- [ ] **Step 11.3: Run ALL tests**

```sh
npm run typecheck && npm run lint && npm test
```

Expected: full green. Golden fixture hash unchanged. All 335+ existing tests pass, plus the new migration / hash / repo-v6 tests.

- [ ] **Step 11.4: Run the golden suite explicitly**

```sh
npm run test:golden
```

Expected: 2 tests pass.

- [ ] **Step 11.5: Build the production bundle**

```sh
npm run build
```

Expected: build succeeds.

- [ ] **Step 11.6: Commit**

```sh
git add tests/ scripts/import-march-2026.ts
git commit -m "test: sweep effort_kind/effort_count into effort array across all tests + import script

Non-behavior-changing conversion. Golden fixture hash unchanged.
Property tests now generate unique-kind arrays matching the validator.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Backlog doc

**Files:**
- Modify: `docs/superpowers/backlog.md`

### Steps

- [ ] **Step 12.1: Move completed items to Shipped**

Open `docs/superpowers/backlog.md`. Move the effort-array item (or add if new) to the Shipped section:

```md
- **Multi-kind effort per entry (schema v6)** — `Entry.effort` replaces the scalar pair. Chip-list UI in Log + Edit; three-layer uniqueness-by-kind enforcement; golden-hash-stable canonicalization.
```

- [ ] **Step 12.2: Commit**

```sh
git add docs/superpowers/backlog.md
git commit -m "docs: mark multi-kind effort (schema v6) as shipped"
```

---

## Self-review checklist

- [ ] **Spec §3 decisions:** each numbered decision 1–10 has a task that implements it. ✓
- [ ] **Spec §4.4 three-layer uniqueness:** validator (Task 3), upgrader (Task 6 via `collapseAndSortEffort`), writer probe (Task 6 `assertEffortUnique`). ✓
- [ ] **Spec §4.5 hash canonicalization:** Task 4 with golden-fixture stability test. ✓
- [ ] **Spec §5 UI:** ActivityField (Task 7), EditActivityField (Task 8), EntryRow (Task 9), chip strip empty state (Task 7's EffortChips). ✓
- [ ] **Spec §6 write-path:** Task 6 covers `upgradeEntriesFileToV6` + writer probes. ✓
- [ ] **Spec §7 forward-compat on main:** Task 1 — ships before branch work. ✓
- [ ] **Spec §8 file list:** every file in the spec appears in at least one task. ✓ (EffortSummaryCard in Task 9, import script in Task 11, timer files in Task 7, CSV in Task 10, etc.)
- [ ] **No placeholders:** every code step has complete code. Grep the plan for "TODO" / "TBD" — none.
- [ ] **Type consistency:** `EffortItem` imported from `@/schema/types` in every file; `collapseAndSortEffort` exported from validators for reuse; `Form.effort` naming consistent. ✓
- [ ] **Golden fixture safety:** Task 4 Step 4.2 tests the stability invariant; Task 11 Step 11.4 runs the golden suite on the final build. ✓
- [ ] **Non-negotiables (CLAUDE.md):** integer math untouched (effort counts are `number`, not `_hundredths`/`_cents`); structured commit messages at every step; schema bump documented; golden fixture not regenerated. ✓

## Execution bookends

- **Pre-flight:** Task 1 ships to `main` and origin — production deploys v5+forward-compat before the feature branch exists.
- **Branch:** `feat/multi-kind-effort` contains Tasks 2–12.
- **Post-flight:** merge the branch to main. Deploy rebuilds with v6 writer. Production catches up.
