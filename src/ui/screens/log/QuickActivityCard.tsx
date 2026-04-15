import type { EffortKind } from '@/schema/types';
import { SapienExMark } from '@/ui/components/SapienExMark';

export type QuickAction = {
  kind: EffortKind;
  label: string;
  hoursHundredths: number;
};

const ACTIONS: ReadonlyArray<QuickAction> = [
  { kind: 'slack', label: '+ Slack message', hoursHundredths: 2 },
  { kind: 'email', label: '+ Email thread', hoursHundredths: 10 },
  { kind: 'meeting', label: '+ Meeting', hoursHundredths: 100 },
  { kind: 'workshop', label: '+ Workshop', hoursHundredths: 200 },
  { kind: 'documentation', label: '+ Documentation', hoursHundredths: 50 },
  { kind: 'other', label: '+ Other', hoursHundredths: 25 },
];

type Props = {
  projectSelected: boolean;
  onPrefill: (action: QuickAction) => void;
  onBounceProject: () => void;
};

export function QuickActivityCard({
  projectSelected,
  onPrefill,
  onBounceProject,
}: Props): JSX.Element {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3 bg-gradient-to-br from-orange-50 via-white/90 to-white/80 border border-orange-300/50">
      <div className="flex items-center gap-2">
        <QuickIcon />
        <h3 className="font-display text-sm text-slate-800 uppercase tracking-wide font-semibold whitespace-nowrap">
          Quick activity
        </h3>
        <SapienExMark variant="light" label="hide" size="sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.kind}
            type="button"
            onClick={() => (projectSelected ? onPrefill(a) : onBounceProject())}
            className="px-2.5 py-1.5 rounded-lg text-xs font-body text-slate-700 bg-white/70 hover:bg-white border border-slate-200/60 hover:border-orange-400/50 hover:-translate-y-0.5 transition-all duration-150 text-left"
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="text-[10px] text-slate-500 italic leading-snug">
        Uses the project currently selected.
      </div>
    </div>
  );
}

function QuickIcon(): JSX.Element {
  return (
    <svg
      className="w-4 h-4 text-orange-500 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
