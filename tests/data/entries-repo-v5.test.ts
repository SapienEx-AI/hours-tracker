import { describe, it, expect } from 'vitest';
import { upgradeEntriesFileToV5 } from '@/data/entries-repo';
import type { EntriesFile } from '@/schema/types';

describe('upgradeEntriesFileToV5', () => {
  it('promotes a v4 file to v5 with identity entries', () => {
    const v4: EntriesFile = {
      schema_version: 4,
      month: '2026-04',
      entries: [
        {
          id: '2026-04-01-acme-aaa111',
          project: 'acme',
          date: '2026-04-01',
          hours_hundredths: 100,
          rate_cents: 10000,
          rate_source: 'project_default',
          billable_status: 'billable',
          bucket_id: null,
          description: 'x',
          review_flag: false,
          created_at: '2026-04-01T12:00:00Z',
          updated_at: '2026-04-01T12:00:00Z',
          source_ref: null,
          effort_kind: null,
          effort_count: null,
        },
      ],
    };
    const v5 = upgradeEntriesFileToV5(v4);
    expect(v5.schema_version).toBe(5);
    expect(v5.entries[0]?.id).toBe(v4.entries[0]?.id);
  });

  it('is idempotent on a v5 file', () => {
    const v5: EntriesFile = {
      schema_version: 5,
      month: '2026-04',
      entries: [],
    };
    const result = upgradeEntriesFileToV5(v5);
    expect(result.schema_version).toBe(5);
    expect(result).toEqual(v5);
  });

  it('promotes v1 via the full chain', () => {
    const v1 = {
      schema_version: 1 as const,
      month: '2026-04',
      entries: [],
    };
    const v5 = upgradeEntriesFileToV5(v1 as unknown as EntriesFile);
    expect(v5.schema_version).toBe(5);
  });
});
