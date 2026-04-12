import { describe, it, expect } from 'vitest';
import { computeMonthTotals } from '@/calc';
import golden from '../fixtures/2026-03-mini-golden.json';
import expected from '../fixtures/2026-03-mini-expected.json';
import type { EntriesFile, ProjectsConfig, RatesConfig } from '@/schema/types';

describe('calc golden-mini (March 2026 representative sample)', () => {
  it('computeMonthTotals matches hand-computed expected totals for the mini golden fixture', () => {
    const entries = (golden.entries as EntriesFile).entries;
    const projects = golden.projects as ProjectsConfig;
    const rates = golden.rates as RatesConfig;

    const result = computeMonthTotals({ entries, projects, rates }, '2026-03');

    expect(result.total_hours_hundredths).toBe(expected.total_hours_hundredths);
    expect(result.billable_hours_hundredths).toBe(expected.billable_hours_hundredths);
    expect(result.non_billable_hours_hundredths).toBe(expected.non_billable_hours_hundredths);
    expect(result.needs_review_hours_hundredths).toBe(expected.needs_review_hours_hundredths);
    expect(result.billable_amount_cents).toBe(expected.billable_amount_cents);
  });

  it('per_project totals match expected (mini fixture)', () => {
    const entries = (golden.entries as EntriesFile).entries;
    const projects = golden.projects as ProjectsConfig;
    const rates = golden.rates as RatesConfig;
    const result = computeMonthTotals({ entries, projects, rates }, '2026-03');

    const find = (id: string) => result.per_project.find((p) => p.project === id);
    expect(find('sprosty')?.billable_amount_cents).toBe(
      expected.per_project_summary.sprosty_billable_cents,
    );
    expect(find('bayard')?.billable_amount_cents).toBe(
      expected.per_project_summary.bayard_billable_cents,
    );
    expect(find('truvista')?.billable_amount_cents).toBe(
      expected.per_project_summary.truvista_billable_cents,
    );
    expect(find('internal')?.non_billable_hours_hundredths).toBe(
      expected.per_project_summary.internal_non_billable_hours,
    );
    expect(find('axiom')?.needs_review_hours_hundredths).toBe(
      expected.per_project_summary.axiom_needs_review_hours,
    );
  });
});
