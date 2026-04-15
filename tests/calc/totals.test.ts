import { describe, it, expect } from 'vitest';
import { computeMonthTotals } from '@/calc/totals';
import type { Entry, ProjectsConfig, RatesConfig } from '@/schema/types';

const projects: ProjectsConfig = {
  schema_version: 1,
  projects: [
    {
      id: 'sprosty',
      name: 'Sprosty',
      client: null,
      active: true,
      is_internal: false,
      default_rate_cents: null,
      buckets: [
        {
          id: 'sprosty-skyvia-dev',
          type: 'dev',
          name: 'Skyvia Dev',
          budgeted_hours_hundredths: 2000,
          rate_cents: 2000,
          status: 'active',
          opened_at: '2026-03-01',
          closed_at: null,
          notes: '',
        },
      ],
    },
    {
      id: 'internal',
      name: 'Internal',
      client: null,
      active: true,
      is_internal: true,
      default_rate_cents: null,
      buckets: [],
    },
  ],
};

const rates: RatesConfig = {
  schema_version: 1,
  default_rate_history: [{ effective_from: '2026-01-01', rate_cents: 12500 }],
};

function entry(
  partial: Partial<Entry> & {
    id: string;
    project: string;
    date: string;
    hours_hundredths: number;
    rate_cents: number;
    billable_status: Entry['billable_status'];
  },
): Entry {
  return {
    rate_source: 'global_default',
    bucket_id: null,
    description: 'x',
    review_flag: false,
    created_at: '2026-03-25T00:00:00Z',
    updated_at: '2026-03-25T00:00:00Z',
    source_ref: null,
    effort_kind: null,
    effort_count: null,
    ...partial,
  };
}

