# Multi-kind effort per entry — design (schema v5 → v6)

Logged entries can carry more than one activity kind. A 2.5-hour block that covered 2 meetings, 1 Slack thread, and 3 tickets captures all three in a single entry — not flattened to one kind.

## 1. Purpose

Today's `Entry.effort_kind: EffortKind | null` + `Entry.effort_count: number | null` collapse a mixed hour into a single activity tag, losing resolution. The Quick Activity panel's click-to-append flow already surfaces this mismatch: click `+ Meeting` twice then click `+ Slack` and the saved entry records only "Slack, count 1" while the user's hours kept accumulating. Users see the loss and rightly object.

## 2. Non-goals

- **No per-kind hours split.** `hours_hundredths` stays a single pool on the entry. Attributing time *within* an entry to a specific kind is a separate rabbit hole that doesn't match how consultants actually log ("I worked 2.5h and during it I did 2 meetings and fired off a Slack").
- **No ordering semantics.** The array is a set of `{kind, count}` pairs keyed by `kind`, not a timeline. Insertion order is not preserved in storage — the canonicalizer sorts by kind.
- **No per-chip notes or timestamps.** The entry-level `description` absorbs that narrative.
- **No change to how rollups are analytically sliced.** `MonthEffortTotals` keeps the same output shape (`by_kind`, `by_category`, `per_project`) — consumers are unaffected.

## 3. Architecture decisions

| # | Decision | Why |
|---|---|---|
| 1 | `Entry.effort: Array<{ kind: EffortKind; count: number }>`, required, may be `[]` | Natural shape of "how many of each kind". Empty-array replaces the old both-null state. |
| 2 | **Uniqueness-by-kind** enforced at three layers: validator wrapper, `upgradeEntriesFileToV6` normalizer, and an `addEntry`/`updateEntry` writer probe | Reviewer 1 flagged wrapper-only enforcement as leaky — any path that bypasses the wrapper (tests, importers, mid-flight writes) could produce duplicate-kind arrays that hash and persist. Defense in depth. |
| 3 | Hash canonicalizer **omits `effort` when the array is empty**, sorts by `kind` when non-empty | Reviewer 1 flagged the golden-hash risk. The pattern mirrors today's `source_event_id: null` omission, keeping the March 2026 golden fixture's hash unchanged. |
| 4 | UI shape: chip list + inline "add activity" row | Approved in brainstorm. Chips are the shape of what's stored. |
| 5 | **Allow `effort: []` with nonzero hours** (orphaned hours) | Back-compat with existing entries and the golden fixture. `canSave` does NOT require chips. |
| 6 | **Inline caption under chip list:** "Hours apply to the whole block, not split per activity." | Reviewer 2 flagged the pool-hours mental model. A quiet one-liner heads off confusion without UI chrome. |
| 7 | Forward-compat on main before the v6 *writer* ships publicly | Same pattern we used for v3→v4 and v4→v5. Prevents production from choking on a v6 file written from a dev build. |
| 8 | Count of `0` via inline edit removes the chip, doesn't persist `0 kind` | Reviewer 2. |
| 9 | Legacy entries (v1-v5 without effort fields) show "No activities tagged — add one?" in EditEntryModal | Explicit empty state, not a broken-looking chip rail. |
| 10 | Duplicate-kind inputs during migration are collapsed (sum of counts), not rejected | Migration should be maximally lenient so broken legacy data doesn't strand the user. |

## 4. Data model

### 4.1 Type shape

```ts
export type EffortItem = {
  kind: EffortKind;
  count: number;  // 1..100
};

export type Entry = {
  // ... other fields unchanged
  effort: EffortItem[];  // required, may be []; unique by `kind`
};

export type EntriesFile = {
  schema_version: 1 | 2 | 3 | 4 | 5 | 6;
  month: string;
  entries: Entry[];
};
```

### 4.2 JSON schema (excerpts from `schemas/entries.schema.json`)

