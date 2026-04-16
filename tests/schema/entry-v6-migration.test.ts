import { describe, it, expect } from 'vitest';
import { validateEntries } from '@/schema/validators';

const baseEntry = {
  id: '2026-04-14-sprosty-aaaaaa',
  project: 'sprosty',
  date: '2026-04-14',
  hours_hundredths: 400,
  rate_cents: 12500,
  rate_source: 'global_default' as const,
  billable_status: 'billable' as const,
  bucket_id: null,
  description: 'entry',
  review_flag: false,
  created_at: '2026-04-14T10:00:00Z',
  updated_at: '2026-04-14T10:00:00Z',
};

describe('Entry v1-v6 acceptance + lift to v6', () => {
  it('accepts a v1 file (no effort fields) and sets effort: []', () => {
    const file = { schema_version: 1, month: '2026-03', entries: [{ ...baseEntry }] };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries[0]?.effort).toEqual([]);
      expect('effort_kind' in r.value.entries[0]!).toBe(false);
      expect('effort_count' in r.value.entries[0]!).toBe(false);
    }
  });

  it('accepts a v5 file with effort_kind + effort_count null and produces effort: []', () => {
    const file = {
      schema_version: 5,
      month: '2026-04',
      entries: [{ ...baseEntry, effort_kind: null, effort_count: null }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.entries[0]?.effort).toEqual([]);
  });

  it('lifts a v5 non-null pair into a single-item effort array', () => {
    const file = {
      schema_version: 5,
      month: '2026-04',
      entries: [{ ...baseEntry, effort_kind: 'meeting', effort_count: 3 }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries[0]?.effort).toEqual([{ kind: 'meeting', count: 3 }]);
      expect('effort_kind' in r.value.entries[0]!).toBe(false);
    }
  });

  it('treats an asymmetric v5 pair as effort: [] (defensive)', () => {
    const file = {
      schema_version: 5,
      month: '2026-04',
      entries: [{ ...baseEntry, effort_kind: 'meeting', effort_count: null }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.entries[0]?.effort).toEqual([]);
  });

  it('accepts a v6 file with effort array', () => {
    const file = {
      schema_version: 6,
      month: '2026-04',
      entries: [{
        ...baseEntry,
        effort: [{ kind: 'meeting', count: 2 }, { kind: 'slack', count: 1 }],
      }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries[0]?.effort).toEqual([
        { kind: 'meeting', count: 2 },
        { kind: 'slack', count: 1 },
      ]);
    }
  });

  it('collapses duplicate kinds in an on-disk v6 effort array (self-heal)', () => {
    const file = {
      schema_version: 6,
      month: '2026-04',
      entries: [{
        ...baseEntry,
        effort: [
          { kind: 'meeting', count: 1 },
          { kind: 'meeting', count: 2 },
          { kind: 'slack', count: 1 },
        ],
      }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries[0]?.effort).toEqual([
        { kind: 'meeting', count: 3 },
        { kind: 'slack', count: 1 },
      ]);
    }
  });

  it('sorts effort array by kind alphabetically for determinism', () => {
    const file = {
      schema_version: 6,
      month: '2026-04',
      entries: [{
        ...baseEntry,
        effort: [{ kind: 'slack', count: 1 }, { kind: 'meeting', count: 2 }],
      }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries[0]?.effort.map((x) => x.kind)).toEqual(['meeting', 'slack']);
    }
  });

  it('rejects an effort item with count > 100', () => {
    const file = {
      schema_version: 6,
      month: '2026-04',
      entries: [{
        ...baseEntry,
        effort: [{ kind: 'meeting', count: 101 }],
      }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(false);
  });

  it('rejects an effort item with unknown kind', () => {
    const file = {
      schema_version: 6,
      month: '2026-04',
      entries: [{
        ...baseEntry,
        effort: [{ kind: 'not_a_kind', count: 1 }],
      }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(false);
  });

  it('does not mutate caller input', () => {
    const input = {
      schema_version: 5,
      month: '2026-04',
      entries: [{ ...baseEntry, effort_kind: 'meeting', effort_count: 2 }],
    };
    const snapshot = JSON.parse(JSON.stringify(input));
    validateEntries(input);
    expect(input).toEqual(snapshot);
    expect('effort_kind' in input.entries[0]!).toBe(true);
  });

  it('rejects schema_version 7 (upper bound)', () => {
    const file = {
      schema_version: 7,
      month: '2026-04',
      entries: [],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(false);
  });
});
