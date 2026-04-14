import { describe, it, expect } from 'vitest';
import { upgradeEntriesFileToV3 } from '@/data/entries-repo';
import { validateEntries } from '@/schema/validators';
import type { EntriesFile } from '@/schema/types';

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

describe('upgradeEntriesFileToV3', () => {
  it('upgrades a v1 file (no source field) to v3 with source_ref: null', () => {
    const v1: EntriesFile = {
      schema_version: 1,
      month: '2026-03',
      entries: [{ ...baseEntry, source_ref: null }],
    };
    const up = upgradeEntriesFileToV3(v1);
    expect(up.schema_version).toBe(3);
    expect(up.entries[0]?.source_ref).toBe(null);
    const v = validateEntries(up);
    expect(v.ok).toBe(true);
  });

  it('upgrades a v2 file with calendar source_ref preserving the ref', () => {
    const v2: EntriesFile = {
      schema_version: 2,
      month: '2026-04',
      entries: [
        { ...baseEntry, source_ref: { kind: 'calendar', id: 'gcal-xyz' } },
      ],
    };
    const up = upgradeEntriesFileToV3(v2);
    expect(up.schema_version).toBe(3);
    expect(up.entries[0]?.source_ref).toEqual({ kind: 'calendar', id: 'gcal-xyz' });
    const v = validateEntries(up);
    expect(v.ok).toBe(true);
  });

  it('no-ops a v3 file', () => {
    const v3: EntriesFile = {
      schema_version: 3,
      month: '2026-05',
      entries: [
        { ...baseEntry, source_ref: { kind: 'timer', id: 'sess-42' } },
      ],
    };
    const up = upgradeEntriesFileToV3(v3);
    expect(up).toEqual(v3);
  });
});
