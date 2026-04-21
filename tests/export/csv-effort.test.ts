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
  effort: [],
  ...overrides,
});

describe('entriesToCSV effort column', () => {
  it('appends a single effort column to the header', () => {
    const csv = entriesToCSV([mk()]);
    const header = csv.split('\n')[0]!;
    expect(header.endsWith(',effort')).toBe(true);
  });

  it('renders empty effort as a trailing empty column', () => {
    const csv = entriesToCSV([mk()]);
    const row = csv.split('\n')[1]!;
    expect(row.endsWith(',')).toBe(true);
  });

  it('renders multi-kind effort as sorted kind:count;kind:count', () => {
    const csv = entriesToCSV([
      mk({
        effort: [
          { kind: 'slack', count: 1 },
          { kind: 'meeting', count: 2 },
        ],
      }),
    ]);
    const row = csv.split('\n')[1]!;
    expect(row.endsWith(',meeting:2;slack:1')).toBe(true);
  });

  it('renders single-kind effort as kind:count', () => {
    const csv = entriesToCSV([mk({ effort: [{ kind: 'slack', count: 3 }] })]);
    const row = csv.split('\n')[1]!;
    expect(row.endsWith(',slack:3')).toBe(true);
  });
});
