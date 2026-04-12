import { useMemo, useState } from 'react';
import { useProjects } from '@/data/hooks/use-projects';
import { useRates } from '@/data/hooks/use-rates';
import { useMonthEntries } from '@/data/hooks/use-month-entries';
import { useAllEntries } from '@/data/hooks/use-all-entries';
import {
  computeMonthTotals,
  computeAllTimeBucketConsumption,
  splitBillingStreams,
  sumHundredths,
  sumCents,
} from '@/calc';
import type { Partner, ProjectsConfig } from '@/schema/types';
import { formatCents, formatHours, formatHoursDecimal } from '@/format/format';
import type { CurrencyDisplay } from '@/format/format';
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
  return `${MONTH_NAMES[parseInt(mStr ?? '1', 10) - 1] ?? ''} ${yStr ?? ''}`;
}

function prevMonth(m: string): string {
  const [yStr, mStr] = m.split('-');
  const y = parseInt(yStr ?? '0', 10);
  const mo = parseInt(mStr ?? '0', 10);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;
}

function nextMonth(m: string): string {
  const [yStr, mStr] = m.split('-');
  const y = parseInt(yStr ?? '0', 10);
  const mo = parseInt(mStr ?? '0', 10);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
}

// ── Subcomponents (extracted to stay under line limits) ──

function SummaryCard({ label, hours, amount, accent }: {
  label: string; hours: number; amount?: string; accent?: boolean;
}): JSX.Element {
  return (
    <div className={`p-4 rounded-2xl glass hover:glass-strong transition-all duration-300 hover:glow-cyan group ${accent ? 'glow-cyan' : ''}`}>
      <div className="font-body text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-500 transition-colors">
        {label}
      </div>
      <div className="font-display text-xl font-bold text-slate-900 mt-1">{formatHours(hours)}</div>
      {amount && <div className="font-mono text-xs font-semibold text-partner-mid mt-0.5">{amount}</div>}
    </div>
  );
}

function InvoiceTable({ rows, currency }: {
  rows: Array<{ project: string; hours_hundredths: number; amount_cents: number }>;
  currency: CurrencyDisplay;
}): JSX.Element {
  if (rows.length === 0) return <div className="text-sm text-slate-400 py-3">No entries this month.</div>;
  const totalH = sumHundredths(rows.map((r) => r.hours_hundredths));
  const totalA = sumCents(rows.map((r) => r.amount_cents));
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center py-2.5 px-4 bg-white/30 text-xs font-bold uppercase tracking-wider text-slate-400 gap-3">
        <div className="flex-1">Project</div>
        <div className="w-24 text-right">Hours</div>
        <div className="w-36 text-right">Amount</div>
      </div>
      {rows.map((r) => (
        <div key={r.project} className="flex items-center py-2.5 px-4 text-sm border-t border-black/5 hover:bg-white/20 transition-colors gap-3">
          <div className="flex-1 font-medium text-slate-800">{r.project}</div>
          <div className="w-24 text-right font-mono text-slate-700">{formatHours(r.hours_hundredths)}</div>
          <div className="w-36 text-right font-mono font-semibold text-partner-mid">{formatCents(r.amount_cents, currency)}</div>
        </div>
      ))}
      <div className="flex items-center py-2.5 px-4 border-t-2 border-black/10 bg-white/20 gap-3">
        <div className="flex-1 font-semibold text-slate-800">Total</div>
        <div className="w-24 text-right font-mono font-bold text-slate-900">{formatHours(totalH)}</div>
        <div className="w-36 text-right font-mono font-bold text-slate-900">{formatCents(totalA, currency)}</div>
      </div>
    </div>
  );
}

type AllTimeBucketMap = Map<string, { consumed_hours_hundredths: number; amount_cents: number }>;

