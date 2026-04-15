import type { Entry, EffortKind, EffortCategory } from '@/schema/types';
import { categoryOf, emptyByKind, emptyByCategory } from './effort-categories';

export type PerProjectEffort = {
  project: string;
  total_activities: number;
  by_kind: Record<EffortKind, number>;
};

export type MonthEffortTotals = {
  month: string;
  total_activities: number;
  by_kind: Record<EffortKind, number>;
  by_category: Record<EffortCategory, number>;
  per_project: PerProjectEffort[];
};

/**
 * Aggregate effort counts from a month's entries. Pure; mirrors the
 * month-scoping semantics of computeMonthTotals.
 *
 * - Entries outside the target month are ignored.
 * - Entries with effort_kind === null are ignored (pure-hours entries).
 * - per_project is sorted by project id for deterministic output.
 */
export function computeMonthEffort(
  args: { entries: Entry[] },
  month: string,
): MonthEffortTotals {
  const by_kind = emptyByKind();
  const by_category = emptyByCategory();
  const perProject = new Map<
    string,
    { total: number; by_kind: Record<EffortKind, number> }
  >();
  let total = 0;

  for (const e of args.entries) {
    if (!e.date.startsWith(month)) continue;
    if (e.effort_kind === null || e.effort_count === null) continue;
    total += e.effort_count;
    by_kind[e.effort_kind] += e.effort_count;
    by_category[categoryOf(e.effort_kind)] += e.effort_count;

    let p = perProject.get(e.project);
    if (p === undefined) {
      p = { total: 0, by_kind: emptyByKind() };
      perProject.set(e.project, p);
    }
    p.total += e.effort_count;
    p.by_kind[e.effort_kind] += e.effort_count;
  }

  const per_project: PerProjectEffort[] = Array.from(perProject.entries())
    .map(([project, { total: t, by_kind: k }]) => ({
      project,
      total_activities: t,
      by_kind: k,
    }))
    .sort((a, b) => a.project.localeCompare(b.project));

  return { month, total_activities: total, by_kind, by_category, per_project };
}
