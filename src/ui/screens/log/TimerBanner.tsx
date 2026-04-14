import { useTimerStore } from '@/store/timer-store';
import { liveElapsedMs, msToHundredths, type TimerSession } from '@/store/timer-session';
import { formatHoursDecimal } from '@/format/format';

type Props = {
  onLoad: (session: TimerSession, hoursHundredths: number) => void;
};

export function TimerBanner({ onLoad }: Props): JSX.Element | null {
  const session = useTimerStore((s) => s.session);
  const discard = useTimerStore((s) => s.discard);

  if (session === null || session.phase.kind !== 'stopped') return null;

  const elapsedMs = liveElapsedMs(session.phase);
  const hoursHundredths = msToHundredths(elapsedMs);
  const hoursDisplay = formatHoursDecimal(hoursHundredths);

  const snapshotLabel =
    session.snapshot.projectId === ''
      ? 'no project'
      : session.snapshot.projectId +
        (session.snapshot.bucketId !== null ? ` › ${session.snapshot.bucketId}` : '');

  const clipped = elapsedMs > 24 * 3600_000;

  return (
    <div className="glass rounded-xl p-4 flex flex-col gap-2 border border-amber-400/40">
      <div className="text-sm font-body text-slate-800">
        <span className="font-semibold">Timer:</span> {hoursDisplay}h — {snapshotLabel}
      </div>
      <div className="text-xs text-slate-500">
        Started {session.started_wall}
        {clipped && ' · Duration exceeded 24h; clipped to 24h on load. Edit after loading if needed.'}
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={discard}
          className="px-3 py-1.5 rounded-lg text-sm font-body text-slate-600 hover:text-slate-800"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={() => onLoad(session, hoursHundredths)}
          className="px-3 py-1.5 rounded-lg text-sm font-body bg-partner-cyan/20 text-slate-800 hover:bg-partner-cyan/30"
        >
          Load into form
        </button>
      </div>
    </div>
  );
}
