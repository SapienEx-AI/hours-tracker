import type {
  Entry,
  MonthTotals,
  ProjectsConfig,
  ProjectTotals,
  RatesConfig,
  BucketConsumption,
} from '@/schema/types';
import {
  sumCents,
  sumHundredths,
  mulCentsByHundredths,
  addCents,
  addHundredths,
} from './int';

export type CalcInput = {
  entries: readonly Entry[];
  projects: ProjectsConfig;
  rates: RatesConfig;
};

type ProjectBucket = {
  billable_hours: number;
  billable_amount: number;
  non_billable_hours: number;
  needs_review_hours: number;
  buckets: Map<string, number>;
  bucketAmounts: Map<string, number>;
};

/**
 * Compute the full monthly totals for a given `month` (YYYY-MM).
 *
 * Entries are filtered by date prefix — dates outside the month are excluded.
 * Rate on each entry is used as-is (snapshotted at log time; spec §3 row 4).
 * The `rates` config is unused by the compute itself and included in the
 * input shape only so property tests can verify rate snapshot immutability.
 */
export function computeMonthTotals(input: CalcInput, month: string): MonthTotals {
  const { entries, projects } = input;
  const scoped = entries.filter((e) => e.date.startsWith(month));

  let billableHours = 0;
  let nonBillableHours = 0;
  let needsReviewHours = 0;
  let billableAmount = 0;

  const byProjectMap = new Map<string, ProjectBucket>();

  for (const e of scoped) {
    let project = byProjectMap.get(e.project);
    if (!project) {
      project = {
        billable_hours: 0,
        billable_amount: 0,
        non_billable_hours: 0,
        needs_review_hours: 0,
        buckets: new Map(),
        bucketAmounts: new Map(),
      };
      byProjectMap.set(e.project, project);
    }

    switch (e.billable_status) {
      case 'billable': {
        const amount = mulCentsByHundredths(e.rate_cents, e.hours_hundredths);
        billableHours = addHundredths(billableHours, e.hours_hundredths);
        billableAmount = addCents(billableAmount, amount);
        project.billable_hours = addHundredths(project.billable_hours, e.hours_hundredths);
        project.billable_amount = addCents(project.billable_amount, amount);
        if (e.bucket_id !== null) {
          const prevHours = project.buckets.get(e.bucket_id) ?? 0;
          const prevAmount = project.bucketAmounts.get(e.bucket_id) ?? 0;
          project.buckets.set(e.bucket_id, addHundredths(prevHours, e.hours_hundredths));
          project.bucketAmounts.set(e.bucket_id, addCents(prevAmount, amount));
        }
        break;
      }
      case 'non_billable':
        nonBillableHours = addHundredths(nonBillableHours, e.hours_hundredths);
        project.non_billable_hours = addHundredths(
          project.non_billable_hours,
          e.hours_hundredths,
        );
        break;
      case 'needs_review':
        needsReviewHours = addHundredths(needsReviewHours, e.hours_hundredths);
        project.needs_review_hours = addHundredths(
          project.needs_review_hours,
          e.hours_hundredths,
        );
        break;
    }
  }

  const per_project: ProjectTotals[] = [];
  for (const [projectId, data] of byProjectMap.entries()) {
    const projectDef = projects.projects.find((p) => p.id === projectId);
    const byBucket: BucketConsumption[] = [];
    for (const [bucketId, consumed] of data.buckets.entries()) {
      const bucketDef = projectDef?.buckets.find((b) => b.id === bucketId);
      byBucket.push({
        bucket_id: bucketId,
        consumed_hours_hundredths: consumed,
        budgeted_hours_hundredths: bucketDef?.budgeted_hours_hundredths ?? 0,
        amount_cents: data.bucketAmounts.get(bucketId) ?? 0,
      });
    }
    per_project.push({
      project: projectId,
      billable_hours_hundredths: data.billable_hours,
      billable_amount_cents: data.billable_amount,
      non_billable_hours_hundredths: data.non_billable_hours,
      needs_review_hours_hundredths: data.needs_review_hours,
      by_bucket: byBucket,
    });
  }

  const totalHours = sumHundredths([billableHours, nonBillableHours, needsReviewHours]);

  // Redundant cross-check: sum per_project breakdown and verify it equals
  // the top-level billable amount. This is spec §7.2 layer 5 applied in
  // calc itself (cheap, deterministic).
  const crossCheckBillable = sumCents(per_project.map((p) => p.billable_amount_cents));
  if (crossCheckBillable !== billableAmount) {
    throw new Error(
      `computeMonthTotals invariant violation: per-project billable (${crossCheckBillable}) !== top-level billable (${billableAmount})`,
    );
  }

  return {
    month,
    total_hours_hundredths: totalHours,
    billable_hours_hundredths: billableHours,
    non_billable_hours_hundredths: nonBillableHours,
    needs_review_hours_hundredths: needsReviewHours,
    billable_amount_cents: billableAmount,
    per_project,
  };
}
