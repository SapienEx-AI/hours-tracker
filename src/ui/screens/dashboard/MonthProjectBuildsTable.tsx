import type { ProjectBuildsMonthRow } from '@/calc';
import type { ProjectsConfig } from '@/schema/types';
import {
  formatCents,
  formatHours,
  type CurrencyDisplay,
} from '@/format/format';
import { sumHundredths, sumCents } from '@/calc';

type Props = {
  rows: ProjectBuildsMonthRow[];
  projects: ProjectsConfig;
  currency: CurrencyDisplay;
};

export function MonthProjectBuildsTable({ rows, projects, currency }: Props): JSX.Element {
  if (rows.length === 0) {
    return <div className="text-sm text-slate-400 py-3">No project-build hours this month.</div>;
  }

  const totalH = sumHundredths(rows.map((r) => r.hours_hundredths));
  const totalA = sumCents(rows.map((r) => r.amount_cents));

  function resolveNames(row: ProjectBuildsMonthRow): { bucketName: string; projectName: string } {
    const project = projects.projects.find((p) => p.id === row.project_id);
    const bucket = project?.buckets.find((b) => b.id === row.bucket_id);
    return {
      bucketName: bucket?.name ?? row.bucket_id,
      projectName: project?.name ?? row.project_id,
    };
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center py-2.5 px-4 bg-white/30 text-xs font-bold uppercase tracking-wider text-slate-400 gap-3">
        <div className="flex-1">Bucket</div>
        <div className="w-32">Project</div>
        <div className="w-24 text-right">Hours</div>
        <div className="w-36 text-right">Amount</div>
      </div>
      {rows.map((r) => {
        const { bucketName, projectName } = resolveNames(r);
        return (
          <div
            key={r.bucket_id}
            className="flex items-center py-2.5 px-4 text-sm border-t border-black/5 hover:bg-white/20 transition-colors gap-3"
          >
            <div className="flex-1 font-medium text-slate-800">{bucketName}</div>
            <div className="w-32 text-slate-600">{projectName}</div>
            <div className="w-24 text-right font-mono text-slate-700">{formatHours(r.hours_hundredths)}</div>
            <div className="w-36 text-right font-mono font-semibold text-partner-mid">
              {formatCents(r.amount_cents, currency)}
            </div>
          </div>
        );
      })}
      <div className="flex items-center py-2.5 px-4 border-t-2 border-black/10 bg-white/20 gap-3">
        <div className="flex-1 font-semibold text-slate-800">Total</div>
        <div className="w-32" />
        <div className="w-24 text-right font-mono font-bold text-slate-900">{formatHours(totalH)}</div>
        <div className="w-36 text-right font-mono font-bold text-slate-900">{formatCents(totalA, currency)}</div>
      </div>
    </div>
  );
}
