# src/data

**Purpose:** GitHub API ↔ JSON files. Read, validate, commit. Handles optimistic concurrency.

**Public API:**
- `octokit-client.ts` — `makeOctokit(token)`, `encodeContent`, `decodeContent`, `splitRepoPath`
- `commit-messages.ts` — structured commit message formatters (spec §6.3)
- `github-file.ts` — `readJsonFile`, `writeJsonFile`, `writeJsonFileWithRetry`, `FileNotFoundError`, `ConflictError`
- `entries-repo.ts` — `loadMonthEntries`, `addEntry`, `updateEntry`, `deleteEntry`
- `projects-repo.ts` — `loadProjects`, `writeProjects`
- `rates-repo.ts` — `loadRates`, `writeRates`
- `profile-repo.ts` — `loadProfile`, `createProfile`
- `snapshots-repo.ts` — `loadSnapshot`, `writeSnapshot`
- `new-entry-id.ts` — `newEntryId`
- `query-keys.ts` — React Query cache key factory
- `query-client.ts` — shared QueryClient instance
- `hooks/*` — React Query hooks (`useProjects`, `useRates`, `useMonthEntries`, `useOctokit`)

**Invariants:**
1. Every write validates against the corresponding schema BEFORE hitting GitHub (spec §11 guard 1).
2. Writes include the file's current `sha`; on 409, one retry after refreshing (spec §6.4).
3. Two consecutive 409s surface a `ConflictError` — never silently discard.
4. Commit messages follow the structured prefix convention in spec §6.3.

**Dependencies:** `@octokit/rest`, `@tanstack/react-query`, `@/schema/*`, `@/format/format`.
