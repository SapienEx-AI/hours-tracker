# src/calc

**Purpose:** All billing math for the hours tracker. Pure, side-effect-free, I/O-free.

**Public API:**
- `int.ts` — integer math helpers: `addCents`, `subCents`, `sumCents`, `addHundredths`, `sumHundredths`, `mulCentsByHundredths`, `assertInteger`, `assertNonNegativeInteger`.
- `rates.ts` — `resolveRateAtLogTime(projectId, date, projects, rates) → { rate_cents, source }`
- `totals.ts` — `computeMonthTotals(input, month)`, `computeProjectTotals(...)`, `computeBucketConsumption(...)`
- `hash.ts` — `canonicalizeEntriesForHashing`, `hashEntries`
- `index.ts` — public re-exports

**Invariants (spec §7):**
1. No DOM access, no fetch, no fs, no Octokit imports.
2. All arithmetic on _cents/_hundredths fields routes through `int.ts`.
3. Conservation: billable + non_billable + needs_review = total (Property test layer 2).
4. Rate snapshotting: changing rates never changes past totals.
5. Hash determinism: identical inputs produce identical hashes.

**Dependencies:**
- `@/schema/types` only.
- Crypto hashing uses `crypto.subtle` (browser native) — no npm lib.
