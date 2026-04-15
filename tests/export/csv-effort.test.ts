import { describe, it, expect } from 'vitest';
import { entriesToCSV } from '@/export/csv';
import type { Entry } from '@/schema/types';

const mk = (overrides: Partial<Entry> = {}): Entry => ({
  id: '2026-04-14-sprosty-aaaaaa',
  project: 'sprosty',
  date: '2026-04-14',
  hours_hundredths: 100,
  rate_cents: 12500,
  rate_source: 'global_default',
  billable_status: 'billable',
  bucket_id: null,
  description: 'x',
  review_flag: false,
  created_at: '2026-04-14T10:00:00Z',
  updated_at: '2026-04-14T10:00:00Z',
  source_ref: null,
  effort_kind: null,
  effort_count: null,
  ...overrides,
});

describe('entriesToCSV effort columns', () => {
  it('appends effort_kind and effort_count to the header in that order', () => {
    const csv = entriesToCSV([mk()]);
    const header = csv.split('\n')[0]!;
    expect(header.endsWith('effort_kind,effort_count')).toBe(true);
  });

  it('renders null effort_kind and null effort_count as trailing empty columns', () => {
    const csv = entriesToCSV([mk()]);
    const row = csv.split('\n')[1]!;
    expect(row.endsWith(',,')).toBe(true);
  });

  it('renders non-null effort_kind and effort_count in the last two columns', () => {
    const csv = entriesToCSV([mk({ effort_kind: 'slack', effort_count: 3 })]);
    const row = csv.split('\n')[1]!;
    expect(row.endsWith(',slack,3')).toBe(true);
  });
});
