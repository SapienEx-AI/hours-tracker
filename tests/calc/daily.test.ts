import { describe, it, expect } from 'vitest';
import {
  computeMonthDaily,
  computeProjectBuildsForMonth,
} from '@/calc/daily';
import type { Entry, ProjectsConfig, RatesConfig } from '@/schema/types';

const projects: ProjectsConfig = {
  schema_version: 1,
  projects: [
    {
      id: 'sprosty', name: 'Sprosty', client: null, active: true,
      is_internal: false, default_rate_cents: null,
      buckets: [
        { id: 'sprosty-skyvia-dev', type: 'dev', name: 'Skyvia Dev',
          budgeted_hours_hundredths: 2000, rate_cents: 12500, status: 'active',
          opened_at: '2026-03-01', closed_at: null, notes: '' },
        { id: 'sprosty-hours', type: 'hour_block', name: 'Monthly Hours',
          budgeted_hours_hundredths: 1000, rate_cents: 12500, status: 'active',
          opened_at: '2026-03-01', closed_at: null, notes: '' },
      ],
    },
    {
      id: 'internal', name: 'Internal', client: null, active: true,
      is_internal: true, default_rate_cents: 0,
      buckets: [],
    },
  ],
};

const rates: RatesConfig = {
  schema_version: 1,
  default_rate_history: [{ effective_from: '2026-01-01', rate_cents: 12500 }],
};

function entry(p: Partial<Entry> & {
  id: string; date: string; hours_hundredths: number;
  billable_status: Entry['billable_status']; rate_cents: number;
}): Entry {
  return {
    project: 'sprosty',
    bucket_id: null,
    description: 'x',
    review_flag: false,
    rate_source: 'global_default',
    created_at: '2026-04-14T00:00:00Z',
    updated_at: '2026-04-14T00:00:00Z',
    source_ref: null,
    effort: [],
    ...p,
  };
}

describe('computeMonthDaily', () => {
  it('returns empty days and max=0 for a month with no entries', () => {
    const r = computeMonthDaily({ entries: [], projects, rates }, '2026-04');
    expect(r).toEqual({ month: '2026-04', days: [], max_hours_hundredths: 0 });
  });

  it('buckets a single entry by date with billable amount', () => {
    const e = entry({
      id: '2026-04-14-sprosty-aaaaaa', date: '2026-04-14',
      hours_hundredths: 400, rate_cents: 12500, billable_status: 'billable',
    });
    const r = computeMonthDaily({ entries: [e], projects, rates }, '2026-04');
    expect(r.days).toHaveLength(1);
    expect(r.days[0]).toEqual({
      date: '2026-04-14',
      total_hundredths: 400,
      billable_hundredths: 400,
      non_billable_hundredths: 0,
      needs_review_hundredths: 0,
      billable_amount_cents: 50000,
      entry_count: 1,
    });
    expect(r.max_hours_hundredths).toBe(400);
  });

  it('sums multiple entries on the same day and categorizes by status', () => {
    const entries = [
      entry({ id: '2026-04-14-sprosty-a', date: '2026-04-14', hours_hundredths: 200, rate_cents: 12500, billable_status: 'billable' }),
      entry({ id: '2026-04-14-sprosty-b', date: '2026-04-14', hours_hundredths: 100, rate_cents: 0, billable_status: 'non_billable' }),
      entry({ id: '2026-04-14-sprosty-c', date: '2026-04-14', hours_hundredths: 50, rate_cents: 12500, billable_status: 'needs_review' }),
    ];
    const r = computeMonthDaily({ entries, projects, rates }, '2026-04');
    expect(r.days).toHaveLength(1);
    expect(r.days[0]).toEqual({
      date: '2026-04-14',
      total_hundredths: 350,
      billable_hundredths: 200,
      non_billable_hundredths: 100,
      needs_review_hundredths: 50,
      billable_amount_cents: 25000,
      entry_count: 3,
    });
  });

  it('excludes entries outside the target month', () => {
    const entries = [
      entry({ id: '2026-04-01-sprosty-a', date: '2026-04-01', hours_hundredths: 100, rate_cents: 12500, billable_status: 'billable' }),
      entry({ id: '2026-03-30-sprosty-b', date: '2026-03-30', hours_hundredths: 999, rate_cents: 12500, billable_status: 'billable' }),
      entry({ id: '2026-05-02-sprosty-c', date: '2026-05-02', hours_hundredths: 888, rate_cents: 12500, billable_status: 'billable' }),
    ];
    const r = computeMonthDaily({ entries, projects, rates }, '2026-04');
    expect(r.days).toHaveLength(1);
    expect(r.days[0]?.date).toBe('2026-04-01');
  });

  it('sorts days ascending by date and computes max across varied days', () => {
    const entries = [
      entry({ id: '2026-04-20-sprosty-a', date: '2026-04-20', hours_hundredths: 200, rate_cents: 12500, billable_status: 'billable' }),
      entry({ id: '2026-04-05-sprosty-b', date: '2026-04-05', hours_hundredths: 700, rate_cents: 12500, billable_status: 'billable' }),
      entry({ id: '2026-04-15-sprosty-c', date: '2026-04-15', hours_hundredths: 400, rate_cents: 12500, billable_status: 'billable' }),
    ];
    const r = computeMonthDaily({ entries, projects, rates }, '2026-04');
    expect(r.days.map((d) => d.date)).toEqual(['2026-04-05', '2026-04-15', '2026-04-20']);
    expect(r.max_hours_hundredths).toBe(700);
  });
});

