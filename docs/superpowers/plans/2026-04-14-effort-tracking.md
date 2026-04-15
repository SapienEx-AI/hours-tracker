# Effort Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship per-consultant effort tracking (Entry schema v3 → v4 with `effort_kind` + `effort_count`, Log form integration, Quick Activity card, Dashboard effort summary, `profile.logging_mode` for HubSpot leads) while preserving every invariant of the hours-first model.

**Architecture:** Effort is an optional tag on `Entry` alongside hours (Model A). Hash canonicalization emits effort fields only when non-null so pre-v4 entries (including the March 2026 golden fixture) hash unchanged. A new `src/calc/effort.ts` module aggregates counts by kind and 5-derived-category. UI gains an inline `Activity` + `Count` row in the Log form, a `QuickActivityCard` in the Assist panel, a badge column + filter on Entries, and an `EffortSummaryCard` + per-project effort column on the Dashboard. `profile.logging_mode` (additive, no version bump) flips the Log form layout for HubSpot leads.

**Tech Stack:** TypeScript (strict + exactOptionalPropertyTypes), React, Zustand, Vitest, fast-check, AJV, Tailwind.

**Spec:** [`docs/superpowers/specs/2026-04-14-effort-tracking-design.md`](../specs/2026-04-14-effort-tracking-design.md). Read before starting.

**Non-negotiable invariants from CLAUDE.md that apply here:**
1. Integer math only for `_cents` and `_hundredths`. Enforced by `local-rules/no-float-money` ESLint rule.
2. Every write validates against the schema before hitting GitHub. Never bypass.
3. Commits carry structured prefixes. See `src/data/commit-messages.ts`.
4. **Any change to `src/calc/**` re-runs Gate A** — property tests + golden tests + independent code-reviewer pass. Tasks 2 and 4 touch `src/calc/`.
5. Schema v3 → v4 is a `schema_version` bump — STOP-and-ask was handled during brainstorming; the committed spec is the approval. Proceed on v4.
6. Snapshots are immutable. `tests/fixtures/2026-03-golden.json` and `tests/fixtures/2026-03-expected.json` must hash byte-for-byte identical before and after.

**Run commands you'll use repeatedly:**
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:golden`
- `npm run test:property`

---

## File Structure

**New files:**
- `src/calc/effort-categories.ts` — pure `categoryOf(kind): EffortCategory` with exhaustive switch
- `src/calc/effort.ts` — `computeMonthEffort`, `MonthEffortTotals`
- `src/ui/components/EffortKindSelect.tsx` — optgroup'd `<select>` for the 19 kinds
- `src/ui/components/EffortBadge.tsx` — "slack ×3" pill with category tint
- `src/ui/screens/log/QuickActivityCard.tsx` — third card in the Assist panel
- `src/ui/screens/dashboard/EffortSummaryCard.tsx` — this-month effort summary
- `docs/architecture/effort-kinds.md` — reference doc for 19 kinds
- `tests/schema/entry-v4-migration.test.ts`
- `tests/calc/hash-v4.test.ts`
- `tests/calc/effort.test.ts`
- `tests/calc/effort-property.test.ts`
- `tests/data/entries-repo-v4.test.ts`
- `tests/export/csv-effort.test.ts`

**Modified files:**
- `schemas/entries.schema.json` — bump to 4, add `effort_kind` + `effort_count`
- `schemas/profile.schema.json` — add optional `logging_mode` (no version bump)
- `src/schema/types.ts` — `EffortKind`, `EffortCategory`, `Entry.effort_*`, `Profile.logging_mode`, `EntriesFile.schema_version: 1|2|3|4`
- `src/schema/validators.ts` — accept v4; backfill effort_* on read; enforce cross-field rule
- `src/calc/hash.ts` — canonicalize effort fields when non-null (**Gate A**)
- `src/calc/totals.ts` — extend `per_project` with optional `effort_count`
- `src/calc/index.ts` — re-export `computeMonthEffort`, `categoryOf`
- `src/data/entries-repo.ts` — `upgradeEntriesFileToV4`; v1/v2/v3 → v4 commit suffix
- `src/data/commit-messages.ts` — `[schema vN→v4]` variants
- `src/data/profile-repo.ts` — new `updateProfile` method
- `src/store/timer-session.ts` — `Form.effort_kind`, `HistoricalRecording.effort_kind`
- `src/store/timer-store.ts` — `updateSnapshot` accepts `effort_kind`
- `src/ui/screens/log/form-helpers.ts` — `FormState.effort_kind`, `effort_count`; `initialForm` defaults; `buildEntry` passthrough
- `src/ui/screens/log/LogForm.tsx` — Activity + Count row; `logging_mode`-driven reorder
- `src/ui/screens/log/LogHelpersPanel.tsx` — render `QuickActivityCard`
- `src/ui/screens/log/TimerInlineEdit.tsx` — inline Activity select
- `src/ui/screens/QuickLog.tsx` — calendar auto-tag meeting; quick-activity pre-fill; flash tone
- `src/ui/screens/Entries.tsx` — activity filter + badge column
- `src/ui/screens/Dashboard.tsx` — render `EffortSummaryCard`; per-project effort column
- `src/ui/screens/dashboard/CalendarModal.tsx` — per-day effort count row
- `src/ui/screens/Settings.tsx` — `logging_mode` select
- `src/export/csv.ts` — `effort_kind`, `effort_count` columns
- `CLAUDE.md` — invariants, file map, common-tasks, spec cross-reference
- `docs/architecture/adding-a-field.md` — v3 → v4 case study
- `docs/architecture/calc-invariants.md` — effort invariants
- `docs/architecture/data-flow.md` — effort through log write + dashboard read
- `docs/architecture/google-calendar-setup.md` — note auto-tag meeting
- `docs/superpowers/backlog.md` — mark shipped when merged
- `docs/superpowers/research/2026-04-14-feature-research.md` — cross-reference

**Test fixture sweep (mechanical):** every existing test that constructs `Entry` literals must append `effort_kind: null, effort_count: null`. Covered in Task 5.

---

## Task 1: Schema v4 — types, JSON schema, validator backfill + cross-field rule

**Goal:** Entry.effort_kind + Entry.effort_count exist. Validator accepts v1/v2/v3/v4 files and backfills legacy. Cross-field rule enforced.

**Files:**
- Modify: `src/schema/types.ts`
- Modify: `schemas/entries.schema.json`
- Modify: `src/schema/validators.ts`
- Create: `tests/schema/entry-v4-migration.test.ts`

- [ ] **Step 1: Write failing migration tests**

Create `tests/schema/entry-v4-migration.test.ts`:

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

describe('Entry v1/v2/v3/v4 acceptance + effort backfill', () => {
  it('accepts a v1 file and backfills effort_kind/count to null', () => {
    const file = { schema_version: 1, month: '2026-03', entries: [{ ...baseEntry }] };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries[0]?.effort_kind).toBeNull();
      expect(r.value.entries[0]?.effort_count).toBeNull();
    }
  });

  it('accepts a v2 file and backfills effort fields to null', () => {
    const file = {
      schema_version: 2,
      month: '2026-04',
      entries: [{ ...baseEntry, source_event_id: 'g1' }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.entries[0]?.effort_kind).toBeNull();
  });

  it('accepts a v3 file and backfills effort fields to null', () => {
    const file = {
      schema_version: 3,
      month: '2026-04',
      entries: [{ ...baseEntry, source_ref: null }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries[0]?.effort_kind).toBeNull();
      expect(r.value.entries[0]?.effort_count).toBeNull();
    }
  });

  it('accepts a v4 file with effort_kind/count both set', () => {
    const file = {
      schema_version: 4,
      month: '2026-04',
      entries: [{ ...baseEntry, source_ref: null, effort_kind: 'workshop', effort_count: 1 }],
    };
    expect(validateEntries(file).ok).toBe(true);
  });

  it('accepts a v4 file with effort_kind/count both null', () => {
    const file = {
      schema_version: 4,
      month: '2026-04',
      entries: [{ ...baseEntry, source_ref: null, effort_kind: null, effort_count: null }],
    };
    expect(validateEntries(file).ok).toBe(true);
  });

  it('rejects v4 with effort_kind set but effort_count null', () => {
    const file = {
      schema_version: 4,
      month: '2026-04',
      entries: [{ ...baseEntry, source_ref: null, effort_kind: 'slack', effort_count: null }],
    };
    expect(validateEntries(file).ok).toBe(false);
  });

  it('rejects v4 with effort_count set but effort_kind null', () => {
    const file = {
      schema_version: 4,
      month: '2026-04',
      entries: [{ ...baseEntry, source_ref: null, effort_kind: null, effort_count: 3 }],
    };
    expect(validateEntries(file).ok).toBe(false);
  });

  it('rejects v4 with invalid effort_kind value', () => {
    const file = {
      schema_version: 4,
      month: '2026-04',
      entries: [{ ...baseEntry, source_ref: null, effort_kind: 'unknown', effort_count: 1 }],
    };
    expect(validateEntries(file).ok).toBe(false);
  });

  it('rejects v4 with effort_count out of range', () => {
    for (const c of [0, 101, -1]) {
      const file = {
        schema_version: 4,
        month: '2026-04',
        entries: [{ ...baseEntry, source_ref: null, effort_kind: 'slack', effort_count: c }],
      };
      expect(validateEntries(file).ok).toBe(false);
    }
  });

  it('does not mutate the caller\'s input', () => {
    const input = {
      schema_version: 2,
      month: '2026-04',
      entries: [{ ...baseEntry, source_event_id: 'g1' }],
    };
    const snap = JSON.parse(JSON.stringify(input));
    validateEntries(input);
    expect(input).toEqual(snap);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```
