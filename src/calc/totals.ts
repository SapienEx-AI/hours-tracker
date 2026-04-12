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

type Running = {
  billable_hours: number;
  non_billable_hours: number;
  needs_review_hours: number;
  billable_amount: number;
};

type ProjectRunning = {
  billable_hours: number;
  billable_amount: number;
  non_billable_hours: number;
  needs_review_hours: number;
  buckets: Map<string, number>;
  bucket_amounts: Map<string, number>;
};

function emptyProjectRunning(): ProjectRunning {
  return {
    billable_hours: 0,
    billable_amount: 0,
    non_billable_hours: 0,
    needs_review_hours: 0,
    buckets: new Map(),
    bucket_amounts: new Map(),
  };
}

function handleBillable(running: Running, project: ProjectRunning, e: Entry): void {
  const amount = mulCentsByHundredths(e.rate_cents, e.hours_hundredths);
  running.billable_hours = addHundredths(running.billable_hours, e.hours_hundredths);
  running.billable_amount = addCents(running.billable_amount, amount);
  project.billable_hours = addHundredths(project.billable_hours, e.hours_hundredths);
  project.billable_amount = addCents(project.billable_amount, amount);
  if (e.bucket_id !== null) {
    const prevHours = project.buckets.get(e.bucket_id) ?? 0;
    const prevAmount = project.bucket_amounts.get(e.bucket_id) ?? 0;
    project.buckets.set(e.bucket_id, addHundredths(prevHours, e.hours_hundredths));
    project.bucket_amounts.set(e.bucket_id, addCents(prevAmount, amount));
  }
}

function applyEntry(running: Running, byProject: Map<string, ProjectRunning>, e: Entry): void {
  let project = byProject.get(e.project);
  if (!project) {
    project = emptyProjectRunning();
    byProject.set(e.project, project);
  }
  switch (e.billable_status) {
    case 'billable':
      handleBillable(running, project, e);
      return;
    case 'non_billable':
      running.non_billable_hours = addHundredths(running.non_billable_hours, e.hours_hundredths);
      project.non_billable_hours = addHundredths(
        project.non_billable_hours,
        e.hours_hundredths,
      );
      return;
    case 'needs_review':
      running.needs_review_hours = addHundredths(running.needs_review_hours, e.hours_hundredths);
      project.needs_review_hours = addHundredths(
        project.needs_review_hours,
        e.hours_hundredths,
      );
      return;
  }
}

function buildBucketList(
  projectId: string,
  data: ProjectRunning,
  projects: ProjectsConfig,
): BucketConsumption[] {
  const projectDef = projects.projects.find((p) => p.id === projectId);
  const byBucket: BucketConsumption[] = [];
  for (const [bucketId, consumed] of data.buckets.entries()) {
    const bucketDef = projectDef?.buckets.find((b) => b.id === bucketId);
    byBucket.push({
      bucket_id: bucketId,
      consumed_hours_hundredths: consumed,
      budgeted_hours_hundredths: bucketDef?.budgeted_hours_hundredths ?? 0,
      amount_cents: data.bucket_amounts.get(bucketId) ?? 0,
    });
  }
  return byBucket;
}

function buildPerProject(
  byProject: Map<string, ProjectRunning>,
  projects: ProjectsConfig,
): ProjectTotals[] {
  const result: ProjectTotals[] = [];
  for (const [projectId, data] of byProject.entries()) {
    result.push({
      project: projectId,
      billable_hours_hundredths: data.billable_hours,
      billable_amount_cents: data.billable_amount,
      non_billable_hours_hundredths: data.non_billable_hours,
      needs_review_hours_hundredths: data.needs_review_hours,
      by_bucket: buildBucketList(projectId, data, projects),
    });
  }
  return result;
}

/**
 * Compute the full monthly totals for a given `month` (YYYY-MM).
 *
 * Entries are filtered by date prefix — dates outside the month are excluded.
 * Rate on each entry is used as-is (snapshotted at log time; spec §3 row 4).
 * The `rates` config is unused by the compute itself and included in the
 * input shape only so property tests can verify rate snapshot immutability.
 */
export function computeMonthTotals(input: CalcInput, month: string): MonthTotals {
  const scoped = input.entries.filter((e) => e.date.startsWith(month));
  const running: Running = {
    billable_hours: 0,
    non_billable_hours: 0,
    needs_review_hours: 0,
    billable_amount: 0,
  };
  const byProject = new Map<string, ProjectRunning>();

  for (const e of scoped) applyEntry(running, byProject, e);

  const per_project = buildPerProject(byProject, input.projects);
  const totalHours = sumHundredths([
    running.billable_hours,
    running.non_billable_hours,
    running.needs_review_hours,
  ]);

  // Redundant cross-check: sum per_project breakdown and verify it equals
  // the top-level billable amount. This is spec §7.2 layer 5 applied in
  // calc itself (cheap, deterministic).
  const crossCheckBillable = sumCents(per_project.map((p) => p.billable_amount_cents));
  if (crossCheckBillable !== running.billable_amount) {
    throw new Error(
      `computeMonthTotals invariant violation: per-project billable (${crossCheckBillable}) !== top-level billable (${running.billable_amount})`,
    );
  }

  return {
    month,
    total_hours_hundredths: totalHours,
    billable_hours_hundredths: running.billable_hours,
    non_billable_hours_hundredths: running.non_billable_hours,
    needs_review_hours_hundredths: running.needs_review_hours,
    billable_amount_cents: running.billable_amount,
    per_project,
  };
}

/**
 * Compute all-time bucket consumption across ALL entries (every month).
 * Returns a map from bucket_id → { consumed_hours_hundredths, amount_cents }.
 *
 * Used by Dashboard and Projects screen to show lifetime bucket health
 * (buckets span multiple months; spec §3 decision 7).
 */
export function computeAllTimeBucketConsumption(
  allEntries: readonly Entry[],
): Map<string, { consumed_hours_hundredths: number; amount_cents: number }> {
  const result = new Map<string, { consumed_hours_hundredths: number; amount_cents: number }>();

  for (const e of allEntries) {
    if (e.bucket_id === null) continue;
    if (e.billable_status !== 'billable') continue;

    const existing = result.get(e.bucket_id);
    const amount = mulCentsByHundredths(e.rate_cents, e.hours_hundredths);
    if (existing) {
      existing.consumed_hours_hundredths = addHundredths(
        existing.consumed_hours_hundredths,
        e.hours_hundredths,
      );
      existing.amount_cents = addCents(existing.amount_cents, amount);
    } else {
      result.set(e.bucket_id, {
        consumed_hours_hundredths: e.hours_hundredths,
        amount_cents: amount,
      });
    }
  }

  return result;
}
