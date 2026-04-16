import { describe, it, expect } from 'vitest';
import { computeMonthEffort } from '@/calc/effort';
import { categoryOf, ALL_EFFORT_KINDS, ALL_EFFORT_CATEGORIES } from '@/calc/effort-categories';
import type { Entry, EffortKind } from '@/schema/types';

const base = {
  project: 'sprosty',
  rate_cents: 12500,
  rate_source: 'global_default' as const,
  billable_status: 'billable' as const,
  bucket_id: null,
  description: 'x',
  review_flag: false,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
  source_ref: null,
};

function entry(
  date: string,
  hours: number,
  kind: EffortKind | null,
  count: number | null,
  project = 'sprosty',
): Entry {
  return {
    ...base,
    project,
    id: `${date}-${project}-aaaa${String(count ?? 0).padStart(2, '0')}`,
    date,
    hours_hundredths: hours,
    effort: kind !== null && count !== null ? [{ kind, count }] : [],
  };
}

function entryWithEffort(
  date: string,
  hours: number,
  effort: Array<{ kind: EffortKind; count: number }>,
  project = 'sprosty',
): Entry {
  return {
    ...base,
    project,
    id: `${date}-${project}-aaaaff`,
    date,
    hours_hundredths: hours,
    effort,
  };
}

describe('computeMonthEffort', () => {
  it('returns zero totals for an empty month', () => {
    const r = computeMonthEffort({ entries: [] }, '2026-04');
    expect(r.total_activities).toBe(0);
    expect(r.per_project).toEqual([]);
  });

  it('ignores entries with empty effort arrays (pure-hours entries)', () => {
    const r = computeMonthEffort(
      { entries: [entry('2026-04-05', 200, null, null)] },
      '2026-04',
    );
    expect(r.total_activities).toBe(0);
  });

  it('counts multiple kinds from one entry into by_kind independently', () => {
    const r = computeMonthEffort(
      {
        entries: [
          entryWithEffort('2026-04-05', 250, [
            { kind: 'meeting', count: 2 },
            { kind: 'slack', count: 1 },
          ]),
        ],
      },
      '2026-04',
    );
    expect(r.by_kind.meeting).toBe(2);
    expect(r.by_kind.slack).toBe(1);
    expect(r.total_activities).toBe(3);
  });

  it('ignores entries outside the target month', () => {
    const r = computeMonthEffort(
      { entries: [entry('2026-03-30', 100, 'slack', 1)] },
      '2026-04',
    );
    expect(r.total_activities).toBe(0);
  });

  it('sums by kind, category, and project', () => {
    const r = computeMonthEffort(
      {
        entries: [
          entry('2026-04-02', 200, 'workshop', 1),
          entry('2026-04-03', 50, 'email', 3),
          entry('2026-04-04', 50, 'email', 5, 'acme'),
          entry('2026-04-05', 10, 'slack', 2),
        ],
      },
      '2026-04',
    );
    expect(r.total_activities).toBe(1 + 3 + 5 + 2);
    expect(r.by_kind.workshop).toBe(1);
    expect(r.by_kind.email).toBe(8);
    expect(r.by_kind.slack).toBe(2);
    expect(r.by_category.client_sync).toBe(1);
    expect(r.by_category.client_async).toBe(10);

    const sprosty = r.per_project.find((p) => p.project === 'sprosty');
    expect(sprosty?.total_activities).toBe(6);
    const acme = r.per_project.find((p) => p.project === 'acme');
    expect(acme?.total_activities).toBe(5);
  });

  it('per_project is sorted by project id', () => {
    const r = computeMonthEffort(
      {
        entries: [
          entry('2026-04-05', 50, 'slack', 1, 'zulu'),
          entry('2026-04-05', 50, 'slack', 1, 'acme'),
          entry('2026-04-05', 50, 'slack', 1, 'mike'),
        ],
      },
      '2026-04',
    );
    expect(r.per_project.map((p) => p.project)).toEqual(['acme', 'mike', 'zulu']);
  });
});

describe('categoryOf', () => {
  const table: Array<[EffortKind, string]> = [
    ['workshop', 'client_sync'],
    ['meeting', 'client_sync'],
    ['client_training', 'client_sync'],
    ['config_work', 'technical'],
    ['build', 'technical'],
    ['integration', 'technical'],
    ['data_work', 'technical'],
    ['reporting', 'technical'],
    ['qa', 'technical'],
    ['slack', 'client_async'],
    ['email', 'client_async'],
    ['async_video', 'client_async'],
    ['ticket', 'client_async'],
    ['internal_sync', 'internal'],
    ['documentation', 'internal'],
    ['peer_review', 'internal'],
    ['learning', 'enablement'],
    ['scoping', 'enablement'],
    ['other', 'enablement'],
  ];
  for (const [k, c] of table) {
    it(`maps ${k} → ${c}`, () => {
      expect(categoryOf(k)).toBe(c);
    });
  }

  it('ALL_EFFORT_KINDS has 19 entries matching the EffortKind union', () => {
    expect(ALL_EFFORT_KINDS).toHaveLength(19);
    // Ensure every category mapping targets a valid EffortCategory.
    for (const k of ALL_EFFORT_KINDS) {
      expect(ALL_EFFORT_CATEGORIES).toContain(categoryOf(k));
    }
  });
});