npm test -- tests/schema/entry-v4-migration.test.ts
```

Expected: FAIL (validator doesn't know about v4 or effort fields yet).

- [ ] **Step 3: Update `src/schema/types.ts`**

Add effort types and update Entry / EntriesFile:

```ts
// Add after existing type definitions
export type EffortKind =
  | 'workshop' | 'meeting' | 'client_training'
  | 'config_work' | 'build' | 'integration' | 'data_work' | 'reporting' | 'qa'
  | 'slack' | 'email' | 'async_video' | 'ticket'
  | 'internal_sync' | 'documentation' | 'peer_review'
  | 'learning' | 'scoping'
  | 'other';

export type EffortCategory =
  | 'client_sync' | 'technical' | 'client_async' | 'internal' | 'enablement';

export type Entry = {
  // ...all existing v3 fields unchanged
  source_ref: SourceRef;
  effort_kind: EffortKind | null;
  effort_count: number | null;
};

export type EntriesFile = {
  schema_version: 1 | 2 | 3 | 4;
  month: string;
  entries: Entry[];
};
```

- [ ] **Step 4: Update `schemas/entries.schema.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://sapienex-ai.github.io/hours-tracker/schemas/entries.schema.json",
  "title": "Monthly entries file (v4)",
  "type": "object",
  "required": ["schema_version", "month", "entries"],
  "additionalProperties": false,
  "properties": {
    "schema_version": { "enum": [1, 2, 3, 4] },
    "month": { "type": "string", "pattern": "^[0-9]{4}-(0[1-9]|1[0-2])$" },
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "id", "project", "date", "hours_hundredths", "rate_cents", "rate_source",
          "billable_status", "bucket_id", "description", "review_flag",
          "created_at", "updated_at"
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
                  "kind": { "enum": ["calendar", "timer"] },
                  "id": { "type": "string", "minLength": 1 }
                }
              }
            ]
          },
          "effort_kind": {
            "oneOf": [
              { "type": "null" },
              {
                "enum": [
                  "workshop", "meeting", "client_training",
                  "config_work", "build", "integration", "data_work", "reporting", "qa",
                  "slack", "email", "async_video", "ticket",
                  "internal_sync", "documentation", "peer_review",
                  "learning", "scoping",
                  "other"
                ]
              }
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
}
```

- [ ] **Step 5: Update `src/schema/validators.ts`**

Replace the existing `validateEntries` export:

```ts
export const validateEntries = (data: unknown): ValidationResult<EntriesFile> => {
  if (!_entries(data)) return { ok: false, errors: _entries.errors ?? [] };
  const file = structuredClone(data) as EntriesFile;

  // v3 / v4 must not carry legacy source_event_id.
  if (file.schema_version === 3 || file.schema_version === 4) {
    for (let i = 0; i < file.entries.length; i++) {
      const e = file.entries[i] as Entry & { source_event_id?: string | null };
      if ('source_event_id' in e) {
        return {
          ok: false,
          errors: [{
            instancePath: `/entries/${i}/source_event_id`,
            schemaPath: '#/properties/entries/items/properties/source_event_id',
            keyword: 'deprecated', params: {},
            message: 'schema_version 3+ entries must not carry legacy source_event_id; use source_ref',
          }],
        };
      }
    }
  }

  // Cross-field rule: effort_kind and effort_count are both-null-or-both-set.
  for (let i = 0; i < file.entries.length; i++) {
    const e = file.entries[i]!;
    const kNull = e.effort_kind === null || e.effort_kind === undefined;
    const cNull = e.effort_count === null || e.effort_count === undefined;
    if (kNull !== cNull) {
      return {
        ok: false,
        errors: [{
          instancePath: `/entries/${i}`,
          schemaPath: '#/properties/entries/items',
          keyword: 'cross-field', params: {},
          message: 'effort_kind and effort_count must both be null or both set',
        }],
      };
    }
  }

  // Backfill source_ref from legacy versions and effort fields from pre-v4.
  for (const e of file.entries) {
    const anyE = e as Entry & { source_event_id?: string | null };
    if (!('source_ref' in e)) {
      const legacyId = anyE.source_event_id;
      (e as Entry).source_ref =
        legacyId === undefined || legacyId === null
          ? null
          : { kind: 'calendar', id: legacyId };
      delete anyE.source_event_id;
    }
    if (!('effort_kind' in e)) (e as Entry).effort_kind = null;
    if (!('effort_count' in e)) (e as Entry).effort_count = null;
  }
  return { ok: true, value: file };
};
```

- [ ] **Step 6: Run tests — verify PASS**

```
npm test -- tests/schema/entry-v4-migration.test.ts
```

Expected: PASS (10/10).

- [ ] **Step 7: Run full test suite; fix cascade**

```
npm test
```

Expected: FAIL on tests whose `Entry` literals lack `effort_kind` / `effort_count`. That cascade is addressed in Task 5 (mechanical sweep). For Task 1, verify schema/hash-v3/entries-repo-v3 tests pass unchanged and migration tests pass.

- [ ] **Step 8: Commit**

```bash
git add schemas/entries.schema.json src/schema/types.ts src/schema/validators.ts tests/schema/entry-v4-migration.test.ts
git commit -m "$(cat <<'EOF'
feat(schema): Entry v4 adds effort_kind + effort_count

Schema bump 3 → 4. EffortKind enum (19 values across 5 derived
categories). effort_count integer 1..100. Cross-field rule enforced
in validator: both null or both set.

Validator accepts v1/v2/v3/v4; backfills legacy versions with
source_ref (v1/v2) and effort_kind/effort_count: null. structuredClone
preserves the caller's input object unchanged.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Hash canonicalization — project effort fields when non-null (**Gate A**)

**Goal:** Pre-v4 entries hash identically. v4 entries with effort fields hash deterministically. March 2026 golden fixture unchanged.

**Files:**
- Modify: `src/calc/hash.ts`
- Create: `tests/calc/hash-v4.test.ts`

- [ ] **Step 1: Write failing invariance tests**

Create `tests/calc/hash-v4.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { canonicalizeEntriesForHashing } from '@/calc/hash';
import type { Entry } from '@/schema/types';

const base: Omit<Entry, 'source_ref' | 'effort_kind' | 'effort_count'> = {
  id: '2026-04-14-sprosty-aaaaaa',
  project: 'sprosty', date: '2026-04-14',
  hours_hundredths: 400, rate_cents: 12500, rate_source: 'global_default',
  billable_status: 'billable', bucket_id: null,
  description: 'entry', review_flag: false,
  created_at: '2026-04-14T10:00:00Z', updated_at: '2026-04-14T10:00:00Z',
};

describe('Hash canonicalization v3 → v4 invariance', () => {
  it('null effort fields omitted; same hash as a v3-shape entry', () => {
    const v4: Entry = { ...base, source_ref: null, effort_kind: null, effort_count: null };
    const c = canonicalizeEntriesForHashing([v4]);
    expect(c).not.toContain('effort_kind');
    expect(c).not.toContain('effort_count');
    expect(c).not.toContain('source_ref');
  });

  it('calendar source_ref still projects to source_event_id (v2 invariance)', () => {
    const v4: Entry = {
      ...base, source_ref: { kind: 'calendar', id: 'gcal-x' },
      effort_kind: null, effort_count: null,
    };
    const c = canonicalizeEntriesForHashing([v4]);
    expect(c).toContain('"source_event_id":"gcal-x"');
  });

  it('non-null effort fields included in canonical form', () => {
    const v4: Entry = {
      ...base, source_ref: null, effort_kind: 'slack', effort_count: 3,
    };
    const c = canonicalizeEntriesForHashing([v4]);
    expect(c).toContain('"effort_kind":"slack"');
    expect(c).toContain('"effort_count":3');
  });

  it('changing effort_count produces a different hash', () => {
    const a: Entry = { ...base, source_ref: null, effort_kind: 'slack', effort_count: 1 };
    const b: Entry = { ...base, source_ref: null, effort_kind: 'slack', effort_count: 2 };
    expect(canonicalizeEntriesForHashing([a])).not.toBe(canonicalizeEntriesForHashing([b]));
  });

  it('changing effort_kind produces a different hash', () => {
    const a: Entry = { ...base, source_ref: null, effort_kind: 'slack', effort_count: 1 };
    const b: Entry = { ...base, source_ref: null, effort_kind: 'email', effort_count: 1 };
    expect(canonicalizeEntriesForHashing([a])).not.toBe(canonicalizeEntriesForHashing([b]));
  });
});
```

- [ ] **Step 2: Run — verify failure**

```
npm test -- tests/calc/hash-v4.test.ts
```

Expected: FAIL — canonicalizeEntry doesn't know effort fields.

- [ ] **Step 3: Update `src/calc/hash.ts`**

Extend `canonicalizeEntry`:

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
  if (e.effort_kind !== null && e.effort_kind !== undefined) {
    base.effort_kind = e.effort_kind;
  }
  if (e.effort_count !== null && e.effort_count !== undefined) {
    base.effort_count = e.effort_count;
  }
  const source = canonicalSource(e.source_ref);
  for (const [k, v] of Object.entries(source)) base[k] = v;
  return base;
}
```

- [ ] **Step 4: Run hash-v4 tests — verify PASS**

```
npm test -- tests/calc/hash-v4.test.ts
```

Expected: PASS (5/5).

- [ ] **Step 5: Run hash.test, hash-v3.test, golden regression**

```
npm test -- tests/calc/hash.test.ts tests/calc/hash-v3.test.ts
npm run test:golden
```

Expected: all PASS — pre-v4 hashes unchanged (this is the Gate A gate for Task 2).

- [ ] **Step 6: Commit**

```bash
git add src/calc/hash.ts tests/calc/hash-v4.test.ts
git commit -m "$(cat <<'EOF'
feat(calc): hash canonicalization emits effort fields when non-null

canonicalizeEntry emits effort_kind / effort_count only when non-null,
mirroring the source_ref projection pattern. v1/v2/v3 entries hash
byte-for-byte identically under the new code path. March 2026 golden
fixture source_hash unchanged.

