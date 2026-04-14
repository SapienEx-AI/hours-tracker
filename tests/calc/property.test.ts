import { describe, it } from 'vitest';
import fc from 'fast-check';
import {
  computeMonthTotals,
  computeMonthDaily,
  computeProjectBuildsForMonth,
  hashEntries,
  splitBillingStreams,
  sumHundredths,
  sumCents,
} from '@/calc';
import type { Entry, ProjectsConfig, RatesConfig } from '@/schema/types';

// ─── Arbitraries ───

const billableArb: fc.Arbitrary<Entry['billable_status']> = fc.constantFrom(
  'billable',
  'non_billable',
  'needs_review',
);

// Rates snapped to multiples of 100 cents ($1 increments) so that any
// hours_hundredths value produces an exact integer amount via the
// mulCentsByHundredths invariant (product must be divisible by 100).
const rateArb = fc.integer({ min: 100, max: 50000 }).map((n) => n - (n % 100));

const entryArb = (month: string): fc.Arbitrary<Entry> =>
  fc.record({
    id: fc
      .hexaString({ minLength: 6, maxLength: 6 })
      .map((u) => `${month}-01-sprosty-${u}`),
    project: fc.constantFrom('sprosty', 'internal'),
    date: fc.constant(`${month}-15`),
    hours_hundredths: fc.integer({ min: 1, max: 2400 }),
    rate_cents: rateArb,
    rate_source: fc.constant<Entry['rate_source']>('global_default'),
    billable_status: billableArb,
    bucket_id: fc.oneof(
      fc.constant<string | null>(null),
      fc.constant<string | null>('sprosty-skyvia-dev'),
      fc.constant<string | null>('sprosty-hours'),
    ),
    description: fc.string({ minLength: 1, maxLength: 100 }),
    review_flag: fc.boolean(),
    created_at: fc.constant('2026-03-01T00:00:00Z'),
    updated_at: fc.constant('2026-03-01T00:00:00Z'),
    source_ref: fc.constant<Entry['source_ref']>(null),
  });

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
          id: 'sprosty-skyvia-dev', type: 'dev', name: 'Skyvia Dev',
          budgeted_hours_hundredths: 2000, rate_cents: 12500, status: 'active',
          opened_at: '2026-03-01', closed_at: null, notes: '',
        },
        {
          id: 'sprosty-hours', type: 'hour_block', name: 'Hours Block',
          budgeted_hours_hundredths: 1000, rate_cents: 12500, status: 'active',
          opened_at: '2026-03-01', closed_at: null, notes: '',
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

// ─── Property tests — exact names from spec §7.2 ───

describe('calc invariants (property tests)', () => {
  it('Conservation: billable + non_billable + needs_review === total for any input', () => {
    fc.assert(
      fc.property(fc.array(entryArb('2026-03'), { minLength: 0, maxLength: 50 }), (entries) => {
        const r = computeMonthTotals({ entries, projects, rates }, '2026-03');
        return (
          r.billable_hours_hundredths +
            r.non_billable_hours_hundredths +
            r.needs_review_hours_hundredths ===
          r.total_hours_hundredths
        );
      }),
    );
  });

  it('Additivity: sum(per_project billable_amount) === global billable_amount for any partition', () => {
    fc.assert(
      fc.property(fc.array(entryArb('2026-03'), { minLength: 0, maxLength: 50 }), (entries) => {
        const r = computeMonthTotals({ entries, projects, rates }, '2026-03');
        const sum = r.per_project.reduce((acc, p) => acc + p.billable_amount_cents, 0);
        return sum === r.billable_amount_cents;
      }),
    );
  });

  it('Month-scoping: entries outside the target month do not contribute to totals', () => {
    fc.assert(
      fc.property(fc.array(entryArb('2026-02'), { minLength: 1, maxLength: 10 }), (entries) => {
        const r = computeMonthTotals({ entries, projects, rates }, '2026-03');
        return r.total_hours_hundredths === 0;
      }),
    );
  });

  it('Monotonicity under insertion: adding a billable entry never decreases billable_amount', () => {
    fc.assert(
      fc.property(
        fc.array(entryArb('2026-03'), { minLength: 0, maxLength: 20 }),
        entryArb('2026-03'),
        (entries, extra) => {
          const billableExtra: Entry = { ...extra, billable_status: 'billable' };
          const before = computeMonthTotals({ entries, projects, rates }, '2026-03')
            .billable_amount_cents;
          const after = computeMonthTotals(
            { entries: [...entries, billableExtra], projects, rates },
            '2026-03',
          ).billable_amount_cents;
          return after >= before;
        },
      ),
    );
  });

  it('Hash determinism: hashEntries(X) === hashEntries(X) always', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(entryArb('2026-03'), { minLength: 0, maxLength: 20 }),
        async (entries) => {
          const h1 = await hashEntries(entries);
          const h2 = await hashEntries(entries);
          return h1 === h2;
        },
      ),
    );
  });

  it('Hash array-order invariance: shuffled entry array produces the same hash', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(entryArb('2026-03'), { minLength: 1, maxLength: 20 }),
        async (entries) => {
          const shuffled = [...entries].reverse();
          const h1 = await hashEntries(entries);
          const h2 = await hashEntries(shuffled);
          return h1 === h2;
        },
      ),
    );
  });
});