```jsonc
{
  "title": "Monthly entries file (v6)",
  "properties": {
    "schema_version": { "enum": [1, 2, 3, 4, 5, 6] },
    "entries": {
      "items": {
        "required": ["...existing...", "effort"],
        "properties": {
          "effort": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["kind", "count"],
              "additionalProperties": false,
              "properties": {
                "kind": { "enum": [/* existing EffortKind enum */] },
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

Uniqueness-by-kind is **not** encoded in the raw schema (ajv's `uniqueItems` operates on deep equality, not sub-field uniqueness). Enforced by the validator wrapper; see §4.4.

### 4.3 Read-path migration

Every caller of `validateEntries` gets v6-shaped data back, regardless of disk version.

| Disk version | `effort` on disk | In-memory after validate | Legacy fields on disk |
|---|---|---|---|
| v1 | absent | `[]` | none |
| v2 | absent | `[]` | none |
| v3 | absent | `[]` | none |
| v4 | absent | `[]` | none |
| v5 | absent | lift from `effort_kind`/`effort_count` (see 4.3.1) | `effort_kind` + `effort_count` present |
| v6 | present | as-is after uniqueness normalize | none |

On read, the validator wrapper:
1. `structuredClone` the input (never mutate caller).
2. Strip legacy `source_event_id` when both it and `source_ref` are set (existing self-heal).
3. Run ajv against the cloned shape.
4. For each entry: if `effort` missing and `effort_kind`/`effort_count` present (v5 shape), lift per 4.3.1.
5. For each entry: if `effort` missing entirely (v1–v4), set `effort = []`.
6. For each entry: strip `effort_kind` + `effort_count` from the clone.
7. For each entry: collapse duplicate-kind items (sum counts), then sort by kind.
8. Reject if any `count` is outside `[1, 100]` (ajv already enforces via the per-item schema). No cap on array length — uniqueness-by-kind bounds it at `|EffortKind enum| = 19`.

#### 4.3.1 v5 lift rule

```
both non-null:  [{ kind: effort_kind, count: effort_count }]
either null:    []  // asymmetric pair silently drops the half-value; documented
```

Reviewer 1 flagged the asymmetric case. v5's schema required both null or both set, so real data never has one-null pairs — but the migration handles them defensively anyway.

### 4.4 Uniqueness-by-kind enforcement (three layers)

1. **Validator wrapper** — see 4.3 step 7. Duplicate kinds collapse (counts sum). Surfaces no error — the validator normalizes.
2. **`upgradeEntriesFileToV6`** — same normalization pass before write. Catches any in-memory drift that happened between read and write (e.g., a UI bug that pushed two chips with the same kind into form state).
3. **`addEntry`/`updateEntry` writer probes** — after building the final file, assert that every entry's `effort` is unique-by-kind. Throws if not. This catches a buggy caller that constructed an Entry without going through the normalizer.

### 4.5 Hash canonicalization

In `canonicalizeEntry` (`src/calc/hash.ts`):

```ts
// Emit `effort` only when non-empty, sorted by kind, so empty-effort v1-v5 entries
// hash identically to their pre-v6 canonical form (golden fixture safety).
if (e.effort.length > 0) {
  base.effort = [...e.effort]
    .sort((a, b) => a.kind.localeCompare(b.kind));
}
```

Every migrated v1–v4 entry has `effort: []`, which produces the exact pre-v6 canonical form. The March 2026 golden fixture hash is unchanged. `npm run test:golden` continues to pass.

Non-empty arrays sort deterministically by `kind`. Two semantically-equal entries hash identically regardless of the UI's insertion order.

## 5. UI

### 5.1 Activity field (Log form + EditEntryModal)

```
ACTIVITY
┌────────────────────────────────────────────────────────┐
│  2 · Meeting  ×    1 · Slack  ×    3 · Ticket  ×       │  ← chip list, wraps
└────────────────────────────────────────────────────────┘
┌──────────────────────┬──────┬──────┐
│ + add kind      [▾] │  1   │  Add │  ← inline add row
└──────────────────────┴──────┴──────┘
Hours apply to the whole block, not split per activity.  ← caption
```

**Chip anatomy:**
- `{count} · {EFFORT_KIND_LABEL[kind]}` + `×` remove button.
- Clicking the count opens an inline numeric input; committing `0` removes the chip, committing `1+` updates it.
- `role="button"` with `tabindex="0"` — Backspace on a focused chip removes it, Enter/Space activates the edit.
- Chip background uses the `EFFORT_UNIT_LABEL` color family — neutral slate, no per-kind palette (keep the visual calm).

**Inline add row:**
- Kind dropdown: existing `EffortKindSelect` (supports `null` as "select kind").
- Count: number input, `min=1 max=100`, default 1.
- `Add` button: disabled until a kind is selected; Enter in the count input submits.
- On Add: if kind already in `effort`, increment that chip's count by the typed amount; else append. Row resets (`kind=null, count=1`).

**Empty state (legacy entries, fresh Log form):**
- Chip strip renders a dotted empty placeholder with `No activities tagged` in muted italic text.
- Inline add row remains active so the user can start typing.

### 5.2 EditEntryModal specifics (Reviewer 2)

- Uses the same chip-list + add-row component as the Log form (extracted into `EditActivityField.tsx` which already exists — expanded to handle arrays).
- Legacy entries (v1–v4, and v5 with null effort) arrive with `effort: []`. The chip list renders the empty placeholder. User can add chips and save. Commit message diff surface: `activity: none → 2 Meeting, 1 Slack` (see 5.5).

### 5.3 Quick Activity panel

- Each click appends/increments a kind in the array (dedup-by-kind). Hours accumulate the click's `hoursHundredths` as today.
- Hover preview: keeps the current hours-delta display. No chip-array preview in v1 of this feature — add later if usage shows it helps.
- FieldFlash: today's `loadFlashFields` covers `effort_kind` + `effort_count`. Those keys go away. Replace with a single `effort` flash key. `FLASH_ORDER` in `src/ui/screens/log/FieldFlash.tsx` adjusted accordingly.

### 5.4 EntryRow compact display

- Up to 3 chips: `2·mtg · 1·slk · 3·tkt`. Uses the first 3 letters of each kind's label for density.
- Overflow: `+N more` in muted text.
- `0` activities on the entry: render nothing (no empty chip strip).

### 5.5 CSV export

- Single `effort` column. Value format: `kind1:count1;kind2:count2` (semicolon-separated). Sorted by kind for determinism. Empty effort: empty string.
- Replaces today's two columns (`effort_kind`, `effort_count`).
- Safe for CSV — no commas in values, no quotes needed.

### 5.6 Activity filter on Entries screen

- Today's single-kind filter (`statusFilter` + `effortKindFilter`) reads `e.effort_kind` scalar.
- v6: filter matches if `e.effort.some(item => item.kind === filter)`. Filter control stays single-select for now.
- Multi-select filter is a follow-up — out of scope for this spec.

### 5.7 Commit message format

In `src/data/commit-messages.ts`, `logMessage`:
- If `entry.effort.length === 0`: no activity suffix.
- Otherwise: ` [activity: 2 meeting, 1 slack]` after the existing description. Sorted by kind for determinism.
- `editMessage` similarly surfaces activity changes: `activity: 1 meeting → 2 meeting, 1 slack`.

## 6. Write-path upgrade

`upgradeEntriesFileToV6` in `src/data/entries-repo.ts`:

```ts
export function upgradeEntriesFileToV6(file: EntriesFile): EntriesFile {
  const entries = file.entries.map((e) => {
    const anyE = e as Entry & {
      source_event_id?: string | null;
      effort_kind?: EffortKind | null;
      effort_count?: number | null;
    };
    const cleaned: Record<string, unknown> = { ...anyE };
    delete cleaned.source_event_id;
    delete cleaned.effort_kind;
    delete cleaned.effort_count;

    // Lift v5 legacy pair → array.
    let effort: EffortItem[] = Array.isArray(cleaned.effort)
      ? (cleaned.effort as EffortItem[])
      : [];
    if (effort.length === 0 && anyE.effort_kind !== null && anyE.effort_kind !== undefined
        && anyE.effort_count !== null && anyE.effort_count !== undefined) {
      effort = [{ kind: anyE.effort_kind, count: anyE.effort_count }];
    }

    // Normalize: collapse duplicates, sort by kind.
    effort = collapseAndSort(effort);

    return { ...cleaned, effort } as Entry;
  });
  if (file.schema_version === 6) return { ...file, entries };
  return { ...file, schema_version: 6, entries };
}