Gate A-sensitive: property + golden + independent code-reviewer pass
required before merge.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Entries writer — upgradeEntriesFileToV4 + commit suffix

**Goal:** `addEntry`/`updateEntry`/`deleteEntry` upgrade v1/v2/v3 files to v4 on any write. Commit message carries `[schema vN→v4]` when an upgrade occurs.

**Files:**
- Modify: `src/data/entries-repo.ts`
- Modify: `src/data/commit-messages.ts` (no-op; existing timer/calendar suffix logic already generalizes)
- Create: `tests/data/entries-repo-v4.test.ts`
- Modify: `tests/data/entries-repo-v3.test.ts` — rename function references if present
- Modify: `tests/data/entries-repo.test.ts` — update suffix assertions

- [ ] **Step 1: Write failing writer tests**

Create `tests/data/entries-repo-v4.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { upgradeEntriesFileToV4 } from '@/data/entries-repo';
import { validateEntries } from '@/schema/validators';
import type { EntriesFile } from '@/schema/types';

const baseEntry = {
  id: '2026-04-14-sprosty-aaaaaa',
  project: 'sprosty', date: '2026-04-14',
  hours_hundredths: 400, rate_cents: 12500, rate_source: 'global_default' as const,
  billable_status: 'billable' as const, bucket_id: null,
  description: 'entry', review_flag: false,
  created_at: '2026-04-14T10:00:00Z', updated_at: '2026-04-14T10:00:00Z',
};

describe('upgradeEntriesFileToV4', () => {
  it('upgrades a v1 file with null source/effort', () => {
    const v1: EntriesFile = {
      schema_version: 1, month: '2026-03',
      entries: [{ ...baseEntry, source_ref: null, effort_kind: null, effort_count: null }],
    };
    const up = upgradeEntriesFileToV4(v1);
    expect(up.schema_version).toBe(4);
    expect(up.entries[0]?.effort_kind).toBeNull();
    expect(up.entries[0]?.effort_count).toBeNull();
    expect(validateEntries(up).ok).toBe(true);
  });

  it('upgrades a v3 file preserving source_ref', () => {
    const v3: EntriesFile = {
      schema_version: 3, month: '2026-04',
      entries: [{
        ...baseEntry,
        source_ref: { kind: 'calendar', id: 'gcal-1' },
        effort_kind: null, effort_count: null,
      }],
    };
    const up = upgradeEntriesFileToV4(v3);
    expect(up.schema_version).toBe(4);
    expect(up.entries[0]?.source_ref).toEqual({ kind: 'calendar', id: 'gcal-1' });
  });

  it('no-ops a v4 file', () => {
    const v4: EntriesFile = {
      schema_version: 4, month: '2026-05',
      entries: [{
        ...baseEntry, source_ref: null,
        effort_kind: 'workshop', effort_count: 1,
      }],
    };
    expect(upgradeEntriesFileToV4(v4)).toEqual(v4);
  });
});
```

- [ ] **Step 2: Run — verify failure**

```
npm test -- tests/data/entries-repo-v4.test.ts
```

Expected: FAIL — `upgradeEntriesFileToV4` doesn't exist.

- [ ] **Step 3: Update `src/data/entries-repo.ts`**

Rename/add helper + update `schemaUpgradeSuffix`:

```ts
export function upgradeEntriesFileToV4(file: EntriesFile): EntriesFile {
  if (file.schema_version === 4) return file;
  return {
    ...file,
    schema_version: 4,
    entries: file.entries.map((e) => ({
      ...e,
      source_ref: e.source_ref ?? null,
      effort_kind: e.effort_kind ?? null,
      effort_count: e.effort_count ?? null,
    })),
  };
}

function schemaUpgradeSuffix(fromVersion: EntriesFile['schema_version']): string {
  if (fromVersion === 4) return '';
  return ` [schema v${fromVersion}→v4]`;
}
```

Then replace every `upgradeEntriesFileToV3(...)` call in this file with `upgradeEntriesFileToV4(...)`. Replace every `schema_version: 3` in probe/default-file literals with `schema_version: 4`. The `addEntry` message-callback logic already uses `current?.schema_version ?? 3` — change the fallback to `4`. Leave the retry semantics unchanged.

- [ ] **Step 4: Run new test**

```
npm test -- tests/data/entries-repo-v4.test.ts
```

Expected: PASS (3/3).

- [ ] **Step 5: Run existing entries-repo tests; fix as needed**

```
npm test -- tests/data/entries-repo.test.ts tests/data/entries-repo-v3.test.ts
```

If any assertion checks `[schema v2→v3]` or `upgradeEntriesFileToV3`, update to `v2→v4` / `upgradeEntriesFileToV4`. If any v3-migration test literal references expected schema_version 3 in output, update to 4. Re-run.

- [ ] **Step 6: Commit**

```bash
git add src/data/entries-repo.ts tests/data/entries-repo-v4.test.ts tests/data/entries-repo.test.ts tests/data/entries-repo-v3.test.ts
git commit -m "$(cat <<'EOF'
feat(data): writer upgrades entries files to v4

upgradeEntriesFileToV4 replaces the v3 helper and handles v1/v2/v3 →
v4 in one step (source_ref + effort fields backfilled). addEntry /
updateEntry / deleteEntry emit [schema vN→v4] commit suffix when an
upgrade occurs. Probe / default-file literals bumped to
schema_version: 4.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Calc effort module (**Gate A**)

**Goal:** `effort-categories.ts` maps each `EffortKind` to exactly one `EffortCategory`. `effort.ts` aggregates monthly totals by kind, by category, and per project. Property tests confirm invariants.

**Files:**
- Create: `src/calc/effort-categories.ts`
- Create: `src/calc/effort.ts`
- Modify: `src/calc/index.ts`
- Create: `tests/calc/effort.test.ts`
- Create: `tests/calc/effort-property.test.ts`

- [ ] **Step 1: Write failing unit tests**

Create `tests/calc/effort.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeMonthEffort } from '@/calc/effort';
import { categoryOf } from '@/calc/effort-categories';
import type { Entry, EffortKind } from '@/schema/types';

const base = {
  project: 'sprosty', rate_cents: 12500, rate_source: 'global_default' as const,
  billable_status: 'billable' as const, bucket_id: null,
  description: 'x', review_flag: false,
  created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-01T00:00:00Z',
  source_ref: null,
};
const entry = (
  date: string, hours: number, kind: EffortKind | null, count: number | null,
  project = 'sprosty',
): Entry => ({
  ...base, project,
  id: `${date}-${project}-aaaa${count ?? 0}`,
  date, hours_hundredths: hours,
  effort_kind: kind, effort_count: count,
});

describe('computeMonthEffort', () => {
  it('returns zero totals for an empty month', () => {
    const r = computeMonthEffort({ entries: [] }, '2026-04');
    expect(r.total_activities).toBe(0);
    expect(r.per_project).toEqual([]);
  });

  it('ignores null-effort entries', () => {
    const r = computeMonthEffort(
      { entries: [entry('2026-04-05', 200, null, null)] },
      '2026-04',
    );
    expect(r.total_activities).toBe(0);
  });

  it('ignores entries outside the target month', () => {
    const r = computeMonthEffort(
      { entries: [entry('2026-03-30', 100, 'slack', 1)] },
      '2026-04',
    );
    expect(r.total_activities).toBe(0);
  });

  it('sums by kind, category, and project', () => {
    const r = computeMonthEffort(
      {
        entries: [
          entry('2026-04-02', 200, 'workshop', 1),
          entry('2026-04-03', 50, 'email', 3),
          entry('2026-04-04', 50, 'email', 5, 'acme'),
          entry('2026-04-05', 10, 'slack', 2),
        ],
      },
      '2026-04',
    );
    expect(r.total_activities).toBe(1 + 3 + 5 + 2);
    expect(r.by_kind.workshop).toBe(1);
    expect(r.by_kind.email).toBe(8);
    expect(r.by_kind.slack).toBe(2);
    expect(r.by_category.client_sync).toBe(1);
    expect(r.by_category.client_async).toBe(10);
    const sprosty = r.per_project.find((p) => p.project === 'sprosty')!;
    expect(sprosty.total_activities).toBe(6);
    const acme = r.per_project.find((p) => p.project === 'acme')!;
    expect(acme.total_activities).toBe(5);
  });
});

describe('categoryOf', () => {
  const table: Array<[EffortKind, string]> = [
    ['workshop', 'client_sync'], ['meeting', 'client_sync'], ['client_training', 'client_sync'],
    ['config_work', 'technical'], ['build', 'technical'], ['integration', 'technical'],
    ['data_work', 'technical'], ['reporting', 'technical'], ['qa', 'technical'],
    ['slack', 'client_async'], ['email', 'client_async'], ['async_video', 'client_async'],
    ['ticket', 'client_async'],
    ['internal_sync', 'internal'], ['documentation', 'internal'], ['peer_review', 'internal'],
    ['learning', 'enablement'], ['scoping', 'enablement'], ['other', 'enablement'],
  ];
  for (const [k, c] of table) {
    it(`maps ${k} → ${c}`, () => {
      expect(categoryOf(k)).toBe(c);
    });
  }
});
```

- [ ] **Step 2: Run — verify failure**

```
npm test -- tests/calc/effort.test.ts
```

Expected: FAIL — `computeMonthEffort` / `categoryOf` don't exist.

- [ ] **Step 3: Implement `src/calc/effort-categories.ts`**

```ts
import type { EffortKind, EffortCategory } from '@/schema/types';

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

const ALL_KINDS: ReadonlyArray<EffortKind> = [
  'workshop', 'meeting', 'client_training',
  'config_work', 'build', 'integration', 'data_work', 'reporting', 'qa',
  'slack', 'email', 'async_video', 'ticket',
  'internal_sync', 'documentation', 'peer_review',
  'learning', 'scoping', 'other',
];

