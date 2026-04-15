import type { MonthDaily, DailyBreakdown } from '@/calc';
import type { CurrencyDisplay } from '@/format/format';
import { formatCents, formatHoursDecimal } from '@/format/format';

type Props = {
  daily: MonthDaily;
  effortByDate: Map<string, number>;
  currency: CurrencyDisplay;
  onDayClick: (date: string) => void;
  selectedDate: string | null;
  todayISO: string;
};

function formatDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function barPercents(day: DailyBreakdown): { billable: number; nonBillable: number; needsReview: number } {
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

export function CalendarMobileList({
  daily, effortByDate, currency, onDayClick, selectedDate, todayISO,
}: Props): JSX.Element {
  if (daily.days.length === 0) {
    return <div className="text-sm text-slate-400 py-6 text-center">No entries this month.</div>;
  }
  return (
    <div className="flex flex-col gap-1">
      {daily.days.map((d) => {
        const isToday = d.date === todayISO;
        const isSelected = d.date === selectedDate;
        const pct = barPercents(d);
        return (
          <button
            key={d.date}
            type="button"
            onClick={() => onDayClick(d.date)}
            className={`text-left flex items-center gap-3 p-3 rounded-xl glass hover:bg-white/60 ${
              isToday ? 'ring-2 ring-partner-cyan' : ''
            } ${isSelected ? 'outline outline-2 outline-partner-mid' : ''}`}
          >
            <div className="w-28 text-sm font-medium text-slate-700">{formatDateShort(d.date)}</div>
            <div className="w-20 text-sm font-mono font-bold text-slate-800">
              {formatHoursDecimal(d.total_hundredths)}h
            </div>
            <div className="flex-1 h-2 rounded-full overflow-hidden bg-black/5 flex">
              <div className="bg-emerald-400" style={{ width: `${pct.billable}%` }} />
              <div className="bg-slate-400" style={{ width: `${pct.nonBillable}%` }} />
              <div className="bg-amber-400" style={{ width: `${pct.needsReview}%` }} />
            </div>
            {(effortByDate.get(d.date) ?? 0) > 0 && (
              <div className="w-16 text-right font-mono text-[10px] text-slate-500">
                {effortByDate.get(d.date)} acts
              </div>
            )}
            {d.billable_amount_cents > 0 && (
              <div className="w-24 text-right font-mono text-xs text-partner-mid">
                {formatCents(d.billable_amount_cents, currency)}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
