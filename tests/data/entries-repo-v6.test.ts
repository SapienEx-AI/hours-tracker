import { describe, it, expect } from 'vitest';
import { upgradeEntriesFileToV6 } from '@/data/entries-repo';
import type { EntriesFile, Entry } from '@/schema/types';

function baseEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: '2026-04-14-sprosty-aaaaaa',
    project: 'sprosty',
    date: '2026-04-14',
    hours_hundredths: 400,
    rate_cents: 12500,
    rate_source: 'global_default',
    billable_status: 'billable',
    bucket_id: null,
    description: 'v6 entry',
    review_flag: false,
    created_at: '2026-04-14T10:00:00Z',
    updated_at: '2026-04-14T10:00:00Z',
    source_ref: null,
    effort: [],
    ...overrides,
  };
}

describe('upgradeEntriesFileToV6', () => {
  it('bumps schema_version to 6 on a v4 input and defaults effort: []', () => {
    const v4: EntriesFile = {
      schema_version: 4,
      month: '2026-03',
      entries: [baseEntry({ id: '2026-03-01-sprosty-aaaaaa' })],
    };
    const upgraded = upgradeEntriesFileToV6(v4);
    expect(upgraded.schema_version).toBe(6);
    expect(upgraded.entries[0]?.effort).toEqual([]);
  });

  it('lifts v5 effort_kind+count into the effort array and strips legacy fields', () => {
    const v5 = {
      schema_version: 5,
      month: '2026-04',
      entries: [
        {
          ...baseEntry(),
          effort_kind: 'meeting',
          effort_count: 2,
        },
      ],
    } as unknown as EntriesFile;
    const upgraded = upgradeEntriesFileToV6(v5);
    expect(upgraded.schema_version).toBe(6);
    expect(upgraded.entries[0]?.effort).toEqual([{ kind: 'meeting', count: 2 }]);
    expect('effort_kind' in upgraded.entries[0]!).toBe(false);
    expect('effort_count' in upgraded.entries[0]!).toBe(false);
  });

  it('sorts a v6 non-empty effort array by kind (determinism)', () => {
    const v6: EntriesFile = {
      schema_version: 6,
      month: '2026-04',
      entries: [baseEntry({
        effort: [{ kind: 'slack', count: 1 }, { kind: 'meeting', count: 2 }],
      })],
    };
    const upgraded = upgradeEntriesFileToV6(v6);
    expect(upgraded.entries[0]?.effort).toEqual([
      { kind: 'meeting', count: 2 },
      { kind: 'slack', count: 1 },
    ]);
  });

  it('collapses duplicate kinds in already-v6 input (belt-and-suspenders)', () => {
    const v6: EntriesFile = {
      schema_version: 6,
      month: '2026-04',
      entries: [baseEntry({
        effort: [
          { kind: 'meeting', count: 1 },
          { kind: 'meeting', count: 3 },
          { kind: 'slack', count: 2 },
        ],
      })],
    };
    const upgraded = upgradeEntriesFileToV6(v6);
    expect(upgraded.entries[0]?.effort).toEqual([
      { kind: 'meeting', count: 4 },
      { kind: 'slack', count: 2 },
    ]);
  });

  it('keeps effort: [] when v5 has null/null pair', () => {
    const v5 = {
      schema_version: 5,
      month: '2026-04',
      entries: [{ ...baseEntry(), effort_kind: null, effort_count: null }],
    } as unknown as EntriesFile;
    const upgraded = upgradeEntriesFileToV6(v5);
    expect(upgraded.entries[0]?.effort).toEqual([]);
  });
});