export function emptyByKind(): Record<EffortKind, number> {
  const out = {} as Record<EffortKind, number>;
  for (const k of ALL_KINDS) out[k] = 0;
  return out;
}

export function emptyByCategory(): Record<EffortCategory, number> {
  return { client_sync: 0, technical: 0, client_async: 0, internal: 0, enablement: 0 };
}
```

- [ ] **Step 4: Implement `src/calc/effort.ts`**

```ts
import type { Entry, EffortKind, EffortCategory } from '@/schema/types';
import { categoryOf, emptyByKind, emptyByCategory } from './effort-categories';

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
): MonthEffortTotals {
  const by_kind = emptyByKind();
  const by_category = emptyByCategory();
  const perProject = new Map<string, { total: number; by_kind: Record<EffortKind, number> }>();
  let total = 0;

  for (const e of args.entries) {
    if (!e.date.startsWith(month)) continue;
    if (e.effort_kind === null || e.effort_count === null) continue;
    total += e.effort_count;
    by_kind[e.effort_kind] += e.effort_count;
    by_category[categoryOf(e.effort_kind)] += e.effort_count;

    let p = perProject.get(e.project);
    if (p === undefined) {
      p = { total: 0, by_kind: emptyByKind() };
      perProject.set(e.project, p);
    }
    p.total += e.effort_count;
    p.by_kind[e.effort_kind] += e.effort_count;
  }

  const per_project = Array.from(perProject.entries())
    .map(([project, { total, by_kind }]) => ({
      project,
      total_activities: total,
      by_kind,
    }))
    .sort((a, b) => a.project.localeCompare(b.project));

  return { month, total_activities: total, by_kind, by_category, per_project };
}
```

- [ ] **Step 5: Update `src/calc/index.ts`**

Add the re-exports alongside existing ones:

```ts
export { computeMonthEffort } from './effort';
export type { MonthEffortTotals } from './effort';
export { categoryOf } from './effort-categories';
```

- [ ] **Step 6: Write property tests**

Create `tests/calc/effort-property.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeMonthEffort } from '@/calc/effort';
import { categoryOf } from '@/calc/effort-categories';
import type { Entry, EffortKind } from '@/schema/types';

const ALL_KINDS: ReadonlyArray<EffortKind> = [
  'workshop', 'meeting', 'client_training',
  'config_work', 'build', 'integration', 'data_work', 'reporting', 'qa',
  'slack', 'email', 'async_video', 'ticket',
  'internal_sync', 'documentation', 'peer_review',
  'learning', 'scoping', 'other',
];

const entryArb = (month: string): fc.Arbitrary<Entry> =>
  fc.record({
    id: fc.hexaString({ minLength: 6, maxLength: 6 })
      .map((u) => `${month}-01-sprosty-${u}`),
    project: fc.constantFrom('sprosty', 'acme', 'globex'),
    date: fc.constant(`${month}-15`),
    hours_hundredths: fc.integer({ min: 1, max: 2400 }),
    rate_cents: fc.constant(12500),
    rate_source: fc.constant<Entry['rate_source']>('global_default'),
    billable_status: fc.constant<Entry['billable_status']>('billable'),
    bucket_id: fc.constant<string | null>(null),
    description: fc.string({ minLength: 1, maxLength: 50 }),
    review_flag: fc.boolean(),
    created_at: fc.constant('2026-04-01T00:00:00Z'),
    updated_at: fc.constant('2026-04-01T00:00:00Z'),
    source_ref: fc.constant<Entry['source_ref']>(null),
    effort_kind: fc.oneof(
      fc.constant<EffortKind | null>(null),
      fc.constantFrom(...ALL_KINDS),
    ),
    effort_count: fc.oneof(
      fc.constant<number | null>(null),
      fc.integer({ min: 1, max: 100 }),
    ),
  }).map((e) => {
    // Enforce the cross-field rule inside the arbitrary.
    if (e.effort_kind === null) return { ...e, effort_count: null };
    return { ...e, effort_count: e.effort_count ?? 1 };
  });

describe('Effort invariants', () => {
  it('Conservation: sum(by_category) === total_activities', () => {
    fc.assert(
      fc.property(fc.array(entryArb('2026-04'), { minLength: 0, maxLength: 50 }), (entries) => {
        const r = computeMonthEffort({ entries }, '2026-04');
        const sumCat = Object.values(r.by_category).reduce((a, b) => a + b, 0);
        return sumCat === r.total_activities;
      }),
    );
  });

  it('Additivity: sum(per_project.total_activities) === total_activities', () => {
    fc.assert(
      fc.property(fc.array(entryArb('2026-04'), { minLength: 0, maxLength: 50 }), (entries) => {
        const r = computeMonthEffort({ entries }, '2026-04');
        const sumPP = r.per_project.reduce((a, p) => a + p.total_activities, 0);
        return sumPP === r.total_activities;
      }),
    );
  });

  it('Month scoping: entries outside target month contribute zero', () => {
    fc.assert(
      fc.property(fc.array(entryArb('2026-03'), { minLength: 1, maxLength: 20 }), (entries) => {
        const r = computeMonthEffort({ entries }, '2026-04');
        return r.total_activities === 0;
      }),
    );
  });

  it('categoryOf is total across all kinds', () => {
    for (const k of ALL_KINDS) {
      const c = categoryOf(k);
      expect(
        ['client_sync', 'technical', 'client_async', 'internal', 'enablement'].includes(c),
      ).toBe(true);
    }
  });
});
```

- [ ] **Step 7: Run all calc tests**

```
npm run test:property
npm test -- tests/calc/effort.test.ts tests/calc/effort-property.test.ts
```

Expected: PASS.

- [ ] **Step 8: Run golden**

```
npm run test:golden
```

Expected: PASS (calc changes additive; hash unchanged from Task 2).

- [ ] **Step 9: Commit**

```bash
git add src/calc/effort-categories.ts src/calc/effort.ts src/calc/index.ts tests/calc/effort.test.ts tests/calc/effort-property.test.ts
git commit -m "$(cat <<'EOF'
feat(calc): effort aggregation + category mapping

computeMonthEffort returns month-scoped totals by kind, by category,
and per project. categoryOf is an exhaustive total mapping of the 19
EffortKinds to 5 EffortCategories. Null-effort entries are ignored at
every level. Month scoping mirrors computeMonthTotals.

Property tests: conservation (sum-by-category = total), additivity
(sum-per-project = total), month-scoping exclusion, categoryOf
totality.

Gate A-sensitive: touches src/calc/. Property + golden pass.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: FormState + buildEntry + test-fixture sweep

**Goal:** Form code and every existing test fixture carries the new `effort_kind` / `effort_count` nullables so typecheck is clean.

**Files:**
- Modify: `src/ui/screens/log/form-helpers.ts`
- Modify: existing test files that construct `Entry` literals (see list in §9.2 of the spec)

- [ ] **Step 1: Update `src/ui/screens/log/form-helpers.ts`**

```ts
import type { BillableStatus, EffortKind, Entry, ProjectsConfig, RatesConfig, SourceRef } from '@/schema/types';
import { resolveRateAtLogTime } from '@/calc';
import { newEntryId } from '@/data/new-entry-id';

export type FormState = {
  projectId: string;
  date: string;
  hoursHundredths: number;
  bucketId: string | null;
  status: BillableStatus;
  rateCents: number;
  rateOverridden: boolean;
  description: string;
  source_ref: SourceRef;
  effort_kind: EffortKind | null;
  effort_count: number | null;
};

// Existing todayISO() unchanged.

export const initialForm: FormState = {
  projectId: '',
  date: todayISO(),
  hoursHundredths: 0,
  bucketId: null,
  status: 'billable',
  rateCents: 0,
  rateOverridden: false,
  description: '',
  source_ref: null,
  effort_kind: null,
  effort_count: null,
};
```

Update `buildEntry`'s returned object to include:

```ts
    effort_kind: form.effort_kind,
    effort_count: form.effort_count,
```

- [ ] **Step 2: Sweep existing test fixtures**

Run this command to find every file with `effort_kind` missing from Entry literals:

```
npm run typecheck 2>&1 | grep "effort_kind" | cut -d'(' -f1 | sort -u
```

For each surfaced file, append `effort_kind: null,` and `effort_count: null,` to every `Entry` literal. Typical files: `tests/calc/bulk-rate.test.ts`, `tests/calc/daily.test.ts`, `tests/calc/drift.test.ts`, `tests/calc/hash.test.ts`, `tests/calc/property.test.ts`, `tests/calc/totals.test.ts`, `tests/data/entries-repo-v3.test.ts`, `tests/data/entries-repo.test.ts`, `tests/export/csv.test.ts`, `tests/schema/entry-v3-migration.test.ts`, `tests/store/timer-session.test.ts`, `tests/store/timer-store.test.ts`.

The fast-check `entryArb` in `tests/calc/property.test.ts` also needs:

```ts
    effort_kind: fc.constant<Entry['effort_kind']>(null),
    effort_count: fc.constant<Entry['effort_count']>(null),
```

- [ ] **Step 3: Typecheck + lint + full test run**

