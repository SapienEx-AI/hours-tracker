import type { EffortCategory, EffortKind } from '@/schema/types';
import type { MonthEffortTotals } from '@/calc';
import { EFFORT_KIND_LABEL } from '@/ui/components/EffortKindSelect';

const CATEGORY_LABEL: Record<EffortCategory, string> = {
  client_sync: 'client-sync',
  technical: 'technical',
  client_async: 'client-async',
  internal: 'internal',
  enablement: 'enablement',
};

const CATEGORY_COLOR: Record<EffortCategory, string> = {
  client_sync: 'bg-partner-cyan',
  technical: 'bg-slate-700',
  client_async: 'bg-indigo-500',
  internal: 'bg-amber-500',
  enablement: 'bg-emerald-500',
};

type Props = {
  totals: MonthEffortTotals;
  onClick?: () => void;
};

export function EffortSummaryCard({ totals, onClick }: Props): JSX.Element {
  if (totals.total_activities === 0) {
    return (
      <div className="glass rounded-xl p-4">
        <div className="font-display text-sm uppercase tracking-wide text-slate-500 mb-1">
          Effort · {totals.month}
        </div>
        <div className="text-xs text-slate-500">No events tagged this month.</div>
      </div>
    );
  }

  const topKinds = (Object.entries(totals.by_kind) as Array<[EffortKind, number]>)
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const byCategory = (
    Object.entries(totals.by_category) as Array<[EffortCategory, number]>
  ).sort(([, a], [, b]) => b - a);

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left glass rounded-xl p-4 hover:bg-white/80 transition-colors w-full"
    >
      <div className="font-display text-sm uppercase tracking-wide text-slate-500 mb-2">
        Effort · {totals.month}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-3xl font-semibold tabular-nums text-slate-800">
            {totals.total_activities}
          </div>
          <div className="text-xs text-slate-500" title="Count of tagged events across all activity kinds — see per-kind list below for unit-consistent breakdown">
            events
          </div>
          <ul className="mt-3 flex flex-col gap-0.5 text-xs text-slate-600">
            {topKinds.map(([k, n]) => (
              <li key={k}>
                <span className="tabular-nums font-mono">{n}</span>{' '}
                {EFFORT_KIND_LABEL[k]}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1">
          {byCategory.map(([cat, n]) => (
            <div key={cat} className="flex items-center gap-2 text-xs">
              <span
                className={`inline-block h-1.5 w-12 rounded ${CATEGORY_COLOR[cat]}`}
                style={{
                  opacity: 0.3 + 0.7 * (n / Math.max(1, totals.total_activities)),
                }}
              />
              <span className="text-slate-600 flex-1">{CATEGORY_LABEL[cat]}</span>
              <span className="font-mono tabular-nums text-slate-700">{n}</span>
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}
