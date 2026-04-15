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

describe('Entry v1/v2/v3 acceptance + backfill', () => {
  it('accepts a v1 file (no source fields) and backfills source_ref: null', () => {
    const file = { schema_version: 1, month: '2026-03', entries: [{ ...baseEntry }] };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.entries[0]?.source_ref).toBe(null);
  });

  it('accepts a v2 file with source_event_id: null and lifts to source_ref: null', () => {
    const file = {
      schema_version: 2,
      month: '2026-04',
      entries: [{ ...baseEntry, source_event_id: null }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.entries[0]?.source_ref).toBe(null);
  });

  it('accepts a v2 file with source_event_id string and lifts to calendar source_ref', () => {
    const file = {
      schema_version: 2,
      month: '2026-04',
      entries: [{ ...baseEntry, source_event_id: 'gcal-abc' }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries[0]?.source_ref).toEqual({ kind: 'calendar', id: 'gcal-abc' });
    }
  });

  it('accepts a v3 file with source_ref: null', () => {
    const file = {
      schema_version: 3,
      month: '2026-05',
      entries: [{ ...baseEntry, source_ref: null }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
  });

  it('accepts a v3 file with calendar source_ref', () => {
    const file = {
      schema_version: 3,
      month: '2026-05',
      entries: [{ ...baseEntry, source_ref: { kind: 'calendar', id: 'gcal-xyz' } }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
  });

  it('accepts a v3 file with timer source_ref', () => {
    const file = {
      schema_version: 3,
      month: '2026-05',
      entries: [{ ...baseEntry, source_ref: { kind: 'timer', id: 'sess-123' } }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
  });

  it('rejects a v3 file with unknown source_ref kind', () => {
    const file = {
      schema_version: 3,
      month: '2026-05',
      entries: [{ ...baseEntry, source_ref: { kind: 'outlook', id: 'whatever' } }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(false);
  });

  it('rejects a v3 file with source_ref missing id', () => {
    const file = {
      schema_version: 3,
      month: '2026-05',
      entries: [{ ...baseEntry, source_ref: { kind: 'timer' } }],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(false);
  });

  it('self-heals a v3 file with BOTH source_event_id and source_ref by stripping the legacy field', () => {
    // This pattern is produced by a pre-fix broken writer. The validator
    // strips source_event_id in memory and accepts; next write lands a clean
    // file via the fixed upgradeEntriesFileToV3.
    const file = {
      schema_version: 3,
      month: '2026-05',
      entries: [
        {
          ...baseEntry,
          source_ref: { kind: 'calendar', id: 'a' },
          source_event_id: 'a',
        },
      ],
    };
    const r = validateEntries(file);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries[0]?.source_ref).toEqual({ kind: 'calendar', id: 'a' });
      expect('source_event_id' in r.value.entries[0]!).toBe(false);
    }
  });

  it('self-heals entries with BOTH source_event_id and source_ref at any schema_version', () => {
    // Self-heal applies regardless of schema_version so already-corrupted
    // files at any version load cleanly.
    for (const schema_version of [1, 2, 3] as const) {
      const file = {
        schema_version,
        month: '2026-05',
        entries: [
          {
            ...baseEntry,
            source_event_id: 'a',
            source_ref: { kind: 'calendar', id: 'a' },
          },
        ],
      };
      const r = validateEntries(file);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect('source_event_id' in r.value.entries[0]!).toBe(false);
      }
    }
  });

  it('does not mutate the caller\'s input object', () => {
    const v2Input = {
      schema_version: 2,
      month: '2026-04',
      entries: [{ ...baseEntry, source_event_id: 'gcal-abc' }],
    };
    const snapshot = JSON.parse(JSON.stringify(v2Input));
    const r = validateEntries(v2Input);
    expect(r.ok).toBe(true);
    // Caller's original object should be byte-identical to its pre-validate
    // snapshot — no keys added, no keys removed.
    expect(v2Input).toEqual(snapshot);
    // And specifically: the legacy field must still be present on the input.
    expect('source_event_id' in v2Input.entries[0]!).toBe(true);
  });
});