```
npm run typecheck
npm run lint
npm test
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/ui/screens/log/form-helpers.ts tests/
git commit -m "$(cat <<'EOF'
chore(forms+tests): FormState gains effort fields; sweep test fixtures

FormState.effort_kind / effort_count added (both null by default) so
buildEntry can pass them through to new Entry records. Every existing
Entry literal in tests appends effort_kind: null, effort_count: null
to preserve strict-mode compilation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Profile logging_mode + Settings integration

**Goal:** `profile.logging_mode` persists in the profile file. Settings screen exposes a selector that writes through.

**Files:**
- Modify: `schemas/profile.schema.json`
- Modify: `src/schema/types.ts`
- Modify: `src/data/profile-repo.ts`
- Modify: `src/ui/screens/Settings.tsx`

- [ ] **Step 1: Update `schemas/profile.schema.json`**

Replace with (adds one optional property; version unchanged):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://sapienex-ai.github.io/hours-tracker/schemas/profile.schema.json",
  "title": "Consultant profile",
  "type": "object",
  "required": ["schema_version", "partner_id", "consultant_id", "display_name", "created_at"],
  "additionalProperties": false,
  "properties": {
    "schema_version": { "const": 1 },
    "partner_id": { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "consultant_id": { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "display_name": { "type": "string", "minLength": 1 },
    "email": { "type": "string", "format": "email" },
    "timezone": { "type": "string" },
    "created_at": { "type": "string", "format": "date-time" },
    "logging_mode": { "enum": ["hours", "effort", "both"] }
  }
}
```

- [ ] **Step 2: Update `src/schema/types.ts`**

Extend `Profile`:

```ts
export type LoggingMode = 'hours' | 'effort' | 'both';

export type Profile = {
  // ...existing fields
  logging_mode?: LoggingMode;
};
```

- [ ] **Step 3: Add `updateProfile` to `src/data/profile-repo.ts`**

Add after `createProfile`:

```ts
export async function updateProfile(
  octokit: Octokit,
  args: { owner: string; repo: string; profile: Profile },
): Promise<void> {
  const v = validateProfile(args.profile);
  if (!v.ok) {
    throw new Error(`Profile failed validation:\n${formatValidationErrors(v.errors)}`);
  }
  await writeJsonFile(octokit, {
    owner: args.owner,
    repo: args.repo,
    path: PATH,
    content: args.profile,
    message: `config: update profile for ${args.profile.consultant_id}`,
  });
}
```

- [ ] **Step 4: Add the Settings control**

In `src/ui/screens/Settings.tsx`, add a "Logging mode" section using the existing profile query/mutation pattern. Pseudocode outline (plug into whatever hooks the Settings screen already uses):

```tsx
<section className="flex flex-col gap-3">
  <h2 className="font-display text-lg text-slate-800">Logging mode</h2>
  <p className="text-xs text-slate-500 max-w-prose">
    Hours: hourly-consultant layout (default). Effort: promote Activity
    fields for full-time HubSpot leads. Both: everything visible.
  </p>
  <Select
    value={profile.logging_mode ?? 'hours'}
    onChange={(e) => updateLoggingMode(e.target.value as LoggingMode)}
  >
    <option value="hours">Hours</option>
    <option value="effort">Effort</option>
    <option value="both">Both</option>
  </Select>
</section>
```

Where `updateLoggingMode` calls `updateProfile(octokit, { owner, repo, profile: { ...profile, logging_mode: mode } })` and invalidates the profile query.

- [ ] **Step 5: Typecheck + lint**

```
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add schemas/profile.schema.json src/schema/types.ts src/data/profile-repo.ts src/ui/screens/Settings.tsx
git commit -m "$(cat <<'EOF'
feat(profile): logging_mode (hours | effort | both)

Additive optional field on profile (no schema version bump). Default
'hours' preserves every current user. Settings screen gains a Logging
mode Select that writes through the new updateProfile helper.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: EffortKindSelect + EffortBadge reusable components

**Goal:** Two small UI primitives reused by LogForm, QuickActivityCard, Entries badge column, and filter bar.

**Files:**
- Create: `src/ui/components/EffortKindSelect.tsx`
- Create: `src/ui/components/EffortBadge.tsx`

- [ ] **Step 1: Create `src/ui/components/EffortKindSelect.tsx`**

```tsx
import type { EffortKind } from '@/schema/types';

type Props = {
  value: EffortKind | null;
  onChange: (next: EffortKind | null) => void;
  disabled?: boolean;
  className?: string;
};

const GROUPS: ReadonlyArray<{ label: string; kinds: EffortKind[] }> = [
  { label: 'Client-sync', kinds: ['workshop', 'meeting', 'client_training'] },
  { label: 'Technical', kinds: ['config_work', 'build', 'integration', 'data_work', 'reporting', 'qa'] },
  { label: 'Client-async', kinds: ['slack', 'email', 'async_video', 'ticket'] },
  { label: 'Internal', kinds: ['internal_sync', 'documentation', 'peer_review'] },
  { label: 'Growth', kinds: ['learning', 'scoping'] },
  { label: 'Other', kinds: ['other'] },
];

const LABEL: Record<EffortKind, string> = {
  workshop: 'Workshop / discovery',
  meeting: 'Meeting / client sync',
  client_training: 'Client training',
  config_work: 'Config work',
  build: 'Build (modules / workflows)',
  integration: 'Integration',
  data_work: 'Data work',
  reporting: 'Reporting / dashboards',
  qa: 'QA / validation',
  slack: 'Slack message',
  email: 'Email',
  async_video: 'Async video (Loom)',
  ticket: 'Ticket response',
  internal_sync: 'Internal sync',
  documentation: 'Documentation',
  peer_review: 'Peer review',
  learning: 'Learning / certification',
  scoping: 'Scoping / SOW',
  other: 'Other',
};

export function EffortKindSelect({ value, onChange, disabled, className }: Props): JSX.Element {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : (e.target.value as EffortKind))}
      disabled={disabled}
      className={`w-full px-3 py-2 rounded-lg glass-input text-sm text-slate-800 font-body ${className ?? ''}`}
    >
      <option value="">— none —</option>
      {GROUPS.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.kinds.map((k) => (
            <option key={k} value={k}>{LABEL[k]}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export { LABEL as EFFORT_KIND_LABEL };
```

- [ ] **Step 2: Create `src/ui/components/EffortBadge.tsx`**

```tsx
import type { EffortKind } from '@/schema/types';
import { categoryOf } from '@/calc/effort-categories';
import { EFFORT_KIND_LABEL } from './EffortKindSelect';

const CATEGORY_CLASS: Record<string, string> = {
  client_sync: 'bg-partner-cyan/15 text-partner-deep border-partner-cyan/40',
  technical: 'bg-slate-200/80 text-slate-700 border-slate-300',
  client_async: 'bg-indigo-100 text-indigo-800 border-indigo-300/60',
  internal: 'bg-amber-100 text-amber-800 border-amber-300/60',
  enablement: 'bg-emerald-100 text-emerald-800 border-emerald-300/60',
};

type Props = {
  kind: EffortKind;
  count: number;
};

export function EffortBadge({ kind, count }: Props): JSX.Element {
  const cls = CATEGORY_CLASS[categoryOf(kind)] ?? CATEGORY_CLASS.enablement!;
  return (
    <span
      title={`${EFFORT_KIND_LABEL[kind]} × ${count}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider whitespace-nowrap ${cls}`}
    >
      <span>{kind.replace(/_/g, ' ')}</span>
      <span className="font-semibold">× {count}</span>
    </span>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

```
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/EffortKindSelect.tsx src/ui/components/EffortBadge.tsx
git commit -m "$(cat <<'EOF'
feat(ui): EffortKindSelect + EffortBadge reusable components

EffortKindSelect renders the 19-kind enum with optgroup-by-category
and human labels. EffortBadge shows "<kind> × N" with category-tinted
pill. Used by LogForm, QuickActivityCard, Entries list + filter, and
dashboard tooltips.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: LogForm Activity + Count row + logging_mode layout

**Goal:** LogForm renders Activity + Count. When `profile.logging_mode === 'effort'`, Activity moves above Hours and Rate/Billable fields collapse into an Advanced disclosure.

**Files:**
- Modify: `src/ui/screens/log/LogForm.tsx`
- Modify: `src/ui/screens/QuickLog.tsx` (pass logging mode from profile)

- [ ] **Step 1: Modify `src/ui/screens/log/LogForm.tsx`**

Accept a new prop `loggingMode: 'hours' | 'effort' | 'both'` and render the Activity + Count row conditionally based on mode. In 'effort' mode, render Activity row above Hours; collapse Rate and Status into a `<details>` block labeled "Advanced".

Key JSX additions (placed where appropriate for the mode):

```tsx
<FieldLabel label="Activity">
  <div className="flex gap-2 items-center">
    <EffortKindSelect
      value={form.effort_kind}
      onChange={(k) =>
        setForm((f) => ({
          ...f,
          effort_kind: k,
          effort_count: k === null ? null : (f.effort_count ?? 1),
        }))
      }
    />
    <Input
      type="number"
      min="1"
      max="100"
      step="1"
      disabled={form.effort_kind === null}
      value={form.effort_count === null ? '' : String(form.effort_count)}
      onChange={(e) =>
        setForm((f) => ({
          ...f,
          effort_count: e.target.value === '' ? null : Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)),
        }))
      }
      className="w-20"
    />
  </div>
</FieldLabel>
```

Wrap Rate and Status in:

```tsx
{loggingMode === 'effort' ? (
  <details className="glass-input rounded-xl p-3">
    <summary className="text-xs font-mono uppercase tracking-wider text-slate-500 cursor-pointer">
      Advanced (rate, billable)
    </summary>
    <div className="mt-3 flex flex-col gap-4">
      {/* existing Status + Rate FieldLabels */}
    </div>
  </details>
) : (
  <>
    {/* existing Status + Rate FieldLabels */}
  </>
)}
```

Also, default `billable_status` to `'non_billable'` in initialForm when mode is `'effort'` — handled in QuickLog (Task 10's integration).

- [ ] **Step 2: Pipe `loggingMode` through `QuickLog.tsx`**

Read profile via existing hook; pass to LogForm:

```tsx
const loggingMode = profile.data?.logging_mode ?? 'hours';
// ...
<LogForm
  // ...existing props
  loggingMode={loggingMode}
/>
```

- [ ] **Step 3: Typecheck + lint + tests**

```
npm run typecheck
npm run lint
npm test
```

Expected: PASS.

- [ ] **Step 4: Manual smoke-check**

Run `npm run dev`. In Settings, switch logging_mode between hours / effort / both. Confirm LogForm reorders and collapses correctly. Pick a project, set Activity = "Slack message", verify Count defaults to 1, bump to 3, Save. Check the committed entry in the data repo has `effort_kind: slack`, `effort_count: 3`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/log/LogForm.tsx src/ui/screens/QuickLog.tsx
git commit -m "$(cat <<'EOF'
feat(log): Activity + Count row; logging_mode drives layout

LogForm gains an Activity select + Count input row. Count is disabled
unless Activity is set; setting Activity auto-fills Count with 1. In
profile.logging_mode='effort', Activity row moves above Hours and
Rate/Status collapse into an Advanced <details> block. 'hours' mode
is unchanged.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: QuickActivityCard in Assist panel

**Goal:** Third card in `LogHelpersPanel` with six pre-fill buttons. Clicking pre-fills form with sensible defaults + amber-orange magic-fill animation.

**Files:**
- Create: `src/ui/screens/log/QuickActivityCard.tsx`
- Modify: `src/ui/screens/log/LogHelpersPanel.tsx`
- Modify: `src/ui/screens/QuickLog.tsx`
- Modify: `src/index.css` (new tone for magic-fill)

- [ ] **Step 1: Create `src/ui/screens/log/QuickActivityCard.tsx`**

```tsx
import type { EffortKind } from '@/schema/types';

type QuickAction = {
  kind: EffortKind;
  label: string;
  hoursHundredths: number;
};

const ACTIONS: ReadonlyArray<QuickAction> = [
  { kind: 'slack', label: '+ Slack message', hoursHundredths: 2 },
  { kind: 'email', label: '+ Email thread', hoursHundredths: 10 },
  { kind: 'meeting', label: '+ Meeting', hoursHundredths: 100 },
  { kind: 'workshop', label: '+ Workshop', hoursHundredths: 200 },
  { kind: 'documentation', label: '+ Documentation', hoursHundredths: 50 },
  { kind: 'other', label: '+ Other', hoursHundredths: 25 },
];

type Props = {
  projectSelected: boolean;
  onPrefill: (action: QuickAction) => void;
  onBounceProject: () => void;
};

export function QuickActivityCard({ projectSelected, onPrefill, onBounceProject }: Props): JSX.Element {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3 bg-gradient-to-br from-orange-50 via-white/90 to-white/80 border border-orange-300/50">
      <div className="flex items-center gap-2">
        <span className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_0_8px_rgba(251,146,60,0.5)]" />
        <h3 className="font-display text-sm text-slate-800 uppercase tracking-wide font-semibold whitespace-nowrap">
          Quick activity
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.kind}
            type="button"
            onClick={() => (projectSelected ? onPrefill(a) : onBounceProject())}
            className="px-2.5 py-1.5 rounded-lg text-xs font-body text-slate-700 bg-white/70 hover:bg-white border border-slate-200/60 hover:border-orange-400/50 hover:-translate-y-0.5 transition-all duration-150 text-left"
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="text-[10px] text-slate-500 italic leading-snug">
        Uses the project currently selected.
      </div>
    </div>
  );
}

