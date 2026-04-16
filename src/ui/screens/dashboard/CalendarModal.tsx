import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useMonthEntries } from '@/data/hooks/use-month-entries';
import { useProjects } from '@/data/hooks/use-projects';
import { useRates } from '@/data/hooks/use-rates';
import { computeMonthDaily } from '@/calc';
import type { Partner, Entry } from '@/schema/types';
import type { CurrencyDisplay } from '@/format/format';
import { Banner } from '@/ui/components/Banner';
import { CalendarGrid } from './CalendarGrid';
import { CalendarDayPanel } from './CalendarDayPanel';
import { CalendarMobileList } from './CalendarMobileList';

type Props = {
  initialMonth: string;
  partner: Partner;
  onClose: () => void;
};

function prevMonth(m: string): string {
  const [y, mo] = m.split('-').map((s) => parseInt(s, 10));
  if (!y || !mo) return m;
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;
}

function nextMonth(m: string): string {
  const [y, mo] = m.split('-').map((s) => parseInt(s, 10));
  if (!y || !mo) return m;
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatMonthLabel(m: string): string {
  const [y, mo] = m.split('-').map((s) => parseInt(s, 10));
  return `${MONTH_NAMES[(mo ?? 1) - 1] ?? ''} ${y ?? ''}`;
}

export function CalendarModal({ initialMonth, partner, onClose }: Props): JSX.Element {
  const [month, setMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const entries = useMonthEntries(month);
  const projects = useProjects();
  const rates = useRates();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('hashchange', onClose);
    return () => window.removeEventListener('hashchange', onClose);
  }, [onClose]);

  useEffect(() => {
    setSelectedDate(null);
  }, [month]);

  const currency: CurrencyDisplay = {
    currency_symbol: partner.currency_symbol,
    currency_display_suffix: partner.currency_display_suffix,
  };
  const [y, mo] = month.split('-').map((s) => parseInt(s, 10));
  const ready = !!entries.data && !!projects.data && !!rates.data;
  const daily = ready
    ? computeMonthDaily(
        { entries: entries.data!.entries, projects: projects.data!, rates: rates.data! },
        month,
      )
    : null;

  const effortByDate = useMemo(() => {
    const map = new Map<string, number>();
    if (!entries.data) return map;
    for (const e of entries.data.entries) {
      if (e.effort.length === 0) continue;
      let total = 0;
      for (const item of e.effort) total += item.count;
      map.set(e.date, (map.get(e.date) ?? 0) + total);
    }
    return map;
  }, [entries.data]);

  const selectedDayEntries: Entry[] = ready && selectedDate
    ? entries.data!.entries.filter((e) => e.date === selectedDate)
    : [];

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-[1050px] max-h-[90vh] glass-strong rounded-2xl p-6 glow-blue flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="font-display text-lg">Calendar · {formatMonthLabel(month)}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonth(prevMonth(month))}
              className="text-slate-400 hover:text-sky-500 transition-colors px-2 text-sm"
            >← Prev</button>
            <button
              onClick={() => setMonth(nextMonth(month))}
              className="text-slate-400 hover:text-sky-500 transition-colors px-2 text-sm"
            >Next →</button>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-800 text-xl leading-none ml-2"
              aria-label="Close calendar"
            >&times;</button>
          </div>
        </div>

        {!ready && <div className="text-slate-500 py-6 text-center">Loading…</div>}
        {entries.error && (
          <Banner variant="error">{(entries.error as Error).message}</Banner>
        )}

        {ready && daily && (
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 overflow-hidden">
            <div className="flex-1 min-w-0 overflow-auto">
              <div className="hidden lg:block">
                <CalendarGrid
                  year={y ?? 0}
                  month1to12={mo ?? 1}
                  daily={daily}
                  effortByDate={effortByDate}
                  currency={currency}
                  onDayClick={setSelectedDate}
                  selectedDate={selectedDate}
                  todayISO={todayISO()}
                />
              </div>
              <div className="lg:hidden">
                <CalendarMobileList
                  daily={daily}
                  effortByDate={effortByDate}
                  currency={currency}
                  onDayClick={setSelectedDate}
                  selectedDate={selectedDate}
                  todayISO={todayISO()}
                />
              </div>
            </div>

            {selectedDate && (
              <CalendarDayPanel
                date={selectedDate}
                entries={selectedDayEntries}
                currency={currency}
                onClose={() => setSelectedDate(null)}
              />
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