describe('computeMonthTotals', () => {
  it('returns zero totals for a month with no entries', () => {
    const result = computeMonthTotals({ entries: [], projects, rates }, '2026-03');
    expect(result).toEqual({
      month: '2026-03',
      total_hours_hundredths: 0,
      billable_hours_hundredths: 0,
      non_billable_hours_hundredths: 0,
      needs_review_hours_hundredths: 0,
      billable_amount_cents: 0,
      per_project: [],
    });
  });

  it('sums a single billable entry into billable + total and computes the amount', () => {
    const entries: Entry[] = [
      entry({
        id: '2026-03-25-sprosty-aaaaaa',
        project: 'sprosty',
        date: '2026-03-25',
        hours_hundredths: 400,
        rate_cents: 12500,
        billable_status: 'billable',
      }),
    ];
    const result = computeMonthTotals({ entries, projects, rates }, '2026-03');
    expect(result.total_hours_hundredths).toBe(400);
    expect(result.billable_hours_hundredths).toBe(400);
    expect(result.non_billable_hours_hundredths).toBe(0);
    expect(result.needs_review_hours_hundredths).toBe(0);
    expect(result.billable_amount_cents).toBe(50000); // $500
  });

  it('segregates non_billable and needs_review hours out of billable total', () => {
    const entries: Entry[] = [
      entry({
        id: '2026-03-01-internal-aaaaaa',
        project: 'internal',
        date: '2026-03-01',
        hours_hundredths: 100,
        rate_cents: 0,
        billable_status: 'non_billable',
      }),
      entry({
        id: '2026-03-02-sprosty-bbbbbb',
        project: 'sprosty',
        date: '2026-03-02',
        hours_hundredths: 200,
        rate_cents: 12500,
        billable_status: 'needs_review',
      }),
      entry({
        id: '2026-03-03-sprosty-cccccc',
        project: 'sprosty',
        date: '2026-03-03',
        hours_hundredths: 400,
        rate_cents: 12500,
        billable_status: 'billable',
      }),
    ];
    const result = computeMonthTotals({ entries, projects, rates }, '2026-03');
    expect(result.total_hours_hundredths).toBe(700);
    expect(result.billable_hours_hundredths).toBe(400);
    expect(result.non_billable_hours_hundredths).toBe(100);
    expect(result.needs_review_hours_hundredths).toBe(200);
    expect(result.billable_amount_cents).toBe(50000);
  });

  it('aggregates per-project breakdown with each project in its own row', () => {
    const entries: Entry[] = [
      entry({
        id: '2026-03-01-sprosty-aaaaaa',
        project: 'sprosty',
        date: '2026-03-01',
        hours_hundredths: 400,
        rate_cents: 12500,
        billable_status: 'billable',
      }),
      entry({
        id: '2026-03-01-internal-bbbbbb',
        project: 'internal',
        date: '2026-03-01',
        hours_hundredths: 100,
        rate_cents: 0,
        billable_status: 'non_billable',
      }),
    ];
    const result = computeMonthTotals({ entries, projects, rates }, '2026-03');
    expect(result.per_project).toHaveLength(2);
    const sprosty = result.per_project.find((p) => p.project === 'sprosty');
    expect(sprosty?.billable_hours_hundredths).toBe(400);
    expect(sprosty?.billable_amount_cents).toBe(50000);
    const internal = result.per_project.find((p) => p.project === 'internal');
    expect(internal?.non_billable_hours_hundredths).toBe(100);
  });

  it('aggregates bucket consumption under per_project.by_bucket', () => {
    const entries: Entry[] = [
      entry({
        id: '2026-03-01-sprosty-aaaaaa',
        project: 'sprosty',
        date: '2026-03-01',
        hours_hundredths: 400,
        rate_cents: 2000,
        bucket_id: 'sprosty-skyvia-dev',
        billable_status: 'billable',
      }),
      entry({
        id: '2026-03-02-sprosty-bbbbbb',
        project: 'sprosty',
        date: '2026-03-02',
        hours_hundredths: 200,
        rate_cents: 2000,
        bucket_id: 'sprosty-skyvia-dev',
        billable_status: 'billable',
      }),
    ];
    const result = computeMonthTotals({ entries, projects, rates }, '2026-03');
    const sprosty = result.per_project.find((p) => p.project === 'sprosty');
    expect(sprosty?.by_bucket).toHaveLength(1);
    expect(sprosty?.by_bucket[0]).toEqual({
      bucket_id: 'sprosty-skyvia-dev',
      consumed_hours_hundredths: 600,
      budgeted_hours_hundredths: 2000,
      amount_cents: 12000, // $20 × 6h = $120
    });
  });

  it('excludes entries that fall outside the requested month', () => {
    const entries: Entry[] = [
      entry({
        id: '2026-02-28-sprosty-aaaaaa',
        project: 'sprosty',
        date: '2026-02-28',
        hours_hundredths: 100,
        rate_cents: 12500,
        billable_status: 'billable',
      }),
      entry({
        id: '2026-03-01-sprosty-bbbbbb',
        project: 'sprosty',
        date: '2026-03-01',
        hours_hundredths: 200,
        rate_cents: 12500,
        billable_status: 'billable',
      }),
      entry({
        id: '2026-04-01-sprosty-cccccc',
        project: 'sprosty',
        date: '2026-04-01',
        hours_hundredths: 300,
        rate_cents: 12500,
        billable_status: 'billable',
      }),
    ];
    const result = computeMonthTotals({ entries, projects, rates }, '2026-03');
    expect(result.total_hours_hundredths).toBe(200);
  });

  it('preserves the conservation invariant (billable + non_billable + needs_review === total)', () => {
    const entries: Entry[] = [
      entry({
        id: '2026-03-01-a-aaaaaa',
        project: 'sprosty',
        date: '2026-03-01',
        hours_hundredths: 100,
        rate_cents: 12500,
        billable_status: 'billable',
      }),
      entry({
        id: '2026-03-02-b-bbbbbb',
        project: 'internal',
        date: '2026-03-02',
        hours_hundredths: 200,
        rate_cents: 0,
        billable_status: 'non_billable',
      }),
      entry({
        id: '2026-03-03-c-cccccc',
        project: 'sprosty',
        date: '2026-03-03',
        hours_hundredths: 300,
        rate_cents: 12500,
        billable_status: 'needs_review',
      }),
    ];
    const r = computeMonthTotals({ entries, projects, rates }, '2026-03');
    expect(
      r.billable_hours_hundredths +
        r.non_billable_hours_hundredths +
        r.needs_review_hours_hundredths,
    ).toBe(r.total_hours_hundredths);
  });
});
