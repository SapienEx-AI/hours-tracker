import { useMemo, useState } from 'react';
import { useProjects } from '@/data/hooks/use-projects';
import { useRates } from '@/data/hooks/use-rates';
import { useMonthEntries } from '@/data/hooks/use-month-entries';
import { useAllEntries } from '@/data/hooks/use-all-entries';
import { computeMonthTotals, computeAllTimeBucketConsumption } from '@/calc';
import type { Partner, BucketConsumption } from '@/schema/types';
import { formatCents, formatHours, formatHoursDecimal } from '@/format/format';
import { Banner } from '@/ui/components/Banner';
import { assertMonthTotalsInvariants } from '@/ui/runtime-invariants';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(m: string): string {
  const [yStr, mStr] = m.split('-');
  const monthIdx = parseInt(mStr ?? '1', 10) - 1;
  return `${MONTH_NAMES[monthIdx] ?? ''} ${yStr ?? ''}`;
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

function TotalRow({ label, hours, amount }: {
  label: string; hours: number; amount?: string;
}): JSX.Element {
  return (
    <div className="p-5 rounded-2xl glass hover:glass-strong transition-all duration-300 hover:glow-cyan group">
      <div className="font-body text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-500 transition-colors">
        {label}
      </div>
      <div className="font-display text-2xl font-bold text-slate-900 mt-1">{formatHours(hours)}</div>
      {amount && <div className="font-mono text-sm font-semibold text-partner-mid mt-0.5">{amount}</div>}
    </div>
  );
}

type AllTimeBucketMap = Map<string, { consumed_hours_hundredths: number; amount_cents: number }>;

function BucketBar({ bucket, allTimeData }: {
  bucket: BucketConsumption;
  allTimeData: AllTimeBucketMap;
}): JSX.Element {
  const thisMonth = bucket.consumed_hours_hundredths;
  const budgeted = bucket.budgeted_hours_hundredths;
  const allTime = allTimeData.get(bucket.bucket_id);
  const totalConsumed = allTime?.consumed_hours_hundredths ?? thisMonth;
  const pct = budgeted > 0 ? Math.min(100, Math.round((totalConsumed / budgeted) * 100)) : 0;
  const over = totalConsumed > budgeted;

  return (
    <div className="pl-6 py-1">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-body text-slate-500">{bucket.bucket_id}</span>
        <span className={`font-mono ${over ? 'text-red-400' : 'text-slate-500'}`}>
          {formatHoursDecimal(totalConsumed)} / {formatHoursDecimal(budgeted)}h total
          {over && ` (${formatHoursDecimal(totalConsumed - budgeted)}h over)`}
        </span>
      </div>
      <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? 'bg-gradient-to-r from-red-400 to-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'bg-gradient-to-r from-partner-mid to-partner-cyan shadow-[0_0_8px_rgba(107,207,238,0.4)]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {thisMonth > 0 && thisMonth !== totalConsumed && (
        <div className="text-xs text-slate-500 font-mono mt-0.5 pl-1">
          {formatHoursDecimal(thisMonth)}h this month
        </div>
      )}
    </div>
  );
}

export function Dashboard({ partner }: { partner: Partner }): JSX.Element {
  const [month, setMonth] = useState(currentMonth);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const entries = useMonthEntries(month);
  const allEntriesQuery = useAllEntries();
  const projects = useProjects();
  const rates = useRates();

  const allTimeBuckets = useMemo<AllTimeBucketMap>(() => {
    if (!allEntriesQuery.data) return new Map();
    return computeAllTimeBucketConsumption(allEntriesQuery.data);
  }, [allEntriesQuery.data]);

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
    return <div className="text-slate-500">Loading…</div>;
  }
  if (entries.error) {
    return (
      <Banner variant="error">
        Failed to load entries: {(entries.error as Error).message}
      </Banner>
    );
  }
  if (!totals) return <div className="text-slate-500">No data</div>;

  const currency = {
    currency_symbol: partner.currency_symbol,
    currency_display_suffix: partner.currency_display_suffix,
  };

  function toggleExpand(projectId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">{formatMonthLabel(month)}</h1>
        <div className="flex gap-2 font-body text-sm font-medium">
          <button
            className="text-slate-500 hover:text-sky-500"
            onClick={() => setMonth(prevMonth(month))}
          >
            ← Prev
          </button>
          <button
            className="text-slate-500 hover:text-sky-500"
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
        <h2 className="font-display text-lg font-bold mb-3">Per project</h2>
        <div className="glass rounded-2xl overflow-hidden">
          <div className="flex items-center py-2.5 px-4 bg-white/30 text-xs font-bold uppercase tracking-wider text-slate-400 gap-3">
            <div className="flex-1">Project</div>
            <div className="w-24 text-right">Billable</div>
            <div className="w-32 text-right">Amount</div>
            <div className="w-28 text-right">Non-billable</div>
            <div className="w-24 text-right">Review</div>
            <div className="w-20 text-right">Buckets</div>
          </div>
          {totals.per_project.map((p) => {
            const project = projects.data?.projects.find((pp) => pp.id === p.project);
            const hasBuckets = p.by_bucket.length > 0;
            const isExpanded = expanded.has(p.project);
            return (
              <div key={p.project} className="border-t border-black/5">
                <div className="flex items-center py-2.5 px-4 text-sm hover:bg-white/20 transition-colors gap-3">
                  <div className="flex-1 font-medium text-slate-800">{project?.name ?? p.project}</div>
                  <div className="w-24 text-right font-mono text-slate-700">
                    {formatHours(p.billable_hours_hundredths)}
                  </div>
                  <div className="w-32 text-right font-mono font-semibold text-partner-mid">
                    {formatCents(p.billable_amount_cents, currency)}
                  </div>
                  <div className="w-28 text-right font-mono text-slate-500">
                    {p.non_billable_hours_hundredths > 0
                      ? formatHours(p.non_billable_hours_hundredths)
                      : <span className="text-slate-300">—</span>}
                  </div>
                  <div className="w-24 text-right font-mono">
                    {p.needs_review_hours_hundredths > 0
                      ? <span className="text-amber-600">{formatHours(p.needs_review_hours_hundredths)}</span>
                      : <span className="text-slate-300">—</span>}
                  </div>
                  <div className="w-20 text-right">
                    {hasBuckets ? (
                      <button
                        className="text-sky-500 hover:underline text-xs"
                        onClick={() => toggleExpand(p.project)}
                      >
                        {isExpanded ? 'hide' : `${p.by_bucket.length} ▸`}
                      </button>
                    ) : (
                      <span className="text-slate-500 text-xs">—</span>
                    )}
                  </div>
                </div>
                {isExpanded && hasBuckets && (
                  <div className="pb-2">
                    {p.by_bucket.map((b) => (
                      <BucketBar key={b.bucket_id} bucket={b} allTimeData={allTimeBuckets} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {totals.needs_review_hours_hundredths > 0 && (
        <section className="p-4 rounded-2xl glass border-l-4 border-amber-400">
          <div className="font-body text-sm text-amber-800">
            {formatHours(totals.needs_review_hours_hundredths)} flagged for review — classify
            these entries as billable or non-billable before closing the month.
          </div>
        </section>
      )}
    </div>
  );
}
