import { useEffect, useState } from 'react';
import { useTimerStore } from '@/store/timer-store';
import { liveElapsedMs, type Form } from '@/store/timer-session';

type Props = {
  form: Form;
};

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function TimerControl({ form }: Props): JSX.Element {
  const session = useTimerStore((s) => s.session);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const stop = useTimerStore((s) => s.stop);
  const abort = useTimerStore((s) => s.abort);
  const [, force] = useState(0);

  useEffect(() => {
    if (session?.phase.kind !== 'running') return;
    const id = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [session?.phase.kind]);

  if (session === null) {
    return (
      <button
        type="button"
        onClick={() => start(form)}
        title="Start timer"
        className="px-3 py-1.5 rounded-lg glass-input text-sm font-body text-slate-700 hover:bg-partner-cyan/10 transition-colors whitespace-nowrap"
      >
        ▶ Start timer
      </button>
    );
  }

  const elapsed = liveElapsedMs(session.phase);
  const snapshotLabel =
    session.snapshot.projectId === ''
      ? 'no project'
      : session.snapshot.projectId +
        (session.snapshot.bucketId !== null ? ` › ${session.snapshot.bucketId}` : '');

  const running = session.phase.kind === 'running';
  const paused = session.phase.kind === 'paused';
  const stopped = session.phase.kind === 'stopped';

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="font-mono text-base tabular-nums text-amber-700 min-w-[72px]">
          {formatElapsed(elapsed)}
        </span>
        {(running || paused) && (
          <>
            {running ? (
              <button
                type="button"
                onClick={pause}
                title="Pause"
                className="px-2 py-1 rounded-lg glass-input text-sm"
              >
                ⏸
              </button>
            ) : (
              <button
                type="button"
                onClick={resume}
                title="Resume"
                className="px-2 py-1 rounded-lg glass-input text-sm"
              >
                ▶
              </button>
            )}
            <button
              type="button"
              onClick={stop}
              title="Stop"
              className="px-2 py-1 rounded-lg glass-input text-sm"
            >
              ■
            </button>
            <button
              type="button"
              onClick={abort}
              title="Abort — discard without prompt"
              className="px-2 py-1 rounded-lg text-sm text-slate-500 hover:text-red-600"
            >
              ✕
            </button>
          </>
        )}
        {stopped && (
          <span className="text-xs text-slate-500 italic">(stopped — see banner)</span>
        )}
      </div>
      {(running || paused) && (
        <div className="text-xs text-slate-500">Snapshot: {snapshotLabel}</div>
      )}
      {(running || paused) && elapsed > 12 * 3600_000 && (
        <div className="text-xs text-amber-700">⚠ Timer running over 12h — still active?</div>
      )}
    </div>
  );
}
