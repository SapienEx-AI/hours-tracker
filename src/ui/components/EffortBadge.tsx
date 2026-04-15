import type { EffortCategory, EffortKind } from '@/schema/types';
import { categoryOf } from '@/calc/effort-categories';
import { EFFORT_KIND_LABEL } from './EffortKindSelect';

type Props = {
  kind: EffortKind;
  count: number;
};

const CATEGORY_CLASS: Record<EffortCategory, string> = {
  client_sync: 'bg-partner-cyan/20 text-partner-deep border-partner-cyan/40',
  technical: 'bg-slate-200/80 text-slate-700 border-slate-300',
  client_async: 'bg-indigo-100 text-indigo-800 border-indigo-300/60',
  internal: 'bg-amber-100 text-amber-800 border-amber-300/60',
  enablement: 'bg-emerald-100 text-emerald-800 border-emerald-300/60',
};

export function EffortBadge({ kind, count }: Props): JSX.Element {
  const cls = CATEGORY_CLASS[categoryOf(kind)];
  return (
    <span
      title={`${EFFORT_KIND_LABEL[kind]} × ${count}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider whitespace-nowrap ${cls}`}
    >
      <span>{kind.replace(/_/g, ' ')}</span>
      <span className="font-semibold">× {count}</span>
    </span>
  );
}
