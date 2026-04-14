import { describe, it, expect } from 'vitest';
import { validateEntries } from '@/schema/validators';

describe('Entry v1 → v2 migration', () => {
  it('accepts a v1 file without source_event_id and backfills null', () => {
    const v1File = {
      schema_version: 1,
      month: '2026-03',
      entries: [
        {
          id: '2026-03-25-sprosty-aaaaaa',
          project: 'sprosty',
          date: '2026-03-25',
          hours_hundredths: 400,
          rate_cents: 12500,
          rate_source: 'global_default',
          billable_status: 'billable',
          bucket_id: null,
          description: 'v1 entry',
          review_flag: false,
          created_at: '2026-03-25T10:00:00Z',
          updated_at: '2026-03-25T10:00:00Z',
        },
      ],
    };
    const r = validateEntries(v1File);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries[0]?.source_event_id).toBe(null);
    }
  });

  it('accepts a v2 file with an explicit source_event_id', () => {
    const v2File = {
      schema_version: 2,
      month: '2026-04',
      entries: [
        {
          id: '2026-04-14-sprosty-bbbbbb',
          project: 'sprosty',
          date: '2026-04-14',
          hours_hundredths: 75,
          rate_cents: 12500,
          rate_source: 'global_default',
          billable_status: 'billable',
          bucket_id: null,
          description: 'HS review',
          review_flag: false,
          created_at: '2026-04-14T10:00:00Z',
          updated_at: '2026-04-14T10:00:00Z',
          source_event_id: 'abc123xyz',
        },
      ],
    };
    const r = validateEntries(v2File);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries[0]?.source_event_id).toBe('abc123xyz');
    }
  });

  it('rejects a v2 file with wrong-typed source_event_id (number instead of string|null)', () => {
    const bad = {
      schema_version: 2,
      month: '2026-04',
      entries: [
        {
          id: '2026-04-14-sprosty-cccccc',
          project: 'sprosty',
          date: '2026-04-14',
          hours_hundredths: 75,
          rate_cents: 12500,
          rate_source: 'global_default',
          billable_status: 'billable',
          bucket_id: null,
          description: 'bad type',
          review_flag: false,
          created_at: '2026-04-14T10:00:00Z',
          updated_at: '2026-04-14T10:00:00Z',
          source_event_id: 42,
        },
      ],
    };
    const r = validateEntries(bad);
    expect(r.ok).toBe(false);
  });
});
