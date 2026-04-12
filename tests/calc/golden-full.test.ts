import { describe, it, expect } from 'vitest';
import { computeMonthTotals } from '@/calc';
import type { EntriesFile } from '@/schema/types';
import golden from '../fixtures/2026-03-golden.json';
import expected from '../fixtures/2026-03-expected.json';
import { MARCH_PROJECTS, MARCH_RATES } from '../../scripts/compute-march-totals';

type ProjectExpected = {
  billable_hours_hundredths?: number;
  billable_amount_cents?: number;
  non_billable_hours_hundredths?: number;
  needs_review_hours_hundredths?: number;
};

describe('March 2026 full golden regression', () => {
  const entries = (golden as EntriesFile).entries;
  const result = computeMonthTotals(
    { entries, projects: MARCH_PROJECTS, rates: MARCH_RATES },
    '2026-03',
  );

  it('fixture contains the expected number of entries (102)', () => {
    expect(entries).toHaveLength(102);
  });

  it('top-level totals match the hand-verified expected values', () => {
    expect(result.total_hours_hundredths).toBe(expected.total_hours_hundredths);
    expect(result.billable_hours_hundredths).toBe(expected.billable_hours_hundredths);
    expect(result.non_billable_hours_hundredths).toBe(expected.non_billable_hours_hundredths);
    expect(result.needs_review_hours_hundredths).toBe(expected.needs_review_hours_hundredths);
    expect(result.billable_amount_cents).toBe(expected.billable_amount_cents);
  });

  it('per-project totals match the hand-verified expected values', () => {
    const expectedProjects = expected.per_project as Record<string, ProjectExpected>;
    for (const [projectId, exp] of Object.entries(expectedProjects)) {
      const actual = result.per_project.find((p) => p.project === projectId);
      expect(actual, `missing project "${projectId}" in computed result`).toBeDefined();
      if (!actual) continue;

      if (exp.billable_hours_hundredths !== undefined) {
        expect(actual.billable_hours_hundredths, `${projectId}.billable_hours`).toBe(
          exp.billable_hours_hundredths,
        );
      }
      if (exp.billable_amount_cents !== undefined) {
        expect(actual.billable_amount_cents, `${projectId}.billable_amount`).toBe(
          exp.billable_amount_cents,
        );
      }
      if (exp.non_billable_hours_hundredths !== undefined) {
        expect(actual.non_billable_hours_hundredths, `${projectId}.non_billable`).toBe(
          exp.non_billable_hours_hundredths,
        );
      }
      if (exp.needs_review_hours_hundredths !== undefined) {
        expect(actual.needs_review_hours_hundredths, `${projectId}.needs_review`).toBe(
          exp.needs_review_hours_hundredths,
        );
      }
    }
  });

  it('conservation invariant holds on the full March fixture', () => {
    expect(
      result.billable_hours_hundredths +
        result.non_billable_hours_hundredths +
        result.needs_review_hours_hundredths,
    ).toBe(result.total_hours_hundredths);
  });

  it('sprosty breakdown confirms $20 rate override applied to 9h of Skyvia work', () => {
    // 9h × $20 = $180 + 8.25h × $125 = $1031.25, total = $1211.25 = 121125 cents.
    const sprosty = result.per_project.find((p) => p.project === 'sprosty');
    expect(sprosty?.billable_hours_hundredths).toBe(1725);
    expect(sprosty?.billable_amount_cents).toBe(121125);
  });
});
