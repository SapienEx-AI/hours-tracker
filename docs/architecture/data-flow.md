# Data flow — logging a single hour

End-to-end trace of what happens when the user clicks "Save" in Quick Log.

## Steps

1. **User fills Quick Log form** (`src/ui/screens/QuickLog.tsx`). Project/date/hours/description required. Bucket optional. Rate auto-resolved via `resolveRateAtLogTime`; user may override.
2. **Save click** triggers `mutation.mutate()` (React Query mutation).
3. **Mutation function** constructs an `Entry` via `buildEntry`, calling `newEntryId` and `resolveRateAtLogTime` one final time.
4. **`addEntry`** (`src/data/entries-repo.ts`) validates the entry against `entries.schema.json` via ajv. On failure → throw (banner shown).
5. **`writeJsonFileWithRetry`** (`src/data/github-file.ts`) reads the current month file, merges the new entry, and PUTs back to GitHub with `sha`. On 409, one retry with fresh sha.
6. **Commit message** built from `logMessage(...)` (`src/data/commit-messages.ts`). Structured prefix `log: ...`.
7. **React Query cache invalidated** on success via `queryClient.invalidateQueries({ queryKey: qk.monthEntries(...) })`.
8. **Dashboard and Entries screens** re-fetch automatically on next focus.

## Effort-tracking flow (v4)

Optional effort tagging branches off the same Quick Log form:

- **Form state:** `FormState.effort_kind` + `effort_count` default to null. They stay null for pure-hours entries. Setting one requires setting the other — enforced by the schema cross-field validator before the write.
- **Log write:** `FormState → buildEntry (emits effort_kind + effort_count) → addEntry (validates) → entries file (v4)`. The writer calls `upgradeEntriesFileToV4` first when opening a legacy file, with a `[schema vN→v4]` suffix on the commit.
- **Profile-driven UI:** `loadProfile → profile.logging_mode → LogForm layout`. `effort` mode promotes the Activity row and collapses Status/Rate into an Advanced disclosure; `hours` keeps the legacy layout; `both` renders everything inline.
- **Dashboard read:** `loadMonthEntries → computeMonthEffort → EffortSummaryCard`, plus `computeMonthEffort.per_project` enriches the per-project table, and a per-date count feeds the calendar modal's daily "N acts" row.
- **Calendar auto-tag:** `applySuggestion` (in `QuickLog.tsx`) sets `effort_kind: 'meeting'` + `effort_count: 1` on prefill. User can override before save.
- **Timer inline:** the Timer card's inline edit includes an Activity select. Changes sync through `setForm` + `updateSnapshot` so `HistoricalRecording` captures the chosen kind — redrive restores full context.

## Checklist for touching this flow

- [ ] Validator still runs before GitHub write (`validateEntries`)
- [ ] New entry id unique within the target month file (duplicate guard in `addEntry`)
- [ ] Commit message uses `logMessage` helper (not hand-built string)
- [ ] React Query key invalidated via `qk.monthEntries`
- [ ] Errors surface to user via banner (never silent)
- [ ] Unit + integration tests updated if behavior changed
- [ ] Runtime invariant in Dashboard still catches drift (`assertMonthTotalsInvariants`)
