import { useState } from 'react';
import type { EffortKind } from '@/schema/types';
import { formatHoursDecimal } from '@/format/format';

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
  currentHoursHundredths: number;
  onPrefill: (action: QuickAction) => void;
  onBounceProject: () => void;
};

export function QuickActivityCard({
  projectSelected,
  currentHoursHundredths,
  onPrefill,
  onBounceProject,
}: Props): JSX.Element {
  const [hoverDelta, setHoverDelta] = useState<number | null>(null);
  const hasHours = currentHoursHundredths > 0;
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3 bg-gradient-to-br from-orange-50 via-white/90 to-white/80 border border-orange-300/50">
      <div className="flex items-center gap-2">
        <QuickIcon />
        <h3 className="font-display text-sm text-slate-800 uppercase tracking-wide font-semibold whitespace-nowrap">
          Quick activity
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.kind}
            type="button"
            onClick={() => (projectSelected ? onPrefill(a) : onBounceProject())}
            onMouseEnter={() => setHoverDelta(a.hoursHundredths)}
            onMouseLeave={() => setHoverDelta(null)}
            onFocus={() => setHoverDelta(a.hoursHundredths)}
            onBlur={() => setHoverDelta(null)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-body text-slate-700 bg-white/70 hover:bg-white border border-slate-200/60 hover:border-orange-400/50 hover:-translate-y-0.5 transition-all duration-150 flex items-baseline justify-between gap-2"
          >
            <span className="truncate">{a.label}</span>
            <span className="font-mono text-[10px] text-orange-600/80 shrink-0 tabular-nums">
              +{formatHoursDecimal(a.hoursHundredths)}h
            </span>
          </button>
        ))}
      </div>
      <FooterRow
        hoverDelta={hoverDelta}
        hasHours={hasHours}
        currentHoursHundredths={currentHoursHundredths}
      />
    </div>
  );
}

function FooterRow({
  hoverDelta,
  hasHours,
  currentHoursHundredths,
}: {
  hoverDelta: number | null;
  hasHours: boolean;
  currentHoursHundredths: number;
}): JSX.Element {
  // Fixed-height row so the panel doesn't jitter when the content swaps
  // between the plain hint text and the hover preview.
  if (hoverDelta !== null) {
    const next = currentHoursHundredths + hoverDelta;
    return (
      <div className="h-4 flex items-center justify-center gap-2 text-[11px] font-mono tabular-nums">
        <span className="text-slate-500">{formatHoursDecimal(currentHoursHundredths)}h</span>
        <span className="text-orange-600 font-semibold">+{formatHoursDecimal(hoverDelta)}h</span>
        <span className="text-slate-400">=</span>
        <span className="text-slate-800 font-semibold">{formatHoursDecimal(next)}h</span>
      </div>
    );
  }
  return (
    <div className="h-4 text-[10px] text-slate-500 italic leading-snug">
      {hasHours
        ? `Adds to your current ${formatHoursDecimal(currentHoursHundredths)}h.`
        : 'Uses the project currently selected.'}
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