describe('computeProjectBuildsForMonth', () => {
  it('returns empty list for a month with no entries', () => {
    const r = computeProjectBuildsForMonth({ entries: [], projects, rates }, '2026-04');
    expect(r).toEqual([]);
  });

  it('excludes unbucketed entries', () => {
    const e = entry({
      id: '2026-04-14-sprosty-aaaaaa', date: '2026-04-14',
      hours_hundredths: 400, rate_cents: 12500, billable_status: 'billable',
      bucket_id: null,
    });
    const r = computeProjectBuildsForMonth({ entries: [e], projects, rates }, '2026-04');
    expect(r).toEqual([]);
  });

  it('excludes hour_block buckets (monthly-invoice stream)', () => {
    const e = entry({
      id: '2026-04-14-sprosty-aaaaaa', date: '2026-04-14',
      hours_hundredths: 400, rate_cents: 12500, billable_status: 'billable',
      bucket_id: 'sprosty-hours',
    });
    const r = computeProjectBuildsForMonth({ entries: [e], projects, rates }, '2026-04');
    expect(r).toEqual([]);
  });

  it('excludes non-billable bucketed entries even on builds-stream buckets', () => {
    const e = entry({
      id: '2026-04-14-sprosty-aaaaaa', date: '2026-04-14',
      hours_hundredths: 400, rate_cents: 12500, billable_status: 'non_billable',
      bucket_id: 'sprosty-skyvia-dev',
    });
    const r = computeProjectBuildsForMonth({ entries: [e], projects, rates }, '2026-04');
    expect(r).toEqual([]);
  });

  it('groups billable entries on builds-stream buckets by bucket_id', () => {
    const entries = [
      entry({ id: '2026-04-14-sprosty-a', date: '2026-04-14', hours_hundredths: 400, rate_cents: 12500, billable_status: 'billable', bucket_id: 'sprosty-skyvia-dev' }),
      entry({ id: '2026-04-20-sprosty-b', date: '2026-04-20', hours_hundredths: 200, rate_cents: 12500, billable_status: 'billable', bucket_id: 'sprosty-skyvia-dev' }),
    ];
    const r = computeProjectBuildsForMonth({ entries, projects, rates }, '2026-04');
    expect(r).toEqual([
      {
        project_id: 'sprosty',
        bucket_id: 'sprosty-skyvia-dev',
        hours_hundredths: 600,
        amount_cents: 75000,
      },
    ]);
  });

  it('sorts rows by project_id asc then bucket_id asc', () => {
    const entriesProjects: ProjectsConfig = {
      schema_version: 1,
      projects: [
        {
          id: 'bayard', name: 'Bayard', client: null, active: true, is_internal: false, default_rate_cents: null,
          buckets: [
            { id: 'bayard-alpha', type: 'dev', name: 'Alpha', budgeted_hours_hundredths: 1000, rate_cents: 12500, status: 'active', opened_at: '2026-03-01', closed_at: null, notes: '' },
          ],
        },
        {
          id: 'sprosty', name: 'Sprosty', client: null, active: true, is_internal: false, default_rate_cents: null,
          buckets: [
            { id: 'sprosty-alpha', type: 'dev', name: 'Alpha', budgeted_hours_hundredths: 1000, rate_cents: 12500, status: 'active', opened_at: '2026-03-01', closed_at: null, notes: '' },
            { id: 'sprosty-beta', type: 'dev', name: 'Beta', budgeted_hours_hundredths: 1000, rate_cents: 12500, status: 'active', opened_at: '2026-03-01', closed_at: null, notes: '' },
          ],
        },
      ],
    };
    const entries = [
      entry({ id: '2026-04-01-sprosty-b', date: '2026-04-01', hours_hundredths: 100, rate_cents: 12500, billable_status: 'billable', project: 'sprosty', bucket_id: 'sprosty-beta' }),
      entry({ id: '2026-04-02-sprosty-a', date: '2026-04-02', hours_hundredths: 100, rate_cents: 12500, billable_status: 'billable', project: 'sprosty', bucket_id: 'sprosty-alpha' }),
      entry({ id: '2026-04-03-bayard-a', date: '2026-04-03', hours_hundredths: 100, rate_cents: 12500, billable_status: 'billable', project: 'bayard', bucket_id: 'bayard-alpha' }),
    ];
    const r = computeProjectBuildsForMonth({ entries, projects: entriesProjects, rates }, '2026-04');
    expect(r.map((x) => `${x.project_id}/${x.bucket_id}`)).toEqual([
      'bayard/bayard-alpha',
      'sprosty/sprosty-alpha',
      'sprosty/sprosty-beta',
    ]);
  });
});
