import { sumCents, sumHundredths } from '@/calc';
import type { MonthTotals } from '@/schema/types';

/**
 * Cross-path verification of MonthTotals (spec §7.2 layer 5).
 *
 * Recomputes the same numbers via a second path:
 *   - top-level billable_amount_cents should equal sum of per_project billable_amount_cents
 *   - top-level total_hours should equal billable + non_billable + needs_review
 *
 * Throws on any mismatch. Caller renders an error banner instead of wrong numbers.
 */
export function assertMonthTotalsInvariants(totals: MonthTotals): void {
  const billableCrossCheck = sumCents(totals.per_project.map((p) => p.billable_amount_cents));
  if (billableCrossCheck !== totals.billable_amount_cents) {
    throw new Error(
      `Invariant violation: per-project billable sum (${billableCrossCheck}) !== top-level (${totals.billable_amount_cents})`,
    );
  }
  const conservedTotal = sumHundredths([
    totals.billable_hours_hundredths,
    totals.non_billable_hours_hundredths,
    totals.needs_review_hours_hundredths,
  ]);
  if (conservedTotal !== totals.total_hours_hundredths) {
    throw new Error(
      `Invariant violation: conservation breach total=${totals.total_hours_hundredths} parts=${conservedTotal}`,
    );
  }
}