function ActiveBuilds({ allTimeBuckets, projects, currency }: {
  allTimeBuckets: AllTimeBucketMap; projects: ProjectsConfig; currency: CurrencyDisplay;
}): JSX.Element {
  const withBuckets = projects.projects.filter((p) => p.buckets.some((b) => b.status !== 'archived'));
  if (withBuckets.length === 0) return <div className="text-sm text-slate-400 py-3">No active project builds.</div>;
  return (
    <div className="flex flex-col gap-3">
      {withBuckets.map((p) => (
        <div key={p.id} className="glass rounded-xl p-4">
          <div className="font-semibold text-slate-800 mb-2">{p.name}</div>
          {p.buckets.filter((b) => b.status !== 'archived').map((b) => {
            const consumed = allTimeBuckets.get(b.id)?.consumed_hours_hundredths ?? 0;
            const budgeted = b.budgeted_hours_hundredths;
            const amt = allTimeBuckets.get(b.id)?.amount_cents ?? 0;
            const pct = budgeted > 0 ? Math.min(100, Math.round((consumed / budgeted) * 100)) : 0;
            const over = consumed > budgeted;
            const barColor = over
              ? 'bg-gradient-to-r from-red-400 to-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
              : pct >= 80
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.3)]'
                : 'bg-gradient-to-r from-partner-mid to-partner-cyan shadow-[0_0_8px_rgba(107,207,238,0.4)]';
            return (
              <div key={b.id} className="mb-2.5 last:mb-0">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600">{b.name} <span className="text-slate-400">({b.type})</span>
                    {b.rate_cents !== null && <span className="text-slate-400"> @ {formatCents(b.rate_cents, currency)}/hr</span>}
                  </span>
                  <span className={`font-mono ${over ? 'text-red-500 font-semibold' : 'text-slate-500'}`}>
                    {formatHoursDecimal(consumed)} / {formatHoursDecimal(budgeted)}h
                    {amt > 0 && ` · ${formatCents(amt, currency)}`}
                    {over && ` (${formatHoursDecimal(consumed - budgeted)}h over)`}
                  </span>
                </div>
                <div className="h-2 bg-black/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                {b.status === 'closed' && <div className="text-[11px] text-slate-400 mt-0.5">Closed {b.closed_at ?? ''}</div>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Main Dashboard ──

export function Dashboard({ partner }: { partner: Partner }): JSX.Element {
  const [month, setMonth] = useState(currentMonth);
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
      { entries: entries.data.entries, projects: projects.data, rates: rates.data }, month,
    );
    assertMonthTotalsInvariants(t);
    return t;
  }, [entries.data, projects.data, rates.data, month]);

  const streams = useMemo(() => {
    if (!entries.data) return null;
    return splitBillingStreams(entries.data.entries, month);
  }, [entries.data, month]);

  if (entries.isLoading || projects.isLoading || rates.isLoading) return <div className="text-slate-500">Loading…</div>;
  if (entries.error) return <Banner variant="error">Failed to load: {(entries.error as Error).message}</Banner>;
  if (!totals || !streams) return <div className="text-slate-500">No data</div>;

  const currency: CurrencyDisplay = {
    currency_symbol: partner.currency_symbol,
    currency_display_suffix: partner.currency_display_suffix,
  };

  const resolveNames = (rows: Array<{ project: string; hours_hundredths: number; amount_cents: number }>) =>
    rows.map((r) => ({ ...r, project: projects.data?.projects.find((p) => p.id === r.project)?.name ?? r.project }));

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">{formatMonthLabel(month)}</h1>
        <div className="flex gap-2 font-body text-sm font-medium">
          <button className="text-slate-400 hover:text-sky-500 transition-colors" onClick={() => setMonth(prevMonth(month))}>← Prev</button>
          <button className="text-slate-400 hover:text-sky-500 transition-colors" onClick={() => setMonth(nextMonth(month))}>Next →</button>
        </div>
      </div>

      <section className="grid grid-cols-5 gap-3">
        <SummaryCard label="Monthly Invoice" hours={streams.monthly_invoice.hours_hundredths} amount={formatCents(streams.monthly_invoice.amount_cents, currency)} accent />
        <SummaryCard label="Project Builds" hours={streams.project_builds.hours_hundredths} amount={formatCents(streams.project_builds.amount_cents, currency)} />
        <SummaryCard label="Non-billable" hours={totals.non_billable_hours_hundredths} />
        <SummaryCard label="Needs Review" hours={totals.needs_review_hours_hundredths} />
        <SummaryCard label="Total" hours={totals.total_hours_hundredths} />
      </section>

      <section>
        <h2 className="font-display text-lg font-bold mb-1">Monthly Invoice &middot; {formatMonthLabel(month)}</h2>
        <p className="text-xs text-slate-400 mb-3">General consulting billed monthly — unbucketed billable entries.</p>
        <InvoiceTable rows={resolveNames(streams.monthly_invoice.by_project)} currency={currency} />
      </section>

      <section>
        <h2 className="font-display text-lg font-bold mb-1">Active Project Builds</h2>
        <p className="text-xs text-slate-400 mb-3">Bucketed hours billed per-project on completion — spans months.</p>
        {projects.data && <ActiveBuilds allTimeBuckets={allTimeBuckets} projects={projects.data} currency={currency} />}
      </section>

      {totals.needs_review_hours_hundredths > 0 && (
        <section className="p-4 rounded-2xl glass border-l-4 border-amber-400">
          <div className="font-body text-sm text-amber-800">
            {formatHours(totals.needs_review_hours_hundredths)} flagged for review — classify before closing the month.
          </div>
        </section>
      )}
    </div>
  );
}
