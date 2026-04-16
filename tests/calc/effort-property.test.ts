import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeMonthEffort } from '@/calc/effort';
import { ALL_EFFORT_KINDS } from '@/calc/effort-categories';
import type { Entry, EffortKind, EffortItem } from '@/schema/types';

const kindArb: fc.Arbitrary<EffortKind> = fc.constantFrom(...ALL_EFFORT_KINDS);

const effortArb: fc.Arbitrary<EffortItem[]> = fc
  .array(fc.record({ kind: kindArb, count: fc.integer({ min: 1, max: 100 }) }), {
    maxLength: 5,
  })
  .map((items) => {
    // Mirror the validator's normalizer: collapse duplicates by kind, sort by kind.
    const byKind = new Map<EffortKind, number>();
    for (const it of items) {
      byKind.set(it.kind, (byKind.get(it.kind) ?? 0) + it.count);
    }
    return [...byKind.entries()]
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => a.kind.localeCompare(b.kind));
  });

/**
 * Entry arbitrary with unique-kind effort array. Mirrors the validator's
 * normalization so the calc sees realistic inputs.
 */
const entryArb = (month: string): fc.Arbitrary<Entry> =>
  fc.record({
    id: fc
      .hexaString({ minLength: 6, maxLength: 6 })
      .map((u) => `${month}-01-sprosty-${u}`),
    project: fc.constantFrom('sprosty', 'acme', 'globex'),
    date: fc.constant(`${month}-15`),
    hours_hundredths: fc.integer({ min: 1, max: 2400 }),
    rate_cents: fc.constant(12500),
    rate_source: fc.constant<Entry['rate_source']>('global_default'),
    billable_status: fc.constant<Entry['billable_status']>('billable'),
    bucket_id: fc.constant<string | null>(null),
    description: fc.string({ minLength: 1, maxLength: 50 }),
    review_flag: fc.boolean(),
    created_at: fc.constant('2026-04-01T00:00:00Z'),
    updated_at: fc.constant('2026-04-01T00:00:00Z'),
    source_ref: fc.constant<Entry['source_ref']>(null),
    effort: effortArb,
  });

describe('Effort invariants', () => {
  it('Conservation: sum(by_category) === total_activities', () => {
    fc.assert(
      fc.property(
        fc.array(entryArb('2026-04'), { minLength: 0, maxLength: 50 }),
        (entries) => {
          const r = computeMonthEffort({ entries }, '2026-04');
          const sumCat = Object.values(r.by_category).reduce((a, b) => a + b, 0);
          expect(sumCat).toBe(r.total_activities);
        },
      ),
    );
  });

  it('Additivity: sum(per_project.total_activities) === total_activities', () => {
    fc.assert(
      fc.property(
        fc.array(entryArb('2026-04'), { minLength: 0, maxLength: 50 }),
        (entries) => {
          const r = computeMonthEffort({ entries }, '2026-04');
          const sumPP = r.per_project.reduce((a, p) => a + p.total_activities, 0);
          expect(sumPP).toBe(r.total_activities);
        },
      ),
    );
  });

  it('Month scoping: entries outside target month contribute zero', () => {
    fc.assert(
      fc.property(
        fc.array(entryArb('2026-03'), { minLength: 1, maxLength: 20 }),
        (entries) => {
          const r = computeMonthEffort({ entries }, '2026-04');
          expect(r.total_activities).toBe(0);
        },
      ),
    );
  });

  it('Sum(by_kind) === total_activities', () => {
    fc.assert(
      fc.property(
        fc.array(entryArb('2026-04'), { minLength: 0, maxLength: 50 }),
        (entries) => {
          const r = computeMonthEffort({ entries }, '2026-04');
          const sumKind = Object.values(r.by_kind).reduce((a, b) => a + b, 0);
          expect(sumKind).toBe(r.total_activities);
        },
      ),
    );
  });
});
