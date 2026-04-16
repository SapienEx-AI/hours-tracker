import { describe, it, expect } from 'vitest';
import { upgradeEntriesFileToV5 } from '@/data/entries-repo';
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

describe('upgradeEntriesFileToV5 legacy-version acceptance', () => {
  it('upgrades a v1 file with null source_ref / effort fields', () => {
    const v1: EntriesFile = {
      schema_version: 1,
      month: '2026-03',
      entries: [
        {
          ...baseEntry,
          source_ref: null,
          effort_kind: null,
          effort_count: null,
        },
      ],
    };
    const up = upgradeEntriesFileToV5(v1);
    expect(up.schema_version).toBe(5);
    expect(up.entries[0]?.effort_kind).toBeNull();
    expect(up.entries[0]?.effort_count).toBeNull();
    expect(validateEntries(up).ok).toBe(true);
  });

  it('upgrades a v3 file preserving source_ref', () => {
    const v3: EntriesFile = {
      schema_version: 3,
      month: '2026-04',
      entries: [
        {
          ...baseEntry,
          source_ref: { kind: 'calendar', id: 'gcal-1' },
          effort_kind: null,
          effort_count: null,
        },
      ],
    };
    const up = upgradeEntriesFileToV5(v3);
    expect(up.schema_version).toBe(5);
    expect(up.entries[0]?.source_ref).toEqual({ kind: 'calendar', id: 'gcal-1' });
  });

  it('upgrades a v4 file preserving effort fields', () => {
    const v4: EntriesFile = {
      schema_version: 4,
      month: '2026-05',
      entries: [
        {
          ...baseEntry,
          source_ref: null,
          effort_kind: 'workshop',
          effort_count: 1,
        },
      ],
    };
    const up = upgradeEntriesFileToV5(v4);
    expect(up.schema_version).toBe(5);
    expect(up.entries[0]?.effort_kind).toBe('workshop');
    expect(up.entries[0]?.effort_count).toBe(1);
  });

  it('no-ops a v5 file', () => {
    const v5: EntriesFile = {
      schema_version: 5,
      month: '2026-05',
      entries: [
        {
          ...baseEntry,
          source_ref: { kind: 'slack', id: 'daily:2026-04-14:client:T012AB:sprosty' },
          effort_kind: 'slack',
          effort_count: 12,
        },
      ],
    };
    const up = upgradeEntriesFileToV5(v5);
    expect(up.schema_version).toBe(5);
    expect(up.entries[0]?.source_ref).toEqual({
      kind: 'slack',
      id: 'daily:2026-04-14:client:T012AB:sprosty',
    });
  });

  it('backfills null effort fields on a legacy entry missing them', () => {
    const legacy: EntriesFile = {
      schema_version: 3,
      month: '2026-04',
      entries: [
        {
          ...baseEntry,
          source_ref: null,
        } as unknown as EntriesFile['entries'][number],
      ],
    };
    const up = upgradeEntriesFileToV5(legacy);
    expect(up.entries[0]?.effort_kind).toBeNull();
    expect(up.entries[0]?.effort_count).toBeNull();
  });
});
