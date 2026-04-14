import { formatHoursDecimal } from '@/format/format';

const PRESETS = [25, 50, 75, 100, 150, 200, 300, 400]; // hundredths

type Props = {
  onPick: (hoursHundredths: number) => void;
  disabled?: boolean;
};

export function HoursChips({ onPick, disabled = false }: Props): JSX.Element {
  return (
    <div className="flex gap-2 flex-wrap">
      {PRESETS.map((h) => (
        <button
          key={h}
          type="button"
          onClick={() => onPick(h)}
          disabled={disabled}
          className="px-3 py-1.5 rounded-lg glass font-mono text-xs text-slate-500 hover:text-blue-800 hover:glow-cyan transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-500 disabled:hover:glow-none"
        >
          {formatHoursDecimal(h)}
        </button>
      ))}
    </div>
  );
}
