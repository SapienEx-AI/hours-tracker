import { describe, it, expect } from 'vitest';
import { entriesToCSV } from '@/export/csv';
import type { Entry } from '@/schema/types';

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: '2026-03-25-sprosty-a3f9c1',
    project: 'sprosty',
    date: '2026-03-25',
    hours_hundredths: 400,
    rate_cents: 2000,
    rate_source: 'global_default',
    billable_status: 'billable',
    bucket_id: null,
    description: 'did a thing',
    review_flag: false,
    created_at: '2026-03-25T10:00:00Z',
    updated_at: '2026-03-25T10:00:00Z',
    source_ref: null,
    ...overrides,
  };
}

describe('entriesToCSV', () => {
  it('emits a header row and one row per entry', () => {
    const csv = entriesToCSV([makeEntry()]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'id,date,project,bucket,hours,rate,billable_status,description,review_flag,rate_source',
    );
    expect(lines[1]).toBe(
      '2026-03-25-sprosty-a3f9c1,2026-03-25,sprosty,,4.00,20.00,billable,did a thing,false,global_default',
    );
  });

  it('quotes fields containing commas, quotes, or newlines and doubles embedded quotes', () => {
    const csv = entriesToCSV([
      makeEntry({ description: 'he said "hi", then left\nnext line' }),
    ]);
    expect(csv).toContain('"he said ""hi"", then left\nnext line"');
  });

  it('prefixes a leading =, +, -, or @ with a single quote to defeat formula injection', () => {
    const csv = entriesToCSV([makeEntry({ description: '=SUM(A1:A10)' })]);
    expect(csv).toContain(",'=SUM(A1:A10),");
  });

  it('serializes bucket_id null as empty string and review_flag as "true"/"false"', () => {
    const csv = entriesToCSV([
      makeEntry({ bucket_id: 'sprosty-skyvia-dev', review_flag: true }),
    ]);
    expect(csv.split('\n')[1]).toContain('sprosty-skyvia-dev');
    expect(csv.split('\n')[1]).toContain('true');
  });

  it('formats hours as HH.HH and rate as D.DD using integer math', () => {
    const csv = entriesToCSV([
      makeEntry({ hours_hundredths: 1234, rate_cents: 12500 }),
    ]);
    const row = csv.split('\n')[1] ?? '';
    expect(row).toContain('12.34,125.00');
  });
});
