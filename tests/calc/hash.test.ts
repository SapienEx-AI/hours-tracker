import { describe, it, expect } from 'vitest';
import { canonicalizeEntriesForHashing, hashEntries } from '@/calc/hash';
import type { Entry } from '@/schema/types';

const baseEntry: Entry = {
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
  source_ref: null,
  effort: [],
};

describe('hash', () => {
  it('canonicalizeEntriesForHashing is stable across key-order differences', () => {
    const a = [baseEntry];
    // A re-ordered clone with same content but arbitrary key order.
    const b = [
      {
        effort: baseEntry.effort,
        source_ref: baseEntry.source_ref,
        updated_at: baseEntry.updated_at,
        created_at: baseEntry.created_at,
        review_flag: baseEntry.review_flag,
        description: baseEntry.description,
        bucket_id: baseEntry.bucket_id,
        billable_status: baseEntry.billable_status,
        rate_source: baseEntry.rate_source,
        rate_cents: baseEntry.rate_cents,
        hours_hundredths: baseEntry.hours_hundredths,
        date: baseEntry.date,
        project: baseEntry.project,
        id: baseEntry.id,
      },
    ];
    expect(canonicalizeEntriesForHashing(a)).toBe(
      canonicalizeEntriesForHashing(b as unknown as Entry[]),
    );
  });

  it('canonicalizeEntriesForHashing sorts entries by id for deterministic output', () => {
    const a: Entry[] = [
      { ...baseEntry, id: '2026-03-25-sprosty-bbbbbb' },
      { ...baseEntry, id: '2026-03-25-sprosty-aaaaaa' },
    ];
    const b: Entry[] = [
      { ...baseEntry, id: '2026-03-25-sprosty-aaaaaa' },
      { ...baseEntry, id: '2026-03-25-sprosty-bbbbbb' },
    ];
    expect(canonicalizeEntriesForHashing(a)).toBe(canonicalizeEntriesForHashing(b));
  });

  it('hashEntries returns a sha256-prefixed 64-char hex string', async () => {
    const h = await hashEntries([baseEntry]);
    expect(h).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('hashEntries is deterministic across repeated calls', async () => {
    const h1 = await hashEntries([baseEntry]);
    const h2 = await hashEntries([baseEntry]);
    expect(h1).toBe(h2);
  });

  it('hashEntries produces different hashes for different content', async () => {
    const h1 = await hashEntries([baseEntry]);
    const h2 = await hashEntries([{ ...baseEntry, description: 'different' }]);
    expect(h1).not.toBe(h2);
  });
});