export type { QuickAction };
```

- [ ] **Step 2: Render it from `LogHelpersPanel.tsx`**

Add as a third card between Timer and Calendar (or after Calendar — your pick):

```tsx
<AnimatedHeight>
  <QuickActivityCard
    projectSelected={form.projectId !== ''}
    onPrefill={onQuickActivity}
    onBounceProject={onBounceProject}
  />
</AnimatedHeight>
```

Accept new props `onQuickActivity: (a: QuickAction) => void` and `onBounceProject: () => void`.

- [ ] **Step 3: Wire up from `QuickLog.tsx`**

```tsx
function onQuickActivity(a: QuickAction) {
  setForm((f) => ({
    ...f,
    effort_kind: a.kind,
    effort_count: 1,
    hoursHundredths: a.hoursHundredths,
  }));
  setPrefillHint(`quick: ${a.kind}`);
  setLoadFlashFields(new Set(['hoursHundredths', 'effort_kind', 'effort_count']));
  setLoadFlashTone({ r: 251, g: 146, b: 60 }); // orange-400 — distinct from indigo + amber
  setLoadAnimNonce((n) => n + 1);
}

function onBounceProject() {
  // Trigger a red-outline pulse on the project Select. Implementation: set a
  // transient class on the projectRef.current for 800ms.
  const el = projectRef.current;
  if (el === null) return;
  el.classList.add('ring-2', 'ring-red-500', 'animate-pulse');
  window.setTimeout(() => el.classList.remove('ring-2', 'ring-red-500', 'animate-pulse'), 800);
}
```

- [ ] **Step 4: Typecheck + lint + tests**

```
npm run typecheck
npm run lint
npm test
```

Expected: PASS.

- [ ] **Step 5: Manual smoke-check**

`npm run dev`. No project selected → click `+ Slack` → Project field pulses red. Pick a project → click `+ Slack` → form fills (hours 0.02, activity slack, count 1) with orange magic-fill. Click Save → verify entry has `effort_kind: slack, effort_count: 1`.

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/log/QuickActivityCard.tsx src/ui/screens/log/LogHelpersPanel.tsx src/ui/screens/QuickLog.tsx
git commit -m "$(cat <<'EOF'
feat(log): QuickActivityCard — 6 pre-fill buttons in the Assist panel

Third card alongside Timer and Calendar. Each button pre-fills the
Log form with effort_kind + count=1 + a sensible default hours value
(slack 0.02h, email 0.1h, meeting 1h, workshop 2h, doc 0.5h, other
0.25h). Fires the per-field magic-fill animation with a distinct
orange tone so users learn "this tone = quick activity prefill".

If no project is selected, clicks bounce the Project field with a
red outline pulse instead of opening a prompt — keeps the happy path
one click.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Entries badge + activity filter

**Goal:** Entries list shows `EffortBadge` next to hours for tagged rows. Filter bar adds Activity-type Select.

**Files:**
- Modify: `src/ui/screens/Entries.tsx`

- [ ] **Step 1: Add badge column**

In the existing entry row, render `<EffortBadge kind={e.effort_kind} count={e.effort_count} />` next to hours when both are non-null.

- [ ] **Step 2: Add activity filter**

In the filter bar, add:

```tsx
<EffortKindSelect
  value={filters.effortKind ?? null}
  onChange={(k) => setFilters((f) => ({ ...f, effortKind: k }))}
  className="w-56"
/>
```

Apply the filter: keep the existing `filtered` pipeline and add `e.effort_kind === filters.effortKind` when `filters.effortKind !== null`.

- [ ] **Step 3: Typecheck + lint + tests**

```
npm run typecheck
npm run lint
npm test
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/ui/screens/Entries.tsx
git commit -m "$(cat <<'EOF'
feat(entries): effort badge + activity-type filter

Row rendering gains an EffortBadge when an entry has effort_kind set.
Filter bar gains an Activity dropdown that composes with existing
project/date/status filters.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Timer inline Activity + snapshot extension

**Goal:** Timer card's inline editor exposes an Activity Select. Changes propagate to form and session snapshot. Historical recordings remember the chosen kind.

**Files:**
- Modify: `src/store/timer-session.ts`
- Modify: `src/store/timer-store.ts`
- Modify: `src/ui/screens/log/TimerInlineEdit.tsx`
- Modify: `src/ui/screens/QuickLog.tsx`

- [ ] **Step 1: Extend `Form` and `HistoricalRecording`**

In `src/store/timer-session.ts`:

```ts
import type { EffortKind } from '@/schema/types';

export type Form = {
  projectId: string;
  bucketId: string | null;
  description: string;
  date: string;
  effort_kind: EffortKind | null;
};

export type HistoricalRecording = {
  // ...existing fields
  effort_kind: EffortKind | null;
};

export function sessionToRecording(session: TimerSession, archivedWall: string): HistoricalRecording {
  return {
    // ...existing fields
    effort_kind: session.snapshot.effort_kind,
  };
}
```

- [ ] **Step 2: Allow updating effort_kind on snapshot**

In `src/store/timer-store.ts`, widen `updateSnapshot`'s accepted pick:

```ts
updateSnapshot: (updates: Partial<Pick<Form, 'projectId' | 'bucketId' | 'date' | 'effort_kind'>>) => void;
```

- [ ] **Step 3: Add Activity select to `TimerInlineEdit.tsx`**

Append a third row (after bucket):

```tsx
<span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">activity</span>
<EffortKindSelect
  value={form.effort_kind ?? null}
  onChange={onChangeEffortKind}
  className="w-full"
/>
```

Accept `form` prop's `effort_kind` and new callback `onChangeEffortKind: (k: EffortKind | null) => void`.

- [ ] **Step 4: Wire up in `QuickLog.tsx`**

```tsx
function changeTimerEffortKind(effort_kind: EffortKind | null) {
  setForm((f) => ({
    ...f,
    effort_kind,
    effort_count: effort_kind === null ? null : (f.effort_count ?? 1),
  }));
  updateTimerSnapshot({ effort_kind });
}
```

Pass `changeTimerEffortKind` through LogHelpersPanel → TimerCard → TimerInlineEdit.

Also update the `form` Form constructor where `LogHelpersPanel` is rendered:

```tsx
form={{
  projectId: form.projectId,
  bucketId: form.bucketId,
  description: form.description,
  date: form.date,
  effort_kind: form.effort_kind,
}}
```

And `applyHistoricalRecording` fills `effort_kind` from the recording into the form (plus `effort_count: rec.effort_kind === null ? null : 1`).

- [ ] **Step 5: Update timer-store tests**

Add tests asserting:
- `updateSnapshot({ effort_kind: 'slack' })` mutates only that field.
- Stop archives the snapshot's `effort_kind` into the recording.
- Session literal arbitraries in existing tests get `effort_kind: null` default.

