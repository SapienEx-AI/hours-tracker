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

describe('Entry v1/v2/v3/v4 acceptance + effort backfill', () => {
  it('accepts a v1 file and backfills effort_kind/count to null', () => {
    const file = { schema_version: 1, month: '2026-03', entries: [{ ...baseEntry }] };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries[0]?.effort_kind).toBeNull();
      expect(r.value.entries[0]?.effort_count).toBeNull();
    }
  });

  it('accepts a v2 file and backfills effort fields to null', () => {
    const file = {
      schema_version: 2,
      month: '2026-04',
      entries: [{ ...baseEntry, source_event_id: 'g1' }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.entries[0]?.effort_kind).toBeNull();
  });

  it('accepts a v3 file and backfills effort fields to null', () => {
    const file = {
      schema_version: 3,
      month: '2026-04',
      entries: [{ ...baseEntry, source_ref: null }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries[0]?.effort_kind).toBeNull();
      expect(r.value.entries[0]?.effort_count).toBeNull();
    }
  });

  it('accepts a v4 file with effort_kind/count both set', () => {
    const file = {
      schema_version: 4,
      month: '2026-04',
      entries: [
        { ...baseEntry, source_ref: null, effort_kind: 'workshop', effort_count: 1 },
      ],
    };
    expect(validateEntries(file).ok).toBe(true);
  });

  it('accepts a v4 file with effort_kind/count both null', () => {
    const file = {
      schema_version: 4,
      month: '2026-04',
      entries: [
        { ...baseEntry, source_ref: null, effort_kind: null, effort_count: null },
      ],
    };
    expect(validateEntries(file).ok).toBe(true);
  });

  it('rejects v4 with effort_kind set but effort_count null', () => {
    const file = {
      schema_version: 4,
      month: '2026-04',
      entries: [
        { ...baseEntry, source_ref: null, effort_kind: 'slack', effort_count: null },
      ],
    };
    expect(validateEntries(file).ok).toBe(false);
  });

  it('rejects v4 with effort_count set but effort_kind null', () => {
    const file = {
      schema_version: 4,
      month: '2026-04',
      entries: [
        { ...baseEntry, source_ref: null, effort_kind: null, effort_count: 3 },
      ],
    };
    expect(validateEntries(file).ok).toBe(false);
  });

  it('rejects v4 with invalid effort_kind value', () => {
    const file = {
      schema_version: 4,
      month: '2026-04',
      entries: [
        { ...baseEntry, source_ref: null, effort_kind: 'unknown', effort_count: 1 },
      ],
    };
    expect(validateEntries(file).ok).toBe(false);
  });

  it('rejects v4 with effort_count out of range', () => {
    for (const c of [0, 101, -1]) {
      const file = {
        schema_version: 4,
        month: '2026-04',
        entries: [
          { ...baseEntry, source_ref: null, effort_kind: 'slack', effort_count: c },
        ],
      };
      expect(validateEntries(file).ok).toBe(false);
    }
  });

  it("does not mutate the caller's input", () => {
    const input = {
      schema_version: 2,
      month: '2026-04',
      entries: [{ ...baseEntry, source_event_id: 'g1' }],
    };
    const snap = JSON.parse(JSON.stringify(input));
    validateEntries(input);
    expect(input).toEqual(snap);
  });
});
