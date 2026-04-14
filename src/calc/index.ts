// Public re-exports for src/calc. Consumers should import from '@/calc' only.
export {
  addCents,
  subCents,
  sumCents,
  addHundredths,
  sumHundredths,
  mulCentsByHundredths,
  assertInteger,
  assertNonNegativeInteger,
} from './int';
export { resolveRateAtLogTime, type ResolvedRate, type ResolveRateArgs } from './rates';
export {
  computeMonthTotals,
  computeAllTimeBucketConsumption,
  splitBillingStreams,
  type CalcInput,
  type BillingStreamSplit,
} from './totals';
export { canonicalizeEntriesForHashing, hashEntries } from './hash';
export {
  matchesBulkFilter,
  previewBulkRate,
  type BulkRateFilter,
  type BulkRatePreview,
} from './bulk-rate';
export { computeDrift, type DriftDiff } from './drift';
export {
  computeMonthDaily,
  computeProjectBuildsForMonth,
  type DailyBreakdown,
  type MonthDaily,
  type ProjectBuildsMonthRow,
} from './daily';
export { isMonthlyStream } from './totals';