- [ ] **Step 6: Typecheck + lint + tests**

```
npm run typecheck
npm run lint
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/store/timer-session.ts src/store/timer-store.ts src/ui/screens/log/TimerInlineEdit.tsx src/ui/screens/QuickLog.tsx tests/store/
git commit -m "$(cat <<'EOF'
feat(timer): inline Activity select + effort_kind in snapshot

TimerInlineEdit gains a third row for Activity (EffortKindSelect).
Changes sync through setForm and updateSnapshot, matching the existing
project/bucket inline-edit pattern. HistoricalRecording captures
effort_kind so redriving restores full context.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Calendar auto-tag meeting on applySuggestion

**Goal:** Applying a Google Calendar suggestion sets `effort_kind: 'meeting'` and `effort_count: 1` by default. User can override before saving.

**Files:**
- Modify: `src/ui/screens/QuickLog.tsx`

- [ ] **Step 1: Update `applySuggestion`**

```tsx
function applySuggestion(s: Suggestion) {
  setForm((f) => ({
    ...f,
    date: s.date,
    hoursHundredths: s.hours_hundredths,
    description: s.description,
    source_ref: s.source_event_id ? { kind: 'calendar', id: s.source_event_id } : null,
    effort_kind: 'meeting',
    effort_count: 1,
  }));
  setPrefillHint(s.description || '(no title)');
  setLoadFlashFields(new Set(['date', 'hoursHundredths', 'description', 'effort_kind', 'effort_count']));
  setLoadFlashTone({ r: 99, g: 102, b: 241 });
  setLoadAnimNonce((n) => n + 1);
}
```

- [ ] **Step 2: Typecheck + lint + tests**

```
npm run typecheck
npm run lint
npm test
```

Expected: PASS.

- [ ] **Step 3: Manual smoke-check**

Connect calendar, pick an event on the Log page. Confirm the form fills with effort_kind: meeting + count: 1 and the field magic-fill includes those fields. Change Activity to a different kind before save — verify override works.

- [ ] **Step 4: Commit**

```bash
git add src/ui/screens/QuickLog.tsx
git commit -m "$(cat <<'EOF'
feat(log): calendar suggestions auto-tag effort_kind: meeting

applySuggestion sets effort_kind: 'meeting' and effort_count: 1 on the
form. User can still override before saving. Indigo magic-fill now
also highlights the Activity + Count fields.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Dashboard — EffortSummaryCard + per-project column + Calendar modal row

**Goal:** Dashboard surfaces v0 effort analytics.

**Files:**
- Create: `src/ui/screens/dashboard/EffortSummaryCard.tsx`
- Modify: `src/ui/screens/Dashboard.tsx`
- Modify: `src/ui/screens/dashboard/CalendarModal.tsx` (or `CalendarGrid`/`CalendarCell` — wherever per-day rendering lives)

- [ ] **Step 1: Create `EffortSummaryCard.tsx`**

```tsx
import type { MonthEffortTotals, EffortKind, EffortCategory } from '@/calc';
import { EFFORT_KIND_LABEL } from '@/ui/components/EffortKindSelect';

const CATEGORY_LABEL: Record<EffortCategory, string> = {
  client_sync: 'client-sync',
  technical: 'technical',
  client_async: 'client-async',
  internal: 'internal',
  enablement: 'enablement',
};

const CATEGORY_COLOR: Record<EffortCategory, string> = {
  client_sync: 'bg-partner-cyan',
  technical: 'bg-slate-700',
  client_async: 'bg-indigo-500',
  internal: 'bg-amber-500',
  enablement: 'bg-emerald-500',
};

type Props = {
  totals: MonthEffortTotals;
  onClick?: () => void;
};

export function EffortSummaryCard({ totals, onClick }: Props): JSX.Element {
  const topKinds = (Object.entries(totals.by_kind) as [EffortKind, number][])
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  if (totals.total_activities === 0) {
    return (
      <div className="glass rounded-xl p-4">
        <div className="font-display text-sm uppercase tracking-wide text-slate-500 mb-1">
          Effort · {totals.month}
        </div>
        <div className="text-xs text-slate-500">No activities tagged this month.</div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left glass rounded-xl p-4 hover:bg-white/80 transition-colors"
    >
      <div className="font-display text-sm uppercase tracking-wide text-slate-500 mb-2">
        Effort · {totals.month}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-3xl font-semibold tabular-nums text-slate-800">
            {totals.total_activities}
          </div>
          <div className="text-xs text-slate-500">activities</div>
          <ul className="mt-3 flex flex-col gap-0.5 text-xs text-slate-600">
            {topKinds.map(([k, n]) => (
              <li key={k}>
                <span className="tabular-nums font-mono">{n}</span> {EFFORT_KIND_LABEL[k]}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1">
          {(Object.entries(totals.by_category) as [EffortCategory, number][])
            .sort(([, a], [, b]) => b - a)
            .map(([cat, n]) => (
              <div key={cat} className="flex items-center gap-2 text-xs">
                <span className={`inline-block h-1.5 w-12 rounded ${CATEGORY_COLOR[cat]}`}
                  style={{ opacity: 0.3 + 0.7 * (n / Math.max(1, totals.total_activities)) }}
                />
                <span className="text-slate-600 flex-1">{CATEGORY_LABEL[cat]}</span>
                <span className="font-mono tabular-nums text-slate-700">{n}</span>
              </div>
            ))}
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Integrate into `Dashboard.tsx`**

Compose `computeMonthEffort` against the month's entries (same entries query used by `computeMonthTotals`) and render `<EffortSummaryCard />` alongside the existing totals. Add `onClick` to navigate to Entries pre-filtered with the Activity-has-value filter.

- [ ] **Step 3: Extend per-project table with an Effort column**

In the same Dashboard screen, the per-project breakdown table adds a column. Source the value from `monthEffort.per_project.find(p => p.project === row.project)?.total_activities ?? 0`. Tooltip shows the per-kind list.

- [ ] **Step 4: Calendar modal per-day effort row**

In `CalendarCell` (or wherever per-day rendering lives), add a small mono text under the bar when the day has tagged entries:

```tsx
{dayEffortCount > 0 && (
  <div className="text-[10px] font-mono text-slate-500">{dayEffortCount} acts</div>
)}
```

Compute `dayEffortCount = sum(e.effort_count) for entries matching this day with effort_kind !== null`. Pass into the cell from the grid.

- [ ] **Step 5: Typecheck + lint + tests**

```
npm run typecheck
npm run lint
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/dashboard/ src/ui/screens/Dashboard.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): EffortSummaryCard + per-project effort + calendar modal daily row

EffortSummaryCard shows this-month totals with top-3 kinds and a
category-tinted horizontal bar. Per-project breakdown table gains an
effort column with hover-tooltip per-kind split. Calendar modal adds
a compact "N acts" row under each day's hours bar when a day has
tagged activity.

Empty-state card prompts user to log their first tagged activity when
this month has none.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: CSV export — effort columns

**Goal:** CSV export appends `effort_kind` and `effort_count` columns at the end. Null exports as empty string.

**Files:**
- Modify: `src/export/csv.ts`
- Create: `tests/export/csv-effort.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/export/csv-effort.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { entriesToCSV } from '@/export/csv';
import type { Entry } from '@/schema/types';

const mk = (overrides: Partial<Entry> = {}): Entry => ({
  id: '2026-04-14-sprosty-aaaaaa',
  project: 'sprosty', date: '2026-04-14',
  hours_hundredths: 100, rate_cents: 12500,
  rate_source: 'global_default', billable_status: 'billable',
  bucket_id: null, description: 'x', review_flag: false,
  created_at: '2026-04-14T10:00:00Z', updated_at: '2026-04-14T10:00:00Z',
  source_ref: null, effort_kind: null, effort_count: null,
  ...overrides,
});

describe('entriesToCSV effort columns', () => {
  it('appends effort_kind and effort_count to the header', () => {
    const csv = entriesToCSV([mk()]);
    const header = csv.split('\n')[0]!;
    expect(header).toMatch(/effort_kind,effort_count$/);
  });

  it('renders null effort as empty strings', () => {
    const csv = entriesToCSV([mk()]);
    const row = csv.split('\n')[1]!;
    expect(row.endsWith(',,')).toBe(true);
  });

  it('renders non-null effort_kind + count correctly', () => {
    const csv = entriesToCSV([mk({ effort_kind: 'slack', effort_count: 3 })]);
    const row = csv.split('\n')[1]!;
    expect(row).toMatch(/,slack,3$/);
  });
});
```

- [ ] **Step 2: Run — verify failure**

```
npm test -- tests/export/csv-effort.test.ts
```

Expected: FAIL — effort columns don't exist.

- [ ] **Step 3: Update `src/export/csv.ts`**

Append to the existing header + row formatters:

```ts
// Add to header array:
'effort_kind',
'effort_count',

// Add to row formatter:
e.effort_kind ?? '',
e.effort_count === null ? '' : String(e.effort_count),
```

- [ ] **Step 4: Run tests**

```
npm test -- tests/export/csv-effort.test.ts tests/export/csv.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/export/csv.ts tests/export/csv-effort.test.ts
git commit -m "$(cat <<'EOF'
feat(export): CSV gains effort_kind + effort_count columns

Appended at the end of the existing column order so scripts consuming
prior exports keep working. Null values export as empty strings.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Documentation sweep

**Goal:** CLAUDE.md, architecture playbooks, backlog, research cross-reference, and new `effort-kinds.md` reference all updated.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/architecture/adding-a-field.md`
- Modify: `docs/architecture/calc-invariants.md`
- Modify: `docs/architecture/data-flow.md`
- Modify: `docs/architecture/google-calendar-setup.md`
- Modify: `docs/superpowers/backlog.md`
- Modify: `docs/superpowers/research/2026-04-14-feature-research.md`
- Create: `docs/architecture/effort-kinds.md`

