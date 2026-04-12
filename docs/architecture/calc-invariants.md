# Calc invariants — full list

Every invariant the calc module must uphold, with the test that proves it.

| # | Invariant | Test |
|---|---|---|
| 1 | `billable + non_billable + needs_review = total` | `tests/calc/property.test.ts` "Conservation: billable + non_billable + needs_review === total for any input" |
| 2 | `sum(per_project.billable_amount) = global.billable_amount` | `tests/calc/property.test.ts` "Additivity: sum(per_project billable_amount) === global billable_amount for any partition" |
| 3 | Entries outside target month excluded | `tests/calc/property.test.ts` "Month-scoping: entries outside the target month do not contribute to totals" |
| 4 | Adding a billable entry never decreases `billable_amount` | `tests/calc/property.test.ts` "Monotonicity under insertion: adding a billable entry never decreases billable_amount" |
| 5 | `hashEntries(X) === hashEntries(X)` always | `tests/calc/property.test.ts` "Hash determinism: hashEntries(X) === hashEntries(X) always" |
| 6 | Hash invariant under array-order reversal | `tests/calc/property.test.ts` "Hash array-order invariance: shuffled entry array produces the same hash" |
| 7 | `mulCentsByHundredths` rejects non-integer results | `tests/calc/int.test.ts` "mulCentsByHundredths throws if the result would not be an integer" |
| 8 | `resolveRateAtLogTime` bucket > project > global fallback | `tests/calc/rates.test.ts` (8 branch tests) |
| 9 | Runtime cross-check in Dashboard: per-project sum = top-level | `src/ui/runtime-invariants.ts` via `assertMonthTotalsInvariants` |
| 10 | March 2026 totals match hand-verified expected | `tests/calc/golden-full.test.ts` "top-level totals match the hand-verified expected values" |
| 11 | March 2026 per-project totals match expected | `tests/calc/golden-full.test.ts` "per-project totals match the hand-verified expected values" |
| 12 | Sprosty $20 override works on real March data | `tests/calc/golden-full.test.ts` "sprosty breakdown confirms $20 rate override applied to 9h of Skyvia work" |
| 13 | Mini golden totals match expected | `tests/calc/golden-mini.test.ts` (2 tests) |

## Checklist for adding a new invariant

- [ ] Invariant stated in prose in this table
- [ ] Property test added with the EXACT invariant name as the test description
- [ ] Unit test(s) exercise the edge cases that inspired the invariant
- [ ] Spec §7.2 layer 2 list updated if it's a new layer-2 invariant
- [ ] `CLAUDE.md` "Non-negotiable invariants" list updated if it's non-negotiable
