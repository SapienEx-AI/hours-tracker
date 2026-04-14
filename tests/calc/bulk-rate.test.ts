import { describe, it, expect } from 'vitest';
import { matchesBulkFilter, previewBulkRate } from '@/calc/bulk-rate';
import type { Entry } from '@/schema/types';

function makeEntry(p: Partial<Entry> = {}): Entry {
  return {
    id: 'e1', project: 'sprosty', date: '2026-03-10', hours_hundredths: 400,
    rate_cents: 10000, rate_source: 'global_default', billable_status: 'billable',
    bucket_id: null, description: 'd', review_flag: false,
    created_at: '2026-03-10T00:00:00Z', updated_at: '2026-03-10T00:00:00Z',
    ...p,
  };
}

describe('matchesBulkFilter', () => {
  it('matches when every populated field agrees with the entry', () => {
    const e = makeEntry({ project: 'bayard', date: '2026-03-15', billable_status: 'billable' });
    expect(matchesBulkFilter(e, { projectId: 'bayard' })).toBe(true);
    expect(matchesBulkFilter(e, { projectId: 'sprosty' })).toBe(false);
  });

  it('treats dateFrom/dateTo as inclusive string bounds (YYYY-MM-DD sorts lexically)', () => {
    const e = makeEntry({ date: '2026-04-10' });
    expect(matchesBulkFilter(e, { dateFrom: '2026-04-01' })).toBe(true);
    expect(matchesBulkFilter(e, { dateFrom: '2026-04-11' })).toBe(false);
    expect(matchesBulkFilter(e, { dateTo: '2026-04-10' })).toBe(true);
    expect(matchesBulkFilter(e, { dateTo: '2026-04-09' })).toBe(false);
  });

  it('bucket filter value "none" matches only unbucketed entries', () => {
    expect(matchesBulkFilter(makeEntry({ bucket_id: null }), { bucketId: 'none' })).toBe(true);
    expect(matchesBulkFilter(makeEntry({ bucket_id: 'x' }), { bucketId: 'none' })).toBe(false);
    expect(matchesBulkFilter(makeEntry({ bucket_id: 'x' }), { bucketId: 'x' })).toBe(true);
  });
});

describe('previewBulkRate', () => {
  it('computes delta using integer math: sum(hours * (new - old))', () => {
    const entries = [
      makeEntry({ id: 'a', hours_hundredths: 400, rate_cents: 10000 }),
      makeEntry({ id: 'b', hours_hundredths: 200, rate_cents: 10000 }),
    ];
    const result = previewBulkRate(entries, {}, 15000);
    expect(result.matched.map((e) => e.id)).toEqual(['a', 'b']);
    expect(result.oldAmountCents).toBe(60000);
    expect(result.newAmountCents).toBe(90000);
    expect(result.totalDeltaCents).toBe(30000);
  });

  it('only includes entries passing the filter', () => {
    const entries = [
      makeEntry({ id: 'a', project: 'sprosty' }),
      makeEntry({ id: 'b', project: 'bayard' }),
    ];
    const result = previewBulkRate(entries, { projectId: 'sprosty' }, 20000);
    expect(result.matched.map((e) => e.id)).toEqual(['a']);
  });
});
