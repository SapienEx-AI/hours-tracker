import {
  addHundredths,
  addCents,
  mulCentsByHundredths,
} from './int';
import { isMonthlyStream, type CalcInput } from './totals';

export type DailyBreakdown = {
  date: string;
  total_hundredths: number;
  billable_hundredths: number;
  non_billable_hundredths: number;
  needs_review_hundredths: number;
  billable_amount_cents: number;
  entry_count: number;
};

export type MonthDaily = {
  month: string;
  days: DailyBreakdown[];
  max_hours_hundredths: number;
};

export type ProjectBuildsMonthRow = {
  project_id: string;
  bucket_id: string;
  hours_hundredths: number;
  amount_cents: number;
};

function emptyDay(date: string): DailyBreakdown {
  return {
    date,
    total_hundredths: 0,
    billable_hundredths: 0,
    non_billable_hundredths: 0,
    needs_review_hundredths: 0,
    billable_amount_cents: 0,
    entry_count: 0,
  };
}

export function computeMonthDaily(input: CalcInput, month: string): MonthDaily {
  const prefix = `${month}-`;
  const byDate = new Map<string, DailyBreakdown>();

  for (const e of input.entries) {
    if (!e.date.startsWith(prefix)) continue;
    const day = byDate.get(e.date) ?? emptyDay(e.date);

    day.total_hundredths = addHundredths(day.total_hundredths, e.hours_hundredths);
    day.entry_count += 1;

    if (e.billable_status === 'billable') {
      day.billable_hundredths = addHundredths(day.billable_hundredths, e.hours_hundredths);
      day.billable_amount_cents = addCents(
        day.billable_amount_cents,
        mulCentsByHundredths(e.rate_cents, e.hours_hundredths),
      );
    } else if (e.billable_status === 'non_billable') {
      day.non_billable_hundredths = addHundredths(day.non_billable_hundredths, e.hours_hundredths);
    } else {
      day.needs_review_hundredths = addHundredths(day.needs_review_hundredths, e.hours_hundredths);
    }

    byDate.set(e.date, day);
  }

  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const max_hours_hundredths = days.reduce((m, d) => Math.max(m, d.total_hundredths), 0);

  return { month, days, max_hours_hundredths };
}

export function computeProjectBuildsForMonth(
  input: CalcInput,
  month: string,
): ProjectBuildsMonthRow[] {
  const prefix = `${month}-`;
  const byBucket = new Map<string, ProjectBuildsMonthRow>();

  for (const e of input.entries) {
    if (!e.date.startsWith(prefix)) continue;
    if (e.billable_status !== 'billable') continue;
    if (e.bucket_id === null) continue;
    if (isMonthlyStream(e, input.projects)) continue;

    const existing = byBucket.get(e.bucket_id);
    const amount = mulCentsByHundredths(e.rate_cents, e.hours_hundredths);
    if (existing) {
      existing.hours_hundredths = addHundredths(existing.hours_hundredths, e.hours_hundredths);
      existing.amount_cents = addCents(existing.amount_cents, amount);
    } else {
      byBucket.set(e.bucket_id, {
        project_id: e.project,
        bucket_id: e.bucket_id,
        hours_hundredths: e.hours_hundredths,
        amount_cents: amount,
      });
    }
  }

  return [...byBucket.values()].sort((a, b) => {
    if (a.project_id !== b.project_id) return a.project_id.localeCompare(b.project_id);
    return a.bucket_id.localeCompare(b.bucket_id);
  });
}