function collapseAndSort(items: EffortItem[]): EffortItem[] {
  const byKind = new Map<EffortKind, number>();
  for (const it of items) {
    byKind.set(it.kind, (byKind.get(it.kind) ?? 0) + it.count);
  }
  return [...byKind.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => a.kind.localeCompare(b.kind));
}
```

## 7. Forward-compat on main

Before the v6 *writer* ships publicly, bump main's `entries.schema.json` to accept `schema_version: 6` and the `effort` array as an optional property. Same pattern we used for v3→v4 and v4→v5. This keeps production readable if a dev-build tab writes v6 before main's full change deploys.

```json
"schema_version": { "enum": [1, 2, 3, 4, 5, 6] },
"properties": {
  ...
  "effort": { /* full v6 shape */ }
}
```

## 8. File touch list

All paths relative to repo root. **26 files** after incorporating reviewer feedback.

### Schema + core

- `schemas/entries.schema.json` — v6 shape
- `src/schema/types.ts` — `Entry.effort`, `EffortItem`, `EntriesFile.schema_version` widened
- `src/schema/validators.ts` — v5 lift, v1–v4 default, v6 normalize, uniqueness-by-kind
- `src/calc/hash.ts` — canonicalize sorted effort, omit empty
- `src/calc/effort.ts` — `computeMonthEffort` iterates the array
- `src/data/entries-repo.ts` — `upgradeEntriesFileToV6`, writer probes, `addEntry`/`updateEntry` probes
- `src/data/commit-messages.ts` — `logMessage`/`editMessage` effort serialization

### Log form surface

- `src/ui/screens/QuickLog.tsx` — `onQuickActivity` operates on array, form state, reset behavior on save
- `src/ui/screens/log/form-helpers.ts` — `Form` type, `emptyForm`, `formToEntry` serializer *(reviewer 3 flagged; single source of truth)*
- `src/ui/screens/log/LogFormFields.tsx` — `ActivityField` chip list + inline add
- `src/ui/screens/log/QuickActivityCard.tsx` — click-to-append/increment operates on array
- `src/ui/screens/log/TimerCard.tsx` — reads `form.effort_kind` today; switch to `form.effort` *(reviewer 3)*
- `src/ui/screens/log/FieldFlash.tsx` — `FLASH_ORDER` replace `effort_kind`/`effort_count` with `effort` *(reviewer 3)*

### Edit / Entries / CSV surface

- `src/ui/screens/entries/EditEntryModal.tsx` — state holds `effort`, `buildChangeDescription` covers array diffs
- `src/ui/screens/entries/EditActivityField.tsx` — rewrite to chip list component
- `src/ui/screens/entries/EntryRow.tsx` — compact multi-chip display with `+N more` overflow
- `src/ui/screens/Entries.tsx` — `effortKindFilter` switches to `.effort.some(...)` *(reviewer 3)*
- `src/export/csv.ts` — single `effort` column, `kind:count;…` format

### Dashboard + calendar

- `src/ui/screens/dashboard/EffortSummaryCard.tsx` — reads from `MonthEffortTotals` which keeps same shape; no logic change expected but verify it doesn't peek at raw entries
- `src/ui/screens/dashboard/CalendarModal.tsx` — per-day effort sum iterates array *(reviewer 3)*

### Timer store

- `src/store/timer-store.ts` — `updateSnapshot`'s `'effort_kind'` key literal *(reviewer 3)*
- `src/store/timer-session.ts` — `Form` type loses `effort_kind`, gains `effort` *(reviewer 3)*

### Scripts

- `scripts/import-march-2026.ts` — confirm no effort-field emission (import stays v1 target, golden stays v1) *(reviewer 3 — verify)*

### Tests

- `tests/schema/entry-v6-migration.test.ts` — new; covers every legacy version's lift, asymmetric pair, duplicate collapse, uniqueness normalization
- `tests/calc/hash-v6.test.ts` — new; golden-fixture hash unchanged, non-empty sort-by-kind determinism, effort absent/present parity
- `tests/calc/effort.test.ts` — updated for array iteration; all existing `by_kind` / `by_category` / `per_project` invariants preserved
- `tests/calc/property.test.ts` — conservation invariant, monthly agreement, project-builds agreement; generator updated to produce unique-kind arrays
- `tests/export/csv-effort.test.ts` — new; round-trip of effort column
- `tests/data/entries-repo-v6.test.ts` — new; upgrade pass correctness (dup collapse, legacy strip)
- `tests/store/timer-session.test.ts` — update `Form` shape

### Never touched

- `tests/fixtures/2026-03-golden.json` (stays v1)
- `tests/fixtures/2026-03-expected.json` (totals unchanged)
- `src/calc/int.ts`, `src/calc/bulk-rate.ts`, `src/calc/drift.ts`, `src/calc/totals.ts`, `src/calc/daily.ts`, `src/calc/rates.ts`
- Partner configs, theming, AppShell

## 9. Error handling + edge cases

| Scenario | Behavior |
|---|---|
| v1 file on disk, `effort` field absent | Validator injects `effort: []`; golden hash unchanged (canonicalizer omits empty). |
| v5 file with `{effort_kind: 'meeting', effort_count: 2}` | Validator lifts to `effort: [{kind:'meeting',count:2}]`, strips legacy fields from clone. |
| v5 file with `{effort_kind: 'meeting', effort_count: null}` (asymmetric, shouldn't happen per v5 schema) | Validator produces `effort: []` and logs no error. Documented in 4.3.1. |
| Disk has `effort: [{meeting,1},{meeting,2}]` (corruption) | Validator's normalize step collapses to `[{meeting,3}]`. Next write lands clean. |
| User removes all chips, 2.5h still in form | Save succeeds — `effort: []` with hours is a valid state (matches legacy entries). |
| User picks Meeting in dropdown, Add; then clicks `+ Meeting` in Quick Activity | Chip count becomes 2. Hours accumulate the Quick Activity delta. FieldFlash fires on `effort` + `hoursHundredths`. |
| User edits a legacy entry in EditEntryModal | Empty chip rail + placeholder "No activities tagged — add one?"; user can add and save. |
| Inline chip count edited to `0` | Chip removed. |
| Production reads a v6 file before the v6 writer deploys | Forward-compat schema on main accepts v6 shape; validator's lift path doesn't need to fire. |

## 10. Testing plan

**Unit (calc):**
- Hash canonicalizer: empty effort → canonical form matches pre-v6 exactly (one test per entry shape).
- Hash: non-empty effort sorted deterministically; `[meeting,1][slack,1]` hashes same as `[slack,1][meeting,1]`.
- `computeMonthEffort`: same outputs as today for single-kind entries; new behavior for multi-kind entries (2 meetings + 1 slack in one entry → `by_kind.meeting=2`, `by_kind.slack=1`, `total_events=3`).

**Unit (schema migration):**
- Every legacy version (v1-v5) lifts correctly.
- Asymmetric v5 pair → `[]`.
- Duplicate-kind input collapses.
- `count > 100` or `count < 1` rejected.
- Unknown kind rejected.

**Property:**
- Conservation: sum of daily totals still === month total (unchanged).
- New: for any generated entry, validator output has unique kinds in `effort`.
- Golden fixture: runs unchanged.

**Integration:**
- Write a v4 file, read it back via validator, expect `effort: []` and the other legacy-strip behaviors.
- Write a v5 file, read it back, expect the lifted array shape.
- Round-trip a v6 entry through write → read → write → read; assert hash stable across rounds.

**UI smoke (manual):**
- Chip add via dropdown, chip remove via ×, inline count edit, keyboard Backspace to remove focused chip.
- Quick Activity click appends, second-same-kind click increments.
- EditEntryModal for a legacy entry shows empty placeholder.
- EntryRow compact display, `+N more` overflow.
- CSV export round-trips `effort` column.

## 11. Sequencing

Strict dependency order:

1. Forward-compat schema on main (1 commit, deploy immediately so production can read v6).
2. Types + schema + validator + hash + `effort.ts` calc (1 commit — core rewrite; compiler catches every consumer).
3. `upgradeEntriesFileToV6` + writer probes (1 commit).
4. `form-helpers.ts` + all log-screen consumers coordinated (1 commit — `Form` type change ripples; single commit so compiler catches stragglers).
5. EditEntryModal + EditActivityField chip rewrite (1 commit).
6. EntryRow + Entries filter + CalendarModal + EffortSummaryCard (1 commit — read-path consumers).
7. CSV export + commit messages (1 commit).
8. Tests added throughout; each feature commit lands with its tests green.
9. Backlog doc update (1 commit).

Expected branch: `feat/multi-kind-effort`. PR or direct merge at your call.

## 12. Out of scope

- Multi-select activity filter on Entries screen (single-select stays).
- Per-kind hours attribution.
- Per-chip notes or timestamps.
- Quick Activity hover preview showing the array delta.
- Dashboard trend views for multi-kind entries (rollup shape unchanged).
