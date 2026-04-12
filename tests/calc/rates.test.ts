import { describe, it, expect } from 'vitest';
import { resolveRateAtLogTime } from '@/calc/rates';
import type { ProjectsConfig, RatesConfig } from '@/schema/types';

const projects: ProjectsConfig = {
  schema_version: 1,
  projects: [
    {
      id: 'sprosty',
      name: 'Sprosty',
      client: null,
      active: true,
      is_internal: false,
      default_rate_cents: 12500,
      buckets: [
        {
          id: 'sprosty-skyvia-dev',
          type: 'dev',
          name: 'Skyvia Dev',
          budgeted_hours_hundredths: 2000,
          rate_cents: 2000,
          status: 'active',
          opened_at: '2026-03-25',
          closed_at: null,
          notes: '',
        },
      ],
    },
    {
      id: 'bayard',
      name: 'Bayard',
      client: null,
      active: true,
      is_internal: false,
      default_rate_cents: null,
      buckets: [],
    },
  ],
};

const rates: RatesConfig = {
  schema_version: 1,
  default_rate_history: [
    { effective_from: '2026-01-01', rate_cents: 10000 },
    { effective_from: '2026-04-11', rate_cents: 12500 },
  ],
};

describe('resolveRateAtLogTime', () => {
  it('returns the bucket rate when bucket_id is provided and bucket has a rate override', () => {
    const result = resolveRateAtLogTime({
      project_id: 'sprosty',
      bucket_id: 'sprosty-skyvia-dev',
      date: '2026-04-11',
      projects,
      rates,
    });
    expect(result).toEqual({ rate_cents: 2000, source: 'entry_override' });
  });

  it('returns the project default when bucket_id is null and project has a default', () => {
    const result = resolveRateAtLogTime({
      project_id: 'sprosty',
      bucket_id: null,
      date: '2026-04-11',
      projects,
      rates,
    });
    expect(result).toEqual({ rate_cents: 12500, source: 'project_default' });
  });

  it('returns the global default when project has no default_rate_cents', () => {
    const result = resolveRateAtLogTime({
      project_id: 'bayard',
      bucket_id: null,
      date: '2026-04-11',
      projects,
      rates,
    });
    expect(result).toEqual({ rate_cents: 12500, source: 'global_default' });
  });

  it('returns the historical global rate when entry date predates the current rate', () => {
    const result = resolveRateAtLogTime({
      project_id: 'bayard',
      bucket_id: null,
      date: '2026-02-15',
      projects,
      rates,
    });
    expect(result).toEqual({ rate_cents: 10000, source: 'global_default' });
  });

  it('throws when the project is not found', () => {
    expect(() =>
      resolveRateAtLogTime({
        project_id: 'nonexistent',
        bucket_id: null,
        date: '2026-04-11',
        projects,
        rates,
      }),
    ).toThrow();
  });

  it('throws when the bucket is not found in the named project', () => {
    expect(() =>
      resolveRateAtLogTime({
        project_id: 'sprosty',
        bucket_id: 'nonexistent-bucket',
        date: '2026-04-11',
        projects,
        rates,
      }),
    ).toThrow();
  });

  it('throws when the date predates every entry in rate history', () => {
    expect(() =>
      resolveRateAtLogTime({
        project_id: 'bayard',
        bucket_id: null,
        date: '2025-12-31',
        projects,
        rates,
      }),
    ).toThrow();
  });

  it('falls back to project default when bucket has rate_cents=null (inherit)', () => {
    const projectsInherit: ProjectsConfig = {
      schema_version: 1,
      projects: [
        {
          id: 'sprosty',
          name: 'Sprosty',
          client: null,
          active: true,
          is_internal: false,
          default_rate_cents: 12500,
          buckets: [
            {
              id: 'sprosty-block',
              type: 'hour_block',
              name: 'Block',
              budgeted_hours_hundredths: 1000,
              rate_cents: null,
              status: 'active',
              opened_at: '2026-04-01',
              closed_at: null,
              notes: '',
            },
          ],
        },
      ],
    };
    const result = resolveRateAtLogTime({
      project_id: 'sprosty',
      bucket_id: 'sprosty-block',
      date: '2026-04-11',
      projects: projectsInherit,
      rates,
    });
    expect(result).toEqual({ rate_cents: 12500, source: 'project_default' });
  });
});
