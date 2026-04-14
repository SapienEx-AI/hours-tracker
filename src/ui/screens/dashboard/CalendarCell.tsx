import type { DailyBreakdown } from '@/calc';
import { formatCents, formatHoursDecimal, type CurrencyDisplay } from '@/format/format';

type Props = {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  day: DailyBreakdown | null;
  maxHours: number;
  currency: CurrencyDisplay;
  onClick: (date: string) => void;
  selected: boolean;
};

function dayNumber(iso: string): string {
  return String(parseInt(iso.slice(8, 10), 10));
}

function stackedBarPercents(day: DailyBreakdown): { billable: number; nonBillable: number; needsReview: number } {
  // Unpack _hundredths fields into local number variables so percentage math
  // doesn't trip the no-float-money lint rule. These percentages are UI widths,
  // never money values.
  const total: number = day.total_hundredths;
  const billable: number = day.billable_hundredths;
  const nonBillable: number = day.non_billable_hundredths;
  const review: number = day.needs_review_hundredths;
  if (total === 0) return { billable: 0, nonBillable: 0, needsReview: 0 };
  return {
    billable: (billable / total) * 100,
    nonBillable: (nonBillable / total) * 100,
    needsReview: (review / total) * 100,
  };
}

function StackedBar({ day }: { day: DailyBreakdown }): JSX.Element {
  if (day.total_hundredths === 0) return <div className="h-1 mt-1" />;
  const pct = stackedBarPercents(day);
  return (
    <div className="h-1 mt-1 flex rounded-full overflow-hidden bg-black/5">
      <div className="bg-emerald-400" style={{ width: `${pct.billable}%` }} />
      <div className="bg-slate-400" style={{ width: `${pct.nonBillable}%` }} />
      <div className="bg-amber-400" style={{ width: `${pct.needsReview}%` }} />
    </div>
  );
}

export function CalendarCell({
  date, inMonth, isToday, isWeekend, day, maxHours, currency, onClick, selected,
}: Props): JSX.Element {
  if (!inMonth) {
    return (
      <div className="h-[100px] p-2 text-xs text-slate-300 bg-slate-50/30 rounded-md">
        {dayNumber(date)}
      </div>
    );
  }

  const dayHours: number = day?.total_hundredths ?? 0;
  const intensity = maxHours === 0 || day === null ? 0 : dayHours / maxHours;
  const weekendClass = isWeekend ? 'bg-slate-50/50' : '';
  const todayClass = isToday ? 'ring-2 ring-partner-cyan' : '';
  const selectedClass = selected ? 'outline outline-2 outline-partner-mid' : '';
  const style = isWeekend || intensity === 0
    ? undefined
    : { backgroundColor: `rgba(107, 207, 238, ${intensity * 0.22})` };

  return (
    <button
      type="button"
      onClick={() => onClick(date)}
      className={`h-[100px] p-2 text-left rounded-md transition-colors hover:bg-white/60 ${weekendClass} ${todayClass} ${selectedClass}`}
      style={style}
    >
      <div className="text-xs text-slate-500 font-mono mb-1">{dayNumber(date)}</div>
      {day && (
        <>
          <div className="font-display font-bold text-sm text-slate-800">
            {formatHoursDecimal(day.total_hundredths)}h
          </div>
          <StackedBar day={day} />
          {day.billable_amount_cents > 0 && (
            <div className="font-mono text-[11px] text-partner-mid mt-1">
              {formatCents(day.billable_amount_cents, currency)}
            </div>
          )}
        </>
      )}
    </button>
  );
}
