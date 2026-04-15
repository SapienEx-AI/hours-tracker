import { describe, it, expect } from 'vitest';
import { canonicalizeEntriesForHashing } from '@/calc/hash';
import type { Entry } from '@/schema/types';

const base: Omit<Entry, 'source_ref' | 'effort_kind' | 'effort_count'> & {
  effort_kind: null;
  effort_count: null;
} = {
  effort_kind: null,
  effort_count: null,
  id: '2026-04-14-sprosty-aaaaaa',
  project: 'sprosty',
  date: '2026-04-14',
  hours_hundredths: 400,
  rate_cents: 12500,
  rate_source: 'global_default',
  billable_status: 'billable',
  bucket_id: null,
  description: 'entry',
  review_flag: false,
  created_at: '2026-04-14T10:00:00Z',
  updated_at: '2026-04-14T10:00:00Z',
};

describe('Hash canonicalization across v2 → v3 boundary', () => {
  it('null source_ref hashes identically to a v2 entry with source_event_id null', () => {
    const v3: Entry = { ...base, source_ref: null };
    const canonical = canonicalizeEntriesForHashing([v3]);
    expect(canonical).not.toContain('source_event_id');
    expect(canonical).not.toContain('source_ref');
    expect(canonical).not.toContain('source_timer_id');
  });

  it('calendar source_ref hashes identically to v2 source_event_id', () => {
    const v3Calendar: Entry = {
      ...base,
      source_ref: { kind: 'calendar', id: 'gcal-abc' },
    };
    const canonical = canonicalizeEntriesForHashing([v3Calendar]);
    expect(canonical).toContain('"source_event_id":"gcal-abc"');
    expect(canonical).not.toContain('source_ref');
    expect(canonical).not.toContain('source_timer_id');
  });

  it('timer source_ref emits source_timer_id (new canonical field)', () => {
    const v3Timer: Entry = {
      ...base,
      source_ref: { kind: 'timer', id: 'sess-xyz' },
    };
    const canonical = canonicalizeEntriesForHashing([v3Timer]);
    expect(canonical).toContain('"source_timer_id":"sess-xyz"');
    expect(canonical).not.toContain('source_event_id');
    expect(canonical).not.toContain('source_ref');
  });

  it('key order is deterministic across source kinds', () => {
    const e1: Entry = { ...base, id: '2026-04-14-sprosty-aaaaa1', source_ref: null };
    const e2: Entry = {
      ...base,
      id: '2026-04-14-sprosty-aaaaa2',
      source_ref: { kind: 'calendar', id: 'gcal-x' },
    };
    const e3: Entry = {
      ...base,
      id: '2026-04-14-sprosty-aaaaa3',
      source_ref: { kind: 'timer', id: 'sess-y' },
    };
    const canonical = canonicalizeEntriesForHashing([e3, e1, e2]);
    expect(canonical.indexOf('aaaaa1')).toBeLessThan(canonical.indexOf('aaaaa2'));
    expect(canonical.indexOf('aaaaa2')).toBeLessThan(canonical.indexOf('aaaaa3'));
  });
});