describe('computeMonthDaily invariants', () => {
  it('Per-day conservation: billable + non_billable + needs_review === total', () => {
    fc.assert(
      fc.property(fc.array(entryArb('2026-03'), { minLength: 0, maxLength: 50 }), (entries) => {
        const r = computeMonthDaily({ entries, projects, rates }, '2026-03');
        for (const d of r.days) {
          if (
            d.billable_hundredths + d.non_billable_hundredths + d.needs_review_hundredths !==
            d.total_hundredths
          ) {
            return false;
          }
        }
        return true;
      }),
    );
  });

  it('Monthly total agreement: sum(days.total) === computeMonthTotals.total_hours_hundredths', () => {
    fc.assert(
      fc.property(fc.array(entryArb('2026-03'), { minLength: 0, maxLength: 50 }), (entries) => {
        const daily = computeMonthDaily({ entries, projects, rates }, '2026-03');
        const totals = computeMonthTotals({ entries, projects, rates }, '2026-03');
        const sum = sumHundredths(daily.days.map((d) => d.total_hundredths));
        return sum === totals.total_hours_hundredths;
      }),
    );
  });

  it('Monthly billable $ agreement: sum(days.billable_amount) === computeMonthTotals.billable_amount_cents', () => {
    fc.assert(
      fc.property(fc.array(entryArb('2026-03'), { minLength: 0, maxLength: 50 }), (entries) => {
        const daily = computeMonthDaily({ entries, projects, rates }, '2026-03');
        const totals = computeMonthTotals({ entries, projects, rates }, '2026-03');
        const sum = sumCents(daily.days.map((d) => d.billable_amount_cents));
        return sum === totals.billable_amount_cents;
      }),
    );
  });
});

describe('computeProjectBuildsForMonth invariants', () => {
  it('Hours agreement with splitBillingStreams.project_builds', () => {
    fc.assert(
      fc.property(fc.array(entryArb('2026-03'), { minLength: 0, maxLength: 50 }), (entries) => {
        const rows = computeProjectBuildsForMonth({ entries, projects, rates }, '2026-03');
        const streams = splitBillingStreams(entries, '2026-03', projects);
        const sum = sumHundredths(rows.map((r) => r.hours_hundredths));
        return sum === streams.project_builds.hours_hundredths;
      }),
    );
  });

  it('Amount agreement with splitBillingStreams.project_builds', () => {
    fc.assert(
      fc.property(fc.array(entryArb('2026-03'), { minLength: 0, maxLength: 50 }), (entries) => {
        const rows = computeProjectBuildsForMonth({ entries, projects, rates }, '2026-03');
        const streams = splitBillingStreams(entries, '2026-03', projects);
        const sum = sumCents(rows.map((r) => r.amount_cents));
        return sum === streams.project_builds.amount_cents;
      }),
    );
  });
});
