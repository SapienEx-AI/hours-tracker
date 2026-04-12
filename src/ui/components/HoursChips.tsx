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
          className="px-2 py-1 rounded border border-partner-border-subtle font-mono text-xs text-partner-muted hover:text-partner-cyan hover:border-partner-cyan transition-colors"
        >
          {(h / 100).toFixed(2)}
        </button>
      ))}
    </div>
  );
}