- [ ] **Step 1: Update `CLAUDE.md`**

Add to "Non-negotiable invariants":

```
8. **Entry v4 effort fields.** `effort_kind` and `effort_count` are both null or both set — validator enforces. Do not log zero-hours entries even for lightweight activities — `hours_hundredths ≥ 1` stays invariant.
```

Extend "Do-not-touch-without-review list" under the `src/calc/**` entry:

```
- `src/calc/**` — every change re-runs **Gate A** (spec §7.2 Layer 4). Property tests + golden tests + multi-agent review must all pass. This now includes `src/calc/effort.ts` and `src/calc/effort-categories.ts` — they back dashboard aggregations and category mapping.
```

Add to "Where to find things" file map:

```
src/calc/effort.ts       → all effort aggregation (pure, Gate A)
src/calc/effort-categories.ts → kind → category mapping (pure, Gate A)
```

Add to "Common tasks":

```
- **Add a new effort kind:** `docs/architecture/effort-kinds.md`
```

Add to the top of the invariants section or the spec-index:

```
- [Effort tracking design](docs/superpowers/specs/2026-04-14-effort-tracking-design.md)
```

- [ ] **Step 2: Update `docs/architecture/adding-a-field.md`**

Append a new section: "v3 → v4: effort_kind and effort_count". Describe the dual-field addition, the cross-field rule, the hash-canonicalization pattern (emit when non-null), the writer upgrade path, and the test layers.

- [ ] **Step 3: Update `docs/architecture/calc-invariants.md`**

Add an "Effort invariants" section enumerating conservation, additivity, month scoping, categoryOf totality. Point to `tests/calc/effort-property.test.ts`.

- [ ] **Step 4: Update `docs/architecture/data-flow.md`**

Add arrows showing effort through:
- Log write: `FormState → buildEntry → addEntry → entries file (v4)`
- Dashboard read: `loadMonthEntries → computeMonthEffort → EffortSummaryCard`
- Profile read: `loadProfile → logging_mode → LogForm layout`

- [ ] **Step 5: Update `docs/architecture/google-calendar-setup.md`**

Add a small note: "Calendar-sourced entries auto-tag `effort_kind: 'meeting'` on apply. Overridable in the form before save."

- [ ] **Step 6: Create `docs/architecture/effort-kinds.md`**

```markdown
# Effort kinds

The 19 values of `EffortKind` and their rollup categories. Adding a new kind is additive: no schema version bump required.

## Kinds by category

### Client-sync
- **workshop** — discovery, scoping, working sessions
- **meeting** — kickoff, weekly sync, status call, client 1:1
- **client_training** — structured training / enablement

### Technical
- **config_work** — portal setup, user/permissions
- **build** — custom modules, templates, workflows
- **integration** — connectors, APIs, webhooks
- **data_work** — migration, cleaning, dedup, mapping
- **reporting** — dashboards, reports
- **qa** — testing, UAT, pre-launch validation

### Client-async
- **slack** — Slack / Teams messages
- **email** — email threads
- **async_video** — Loom / recorded walkthroughs
- **ticket** — Jira / Zendesk responses

### Internal
- **internal_sync** — stand-ups, planning, retros, 1:1s
- **documentation** — runbooks, training materials
- **peer_review** — config / code / data review

### Enablement
- **learning** — certifications, new-feature research
- **scoping** — pre-sales / SOW input

### Other
- **other** — catch-all; rolls up to `enablement` for aggregation

## Adding a new kind

1. Pick the category it belongs to.
2. Extend the `EffortKind` union in `src/schema/types.ts`.
3. Add the value to the `enum` array in `schemas/entries.schema.json`.
4. Add the case to `categoryOf` in `src/calc/effort-categories.ts`.
5. Add the value to `ALL_KINDS` in `src/calc/effort-categories.ts` (used by `emptyByKind`).
6. Add a human label in `EFFORT_KIND_LABEL` in `src/ui/components/EffortKindSelect.tsx`.
7. Add the kind to the `GROUPS` array in the same file so it appears in the dropdown.
8. Update this doc.

No schema version bump. The golden fixture is unaffected because no existing entry can have a newly-introduced kind.
```

- [ ] **Step 7: Update `docs/superpowers/backlog.md`**

Add to Shipped (after merge):

```
- **Effort tracking v0 (per-consultant).** Schema v4 adds optional `effort_kind` + `effort_count`. 19-kind taxonomy across 5 categories. Quick Activity card in Assist panel. `profile.logging_mode` for HubSpot-lead UI. Dashboard EffortSummaryCard + per-project effort column + calendar modal daily row. Agency-wide roll-up, auto-pull integrations, AI features deferred to later specs.
```

- [ ] **Step 8: Cross-reference in `docs/superpowers/research/2026-04-14-feature-research.md`**

Add a note under §5 (AI-native features):

```
> **Update 2026-04-14:** Effort data (shipped via `2026-04-14-effort-tracking-design.md`) is the primary substrate for many AI features catalogued below — AI8 (work-type classification), AI6 (weekly narrative), AI13 (project scope planner) benefit directly from effort_kind labels.
```

- [ ] **Step 9: Commit**

```bash
git add CLAUDE.md docs/
git commit -m "$(cat <<'EOF'
docs: effort tracking — CLAUDE.md + playbooks + kinds reference

CLAUDE.md: new invariant for effort cross-field rule, extended
Gate A file list, file-map entries for new calc modules, common-task
pointer to effort-kinds.md, cross-reference to the spec.

Architecture playbooks: adding-a-field.md gains v3→v4 migration
walkthrough; calc-invariants.md gains Effort Invariants section;
data-flow.md shows effort through log-write and dashboard-read paths;
google-calendar-setup.md notes auto-tag meeting on apply.

New: docs/architecture/effort-kinds.md — reference for the 19 kinds,
rollup categories, and the step-by-step for adding a new kind.

Backlog updated with shipped entry. Research doc cross-references
effort as the substrate for the AI-native features catalogued there.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Final verification gate + Gate A review

**Goal:** All automated gates green. `src/calc/hash.ts` (Task 2) and `src/calc/effort.ts` (Task 4) both touched `src/calc/` — Gate A applies. Independent code-reviewer pass required before merge.

**Files:** none modified.

- [ ] **Step 1: Typecheck**

```
npm run typecheck
```

Expected: PASS.

- [ ] **Step 2: Lint**

```
npm run lint
```

Expected: PASS (max-warnings 0).

- [ ] **Step 3: Full test suite**

```
npm test
```

Expected: PASS. Count should reflect new tests: ~10 migration + ~5 hash-v4 + ~20 effort unit + ~4 effort property + ~3 entries-repo-v4 + ~3 CSV-effort ≈ 45 new tests on top of existing.

- [ ] **Step 4: Golden regression (Gate A)**

```
npm run test:golden
```

Expected: PASS. March 2026 source_hash unchanged.

- [ ] **Step 5: Property tests (Gate A)**

```
npm run test:property
```

Expected: PASS.

- [ ] **Step 6: Production build**

```
npm run build
```

Expected: PASS.

- [ ] **Step 7: Announce Gate A review needed**

Post to the user:

> All automated gates green. `src/calc/hash.ts` (Task 2) and `src/calc/effort.ts` (Task 4) touched `src/calc/` — Gate A per CLAUDE.md requires independent multi-agent code review before merge. Property + golden passed locally. Please dispatch a `code-reviewer` agent focused on:
> - `src/calc/hash.ts` (effort-field projection preserves pre-v4 hashes)
> - `src/calc/effort.ts` + `src/calc/effort-categories.ts` (aggregation correctness, exhaustive mapping)
> - `src/schema/validators.ts` (cross-field rule, no input mutation, v1/v2/v3 backfill)
> - `src/data/entries-repo.ts` (`upgradeEntriesFileToV4`, commit-suffix message callback)
>
> before shipping.

---

## Self-Review Checklist

Ran after writing the complete plan.

1. **Spec coverage** — walked each spec section:
   - §4 decisions 1–10: all materialize in Tasks 1–13.
   - §5 data model: Task 1 (schema+validator), Task 2 (hash), Task 3 (writer), Task 5 (FormState), Task 6 (profile). ✓
   - §6 UI: Task 7 (primitives), Task 8 (LogForm), Task 9 (QuickActivityCard), Task 10 (Entries), Task 11 (Timer), Task 12 (Calendar), Task 14 (CSV). ✓
   - §7 Dashboard v0: Task 13. ✓
   - §8 calc module: Task 4 (categories + effort.ts + property tests). ✓
   - §9 file structure: entire plan mirrors §9.1/9.2 of the spec. ✓
   - §10 testing: covered layer-by-layer across Tasks 1–4, 14; Task 16 final gate. ✓
   - §11 documentation impact: Task 15 hits every bullet. ✓
   - §12 risks: mitigations baked into test layers. ✓
   - §14 acceptance criteria: 14 of 15 covered by specific task steps; final "Gate A review clean" covered by Task 16. ✓

2. **Placeholder scan:** no TBDs, no "similar to Task N" references, every code step shows the code. The Settings integration in Task 6 uses pseudocode explicitly labeled as "plug into whatever hooks the Settings screen already uses" — acceptable because the Settings screen is a pre-existing file with its own patterns; the plan names the concrete API (`updateProfile`) and field (`logging_mode`) the engineer must wire up.

3. **Type consistency:** `EffortKind` / `EffortCategory` spellings consistent across Tasks 1, 4, 7, 8, 9, 10, 11, 13, 14, 15. `MonthEffortTotals` shape is defined in Task 4 and consumed by Task 13. `FormState.effort_*` matches between Task 5 and consumers in Tasks 8/9/10/12. `updateSnapshot`'s widened type in Task 11 matches the pattern already in Task 6.

---
