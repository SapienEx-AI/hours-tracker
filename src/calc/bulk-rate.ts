import type { Entry, BillableStatus } from '@/schema/types';
import { mulCentsByHundredths, sumCents, subCents } from './int';

export type BulkRateFilter = {
  projectId?: string;
  bucketId?: string | 'none';
  dateFrom?: string;
  dateTo?: string;
  status?: BillableStatus;
};

function matchesBucket(entryBucketId: string | null, filterBucketId: string | 'none' | undefined): boolean {
  if (filterBucketId === undefined) return true;
  if (filterBucketId === 'none') return entryBucketId === null;
  return entryBucketId === filterBucketId;
}

function matchesDateRange(date: string, from: string | undefined, to: string | undefined): boolean {
  if (from !== undefined && date < from) return false;
  if (to !== undefined && date > to) return false;
  return true;
}

export function matchesBulkFilter(entry: Entry, filter: BulkRateFilter): boolean {
  if (filter.projectId !== undefined && entry.project !== filter.projectId) return false;
  if (!matchesBucket(entry.bucket_id, filter.bucketId)) return false;
  if (!matchesDateRange(entry.date, filter.dateFrom, filter.dateTo)) return false;
  if (filter.status !== undefined && entry.billable_status !== filter.status) return false;
  return true;
}

export type BulkRatePreview = {
  matched: Entry[];
  oldAmountCents: number;
  newAmountCents: number;
  totalDeltaCents: number;
};

export function previewBulkRate(
  entries: Entry[],
  filter: BulkRateFilter,
  newRateCents: number,
): BulkRatePreview {
  const matched = entries.filter((e) => matchesBulkFilter(e, filter));
  const oldAmountCents = sumCents(
    matched.map((e) => mulCentsByHundredths(e.rate_cents, e.hours_hundredths)),
  );
  const newAmountCents = sumCents(
    matched.map((e) => mulCentsByHundredths(newRateCents, e.hours_hundredths)),
  );
  return {
    matched,
    oldAmountCents,
    newAmountCents,
    totalDeltaCents: subCents(newAmountCents, oldAmountCents),
  };
}
