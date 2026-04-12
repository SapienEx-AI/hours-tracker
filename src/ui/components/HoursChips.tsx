import { formatHoursDecimal } from '@/format/format';

const PRESETS = [25, 50, 75, 100, 150, 200, 300, 400]; // hundredths

type Props = {
  onPick: (hoursHundredths: number) => void;
};

export function HoursChips({ onPick }: Props): JSX.Element {
  return (
    <div className="flex gap-2 flex-wrap">
      {PRESETS.map((h) => (
        <button
          key={h}
          type="button"
          onClick={() => onPick(h)}
          className="px-3 py-1.5 rounded-lg glass font-mono text-xs text-partner-muted hover:text-partner-deep hover:glow-cyan transition-all duration-200"
        >
          {formatHoursDecimal(h)}
        </button>
      ))}
    </div>
  );
}
