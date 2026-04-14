import { describe, it, expect } from 'vitest';
import { upgradeEntriesFileToV2 } from '@/data/entries-repo';
import { validateEntries } from '@/schema/validators';
import type { EntriesFile } from '@/schema/types';

describe('upgradeEntriesFileToV2', () => {
  it('leaves a v2 file unchanged (preserves existing source_event_id values)', () => {
    const v2: EntriesFile = {
      schema_version: 2,
      month: '2026-04',
      entries: [
        {
          id: '2026-04-14-sprosty-aaaaaa',
          project: 'sprosty',
          date: '2026-04-14',
          hours_hundredths: 75,
          rate_cents: 12500,
          rate_source: 'global_default',
          billable_status: 'billable',
          bucket_id: null,
          description: 'already v2',
          review_flag: false,
          created_at: '2026-04-14T10:00:00Z',
          updated_at: '2026-04-14T10:00:00Z',
          source_event_id: 'gcal-xyz',
        },
      ],
    };
    const upgraded = upgradeEntriesFileToV2(v2);
    expect(upgraded.schema_version).toBe(2);
    expect(upgraded.entries[0]?.source_event_id).toBe('gcal-xyz');
  });

  it('bumps schema_version and backfills null on a v1 file', () => {
    const v1: EntriesFile = {
      schema_version: 1,
      month: '2026-03',
      entries: [
        {
          id: '2026-03-01-sprosty-aaaaaa',
          project: 'sprosty',
          date: '2026-03-01',
          hours_hundredths: 100,
          rate_cents: 12500,
          rate_source: 'global_default',
          billable_status: 'billable',
          bucket_id: null,
          description: 'v1 entry',
          review_flag: false,
          created_at: '2026-03-01T10:00:00Z',
          updated_at: '2026-03-01T10:00:00Z',
          source_event_id: null,
        },
      ],
    };
    const upgraded = upgradeEntriesFileToV2(v1);
    expect(upgraded.schema_version).toBe(2);
    expect(upgraded.entries[0]?.source_event_id).toBe(null);
    const ajv = validateEntries(upgraded);
    expect(ajv.ok).toBe(true);
  });
});
