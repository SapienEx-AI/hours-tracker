import { useMemo } from 'react';
import type { MonthDaily, DailyBreakdown } from '@/calc';
import { sumHundredths, sumCents } from '@/calc';
import type { CurrencyDisplay } from '@/format/format';
import { formatCents, formatHoursDecimal } from '@/format/format';
import { computeCalendarLayout, type CalendarCell as CellLayout } from './calendar-grid-layout';
import { CalendarCell } from './CalendarCell';

type Props = {
  year: number;
  month1to12: number;
  daily: MonthDaily;
  currency: CurrencyDisplay;
  onDayClick: (date: string) => void;
  selectedDate: string | null;
  todayISO: string;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function RowFragment(props: {
  row: CellLayout[];
  dayByDate: Map<string, DailyBreakdown>;
  maxHours: number;
  currency: CurrencyDisplay;
  onDayClick: (date: string) => void;
  selectedDate: string | null;
  todayISO: string;
  weekTotalH: number;
  weekTotalA: number;
}): JSX.Element {
  const { row, dayByDate, maxHours, currency, onDayClick, selectedDate, todayISO, weekTotalH, weekTotalA } = props;
  return (
    <>
      {row.map((cell, colIdx) => {
        const day = dayByDate.get(cell.date) ?? null;
        const isWeekend = colIdx >= 5;
        return (
          <CalendarCell
            key={cell.date}
            date={cell.date}
            inMonth={cell.inMonth}
            isToday={cell.date === todayISO}
            isWeekend={isWeekend}
            day={day}
            maxHours={maxHours}
            currency={currency}
            onClick={onDayClick}
            selected={cell.date === selectedDate}
          />
        );
      })}
      <div className="flex flex-col justify-center items-end pr-2 text-xs">
        <div className="font-mono font-semibold text-slate-700">{formatHoursDecimal(weekTotalH)}h</div>
        {weekTotalA > 0 && (
          <div className="font-mono text-slate-500">{formatCents(weekTotalA, currency)}</div>
        )}
      </div>
    </>
  );
}

export function CalendarGrid({
  year, month1to12, daily, currency, onDayClick, selectedDate, todayISO,
}: Props): JSX.Element {
  const cells = useMemo(() => computeCalendarLayout(year, month1to12), [year, month1to12]);
  const dayByDate = useMemo(
    () => new Map(daily.days.map((d) => [d.date, d])),
    [daily.days],
  );

  const rows: CellLayout[][] = [];
  for (let i = 0; i < 6; i++) rows.push(cells.slice(i * 7, i * 7 + 7));

  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, 1fr) 120px' }}>
      {WEEKDAYS.map((label) => (
        <div key={label} className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center py-1">
          {label}
        </div>
      ))}
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center py-1">Week</div>

      {rows.map((row, rowIdx) => {
        const rowDays = row
          .map((c) => (c.inMonth ? dayByDate.get(c.date) : undefined))
          .filter((d): d is DailyBreakdown => d !== undefined);
        const weekTotalH = sumHundredths(rowDays.map((d) => d.total_hundredths));
        const weekTotalA = sumCents(rowDays.map((d) => d.billable_amount_cents));
        return (
          <RowFragment
            key={rowIdx}
            row={row}
            dayByDate={dayByDate}
            maxHours={daily.max_hours_hundredths}
            currency={currency}
            onDayClick={onDayClick}
            selectedDate={selectedDate}
            todayISO={todayISO}
            weekTotalH={weekTotalH}
            weekTotalA={weekTotalA}
          />
        );
      })}
    </div>
  );
}
