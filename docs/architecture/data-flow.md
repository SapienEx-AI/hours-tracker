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

## Checklist for touching this flow

- [ ] Validator still runs before GitHub write (`validateEntries`)
- [ ] New entry id unique within the target month file (duplicate guard in `addEntry`)
- [ ] Commit message uses `logMessage` helper (not hand-built string)
- [ ] React Query key invalidated via `qk.monthEntries`
- [ ] Errors surface to user via banner (never silent)
- [ ] Unit + integration tests updated if behavior changed
- [ ] Runtime invariant in Dashboard still catches drift (`assertMonthTotalsInvariants`)
