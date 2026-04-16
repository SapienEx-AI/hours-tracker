import { describe, it, expect } from 'vitest';
import { canonicalizeEntriesForHashing, hashEntries } from '@/calc/hash';
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
    source_ref: null,
    effort: [],
    ...overrides,
  };
}

describe('hash v6 — effort array', () => {
  it('omits empty effort from canonical form (golden-hash stability)', () => {
    const entry = baseEntry({ effort: [] });
    const canonical = canonicalizeEntriesForHashing([entry]);
    expect(canonical).not.toContain('effort');
  });

  it('emits non-empty effort sorted by kind', () => {
    const entry = baseEntry({
      effort: [
        { kind: 'slack', count: 1 },
        { kind: 'meeting', count: 2 },
      ],
    });
    const canonical = canonicalizeEntriesForHashing([entry]);
    const mIdx = canonical.indexOf('meeting');
    const sIdx = canonical.indexOf('slack');
    expect(mIdx).toBeGreaterThan(-1);
    expect(sIdx).toBeGreaterThan(mIdx);
  });

  it('hash is identical regardless of insertion order', async () => {
    const h1 = await hashEntries([
      baseEntry({ effort: [{ kind: 'meeting', count: 1 }, { kind: 'slack', count: 1 }] }),
    ]);
    const h2 = await hashEntries([
      baseEntry({ effort: [{ kind: 'slack', count: 1 }, { kind: 'meeting', count: 1 }] }),
    ]);
    expect(h1).toBe(h2);
  });

  it('hash is different when counts differ', async () => {
    const h1 = await hashEntries([baseEntry({ effort: [{ kind: 'meeting', count: 1 }] })]);
    const h2 = await hashEntries([baseEntry({ effort: [{ kind: 'meeting', count: 2 }] })]);
    expect(h1).not.toBe(h2);
  });

  it('empty-effort entry hash is deterministic', async () => {
    const h1 = await hashEntries([baseEntry({ effort: [] })]);
    const h2 = await hashEntries([baseEntry({ effort: [] })]);
    expect(h1).toBe(h2);
  });
});
