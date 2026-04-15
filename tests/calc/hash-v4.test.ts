import { describe, it, expect } from 'vitest';
import { canonicalizeEntriesForHashing } from '@/calc/hash';
import type { Entry } from '@/schema/types';

const base: Omit<Entry, 'source_ref' | 'effort_kind' | 'effort_count'> = {
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

describe('Hash canonicalization v3 → v4 invariance', () => {
  it('null effort fields omitted; same hash as a v3-shape entry', () => {
    const v4: Entry = {
      ...base,
      source_ref: null,
      effort_kind: null,
      effort_count: null,
    };
    const c = canonicalizeEntriesForHashing([v4]);
    expect(c).not.toContain('effort_kind');
    expect(c).not.toContain('effort_count');
    expect(c).not.toContain('source_ref');
  });

  it('calendar source_ref still projects to source_event_id (v2 invariance)', () => {
    const v4: Entry = {
      ...base,
      source_ref: { kind: 'calendar', id: 'gcal-x' },
      effort_kind: null,
      effort_count: null,
    };
    const c = canonicalizeEntriesForHashing([v4]);
    expect(c).toContain('"source_event_id":"gcal-x"');
  });

  it('non-null effort fields included in canonical form', () => {
    const v4: Entry = {
      ...base,
      source_ref: null,
      effort_kind: 'slack',
      effort_count: 3,
    };
    const c = canonicalizeEntriesForHashing([v4]);
    expect(c).toContain('"effort_kind":"slack"');
    expect(c).toContain('"effort_count":3');
  });

  it('changing effort_count produces a different canonical form', () => {
    const a: Entry = {
      ...base,
      source_ref: null,
      effort_kind: 'slack',
      effort_count: 1,
    };
    const b: Entry = {
      ...base,
      source_ref: null,
      effort_kind: 'slack',
      effort_count: 2,
    };
    expect(canonicalizeEntriesForHashing([a])).not.toBe(
      canonicalizeEntriesForHashing([b]),
    );
  });

  it('changing effort_kind produces a different canonical form', () => {
    const a: Entry = {
      ...base,
      source_ref: null,
      effort_kind: 'slack',
      effort_count: 1,
    };
    const b: Entry = {
      ...base,
      source_ref: null,
      effort_kind: 'email',
      effort_count: 1,
    };
    expect(canonicalizeEntriesForHashing([a])).not.toBe(
      canonicalizeEntriesForHashing([b]),
    );
  });
});
