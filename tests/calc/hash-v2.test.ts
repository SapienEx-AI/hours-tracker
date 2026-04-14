import { describe, it, expect } from 'vitest';
import { hashEntries, canonicalizeEntriesForHashing } from '@/calc';
import type { Entry } from '@/schema/types';

function baseEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: '2026-03-25-sprosty-aaaaaa',
    project: 'sprosty',
    date: '2026-03-25',
    hours_hundredths: 400,
    rate_cents: 12500,
    rate_source: 'global_default',
    billable_status: 'billable',
    bucket_id: null,
    description: 'test',
    review_flag: false,
    created_at: '2026-03-25T22:15:04Z',
    updated_at: '2026-03-25T22:15:04Z',
    source_event_id: null,
    ...overrides,
  };
}

describe('hash with source_event_id', () => {
  it('omits source_event_id from canonical form when null', () => {
    const entry = baseEntry({ source_event_id: null });
    const canonical = canonicalizeEntriesForHashing([entry]);
    expect(canonical).not.toContain('source_event_id');
  });

  it('produces a different hash when source_event_id is non-null', async () => {
    const withNull = await hashEntries([baseEntry({ source_event_id: null })]);
    const withValue = await hashEntries([baseEntry({ source_event_id: 'gcal-xyz' })]);
    expect(withNull).not.toBe(withValue);
  });

  it('is deterministic across repeated calls', async () => {
    const h1 = await hashEntries([baseEntry({ source_event_id: 'gcal-xyz' })]);
    const h2 = await hashEntries([baseEntry({ source_event_id: 'gcal-xyz' })]);
    expect(h1).toBe(h2);
  });
});
