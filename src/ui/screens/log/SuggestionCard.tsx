import { formatHoursDecimal } from '@/format/format';
import type { Suggestion } from '@/data/hooks/use-calendar-events';

type Props = {
  suggestion: Suggestion;
  onClick: (s: Suggestion) => void;
};

export function SuggestionCard({ suggestion, onClick }: Props): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onClick(suggestion)}
      className="w-full text-left glass rounded-xl p-3 hover:bg-white/50 transition-colors"
    >
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span className="font-mono">
          {suggestion.start_label}–{suggestion.end_label}
        </span>
        <span className="font-mono font-semibold text-partner-mid">
          {formatHoursDecimal(suggestion.hours_hundredths)}h
        </span>
      </div>
      <div className="font-body text-sm text-slate-800 line-clamp-2">
        {suggestion.description || (
          <span className="italic text-slate-400">(no title)</span>
        )}
      </div>
      {suggestion.logged && (
        <div className="mt-1 text-xs text-emerald-700 font-semibold">✓ logged</div>
      )}
    </button>
  );
}
