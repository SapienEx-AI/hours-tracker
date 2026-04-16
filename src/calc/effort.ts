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
 * - Entries with empty effort arrays contribute nothing.
 * - Multi-kind entries contribute to every kind they carry.
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
    for (const item of e.effort) {
      total += item.count;
      by_kind[item.kind] += item.count;
      by_category[categoryOf(item.kind)] += item.count;

      let p = perProject.get(e.project);
      if (p === undefined) {
        p = { total: 0, by_kind: emptyByKind() };
        perProject.set(e.project, p);
      }
      p.total += item.count;
      p.by_kind[item.kind] += item.count;
    }
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
