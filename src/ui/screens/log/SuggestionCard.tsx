import { formatHoursDecimal } from '@/format/format';
import type { Suggestion } from '@/data/hooks/use-calendar-events';

type Props = {
  suggestion: Suggestion;
  onClick: (s: Suggestion) => void;
};

export function SuggestionCard({ suggestion, onClick }: Props): JSX.Element {
  const logged = suggestion.logged;

  return (
    <button
      type="button"
      onClick={() => onClick(suggestion)}
      className={`
        group relative w-full text-left rounded-xl overflow-hidden
        transition-all duration-200
        ${
          logged
            ? 'bg-gradient-to-br from-emerald-50/95 via-white/95 to-white/90 border border-emerald-300/50 opacity-80 hover:opacity-100'
            : 'bg-gradient-to-br from-indigo-50/95 via-sky-50/90 to-white/95 border border-indigo-300/50 hover:border-indigo-400/70 hover:shadow-[0_4px_20px_rgba(99,102,241,0.25),0_0_24px_rgba(99,102,241,0.12)] hover:-translate-y-0.5'
        }
      `}
    >
      {/* Left-edge accent bar */}
      <span
        className={`
          absolute left-0 top-0 bottom-0 w-1
          ${
            logged
              ? 'bg-gradient-to-b from-emerald-400 to-emerald-500/50'
              : 'bg-gradient-to-b from-sky-400 via-indigo-500 to-indigo-700 shadow-[0_0_12px_rgba(99,102,241,0.4)]'
          }
        `}
      />

      <div className="pl-4 pr-3 py-3 flex flex-col gap-1.5">
        {/* Top row: time range + hours */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 px-1.5 py-0.5 rounded bg-slate-100/60 border border-slate-200/60">
            {suggestion.start_label}–{suggestion.end_label}
          </span>
          <span
            className={`
              font-mono font-semibold tabular-nums text-base
              ${logged ? 'text-emerald-700' : 'text-indigo-700'}
            `}
          >
            {formatHoursDecimal(suggestion.hours_hundredths)}h
          </span>
        </div>

        {/* Title */}
        <div
          className={`
            font-body text-sm font-medium line-clamp-2 leading-snug
            ${logged ? 'text-slate-500' : 'text-slate-800 group-hover:text-indigo-800'}
            transition-colors
          `}
        >
          {suggestion.description || (
            <span className="italic text-slate-400">(no title)</span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-0.5">
          {logged ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              logged
            </span>
          ) : (
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              click to prefill
            </span>
          )}
          {!logged && (
            <span className="text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity text-sm">
              →
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
