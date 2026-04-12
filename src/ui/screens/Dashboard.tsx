import { useMemo, useState } from 'react';
import { useProjects } from '@/data/hooks/use-projects';
import { useRates } from '@/data/hooks/use-rates';
import { useMonthEntries } from '@/data/hooks/use-month-entries';
import { computeMonthTotals, sumHundredths } from '@/calc';
import type { Partner } from '@/schema/types';
import { formatCents, formatHours } from '@/format/format';
import { Banner } from '@/ui/components/Banner';
import { assertMonthTotalsInvariants } from '@/ui/runtime-invariants';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function prevMonth(m: string): string {
  const [yStr, mStr] = m.split('-');
  const y = parseInt(yStr ?? '0', 10);
  const mo = parseInt(mStr ?? '0', 10);
  if (mo === 1) return `${y - 1}-12`;
  return `${y}-${String(mo - 1).padStart(2, '0')}`;
}

function nextMonth(m: string): string {
  const [yStr, mStr] = m.split('-');
  const y = parseInt(yStr ?? '0', 10);
  const mo = parseInt(mStr ?? '0', 10);
  if (mo === 12) return `${y + 1}-01`;
  return `${y}-${String(mo + 1).padStart(2, '0')}`;
}

type TotalRowProps = {
  label: string;
  hours: number;
  amount?: string;
};

function TotalRow({ label, hours, amount }: TotalRowProps): JSX.Element {
  return (
    <div className="p-4 rounded border border-partner-border-subtle">
      <div className="font-body text-xs font-semibold uppercase tracking-wide text-partner-muted">{label}</div>
      <div className="font-display text-2xl">{formatHours(hours)}</div>
      {amount && <div className="font-mono text-sm text-partner-cyan">{amount}</div>}
    </div>
  );
}

export function Dashboard({ partner }: { partner: Partner }): JSX.Element {
  const [month, setMonth] = useState(currentMonth);
  const entries = useMonthEntries(month);
  const projects = useProjects();
  const rates = useRates();

  const totals = useMemo(() => {
    if (!entries.data || !projects.data || !rates.data) return null;
    const t = computeMonthTotals(
      { entries: entries.data.entries, projects: projects.data, rates: rates.data },
      month,
    );
    assertMonthTotalsInvariants(t);
    return t;
  }, [entries.data, projects.data, rates.data, month]);

  if (entries.isLoading || projects.isLoading || rates.isLoading) {
    return <div className="text-partner-muted">Loading…</div>;
  }
  if (entries.error) {
    return <Banner variant="error">Failed to load entries: {(entries.error as Error).message}</Banner>;
  }
  if (!totals) return <div className="text-partner-muted">No data</div>;

  const currency = {
    currency_symbol: partner.currency_symbol,
    currency_display_suffix: partner.currency_display_suffix,
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">{month}</h1>
        <div className="flex gap-2 font-body text-sm font-medium">
          <button
            className="text-partner-muted hover:text-partner-cyan"
            onClick={() => setMonth(prevMonth(month))}
          >
            ← Prev
          </button>
          <button
            className="text-partner-muted hover:text-partner-cyan"
            onClick={() => setMonth(nextMonth(month))}
          >
            Next →
          </button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4">
        <TotalRow
          label="Billable"
          hours={totals.billable_hours_hundredths}
          amount={formatCents(totals.billable_amount_cents, currency)}
        />
        <TotalRow label="Non-billable" hours={totals.non_billable_hours_hundredths} />
        <TotalRow label="Needs review" hours={totals.needs_review_hours_hundredths} />
        <TotalRow label="Total" hours={totals.total_hours_hundredths} />
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Per project</h2>
        <table className="w-full font-mono text-sm">
          <thead>
            <tr className="text-left text-partner-muted">
              <th className="py-1">Project</th>
              <th className="py-1 text-right">Hours</th>
              <th className="py-1 text-right">Billable</th>
            </tr>
          </thead>
          <tbody>
            {totals.per_project.map((p) => {
              const project = projects.data?.projects.find((pp) => pp.id === p.project);
              const totalProjectHours = sumHundredths([
                p.billable_hours_hundredths,
                p.non_billable_hours_hundredths,
                p.needs_review_hours_hundredths,
              ]);
              return (
                <tr key={p.project} className="border-t border-partner-border-subtle">
                  <td className="py-1">{project?.name ?? p.project}</td>
                  <td className="py-1 text-right">{formatHours(totalProjectHours)}</td>
                  <td className="py-1 text-right">
                    {formatCents(p.billable_amount_cents, currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
