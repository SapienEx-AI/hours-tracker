import type { Form, TimerSession } from '@/store/timer-session';
import type { EffortKind, Project } from '@/schema/types';
import { liveElapsedMs, msToHundredths } from '@/store/timer-session';
import { formatHoursDecimal } from '@/format/format';
import { TimerInlineEdit } from './TimerInlineEdit';

export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function snapshotLabel(snapshot: Form): string {
  if (snapshot.projectId === '') return 'no project';
  return (
    snapshot.projectId +
    (snapshot.bucketId !== null ? ` › ${snapshot.bucketId}` : '')
  );
}

export function IdleState({
  form,
  onStart,
}: {
  form: Form;
  onStart: (f: Form) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-slate-500 leading-relaxed">
        Start a stopwatch. Change project or bucket inline while it runs — those edits flow
        straight into the form. On stop, load only the elapsed hours.
      </div>
      <button
        type="button"
        onClick={() => onStart(form)}
        className="
          group w-full px-4 py-2.5 rounded-xl font-body text-sm font-semibold text-white
          bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500
          hover:from-amber-500 hover:via-amber-600 hover:to-orange-600
          shadow-[0_4px_20px_rgba(245,158,11,0.35),0_0_24px_rgba(245,158,11,0.15),inset_0_1px_0_rgba(255,255,255,0.25)]
          hover:shadow-[0_6px_24px_rgba(245,158,11,0.45),0_0_32px_rgba(245,158,11,0.2),inset_0_1px_0_rgba(255,255,255,0.3)]
          hover:-translate-y-0.5 active:translate-y-0
          transition-all duration-200
        "
      >
        <span className="inline-flex items-center gap-2">
          <span className="text-base">▶</span>
          <span>Start timer</span>
        </span>
      </button>
    </div>
  );
}

type RunningPausedProps = {
  elapsed: number;
  projects: Project[];
  projectId: string;
  bucketId: string | null;
  effortKind: EffortKind | null;
  onChangeProject: (id: string) => void;
  onChangeBucket: (id: string | null) => void;
  onChangeEffortKind: (k: EffortKind | null) => void;
  onStop: () => void;
  onAbort: () => void;
};

export function RunningState({
  onPause,
  ...rest
}: RunningPausedProps & { onPause: () => void }): JSX.Element {
  const { elapsed, onStop, onAbort } = rest;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <div
          className="
            font-mono text-3xl font-semibold tabular-nums text-amber-700
            drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]
          "
        >
          {formatElapsed(elapsed)}
        </div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-amber-600/70">
          live
        </div>
      </div>
      <TimerInlineEdit {...rest} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPause}
          title="Pause"
          className="flex-1 px-3 py-2 rounded-lg font-body text-sm glass-input hover:bg-white/70 hover:-translate-y-0.5 transition-all duration-150"
        >
          ⏸ Pause
        </button>
        <button
          type="button"
          onClick={onStop}
          title="Stop"
          className="flex-1 px-3 py-2 rounded-lg font-body text-sm text-white bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 hover:-translate-y-0.5 transition-all duration-150 shadow-[0_2px_12px_rgba(245,158,11,0.3)]"
        >
          ■ Stop
        </button>
        <button
          type="button"
          onClick={onAbort}
          title="Abort — discard without saving"
          className="px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          ✕
        </button>
      </div>
      {elapsed > 12 * 3600_000 && (
        <div className="text-xs text-amber-700 font-medium">
          ⚠ Running over 12h — still active?
        </div>
      )}
    </div>
  );
}

export function PausedState({
  onResume,
  ...rest
}: RunningPausedProps & { onResume: () => void }): JSX.Element {
  const { elapsed, onStop, onAbort } = rest;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <div className="font-mono text-3xl font-semibold tabular-nums text-amber-700/60">
          {formatElapsed(elapsed)}
        </div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-amber-500/60">
          paused
        </div>
      </div>
      <TimerInlineEdit {...rest} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onResume}
          title="Resume"
          className="flex-1 px-3 py-2 rounded-lg font-body text-sm text-white bg-gradient-to-br from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 hover:-translate-y-0.5 transition-all duration-150 shadow-[0_2px_12px_rgba(245,158,11,0.25)]"
        >
          ▶ Resume
        </button>
        <button
          type="button"
          onClick={onStop}
          title="Stop"
          className="flex-1 px-3 py-2 rounded-lg font-body text-sm glass-input hover:bg-white/70 hover:-translate-y-0.5 transition-all duration-150"
        >
          ■ Stop
        </button>
        <button
          type="button"
          onClick={onAbort}
          title="Abort — discard without saving"
          className="px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function StoppedState({
  session,
  onLoad,
  onDiscard,
}: {
  session: TimerSession;
  onLoad: (s: TimerSession, h: number) => void;
  onDiscard: () => void;
}): JSX.Element {
  const elapsedMs = liveElapsedMs(session.phase);
  const hoursHundredths = msToHundredths(elapsedMs);
  const clipped = elapsedMs > 24 * 3600_000;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <div
          className="
            font-mono text-3xl font-semibold tabular-nums text-emerald-700
            drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]
          "
        >
          {formatHoursDecimal(hoursHundredths)}h
        </div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-600/70">
          ready
        </div>
      </div>
      <div className="text-xs text-slate-600">
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
          for ·{' '}
        </span>
        {snapshotLabel(session.snapshot)}
      </div>
      <div className="text-[11px] text-slate-400 font-mono">
        {session.started_wall}
        {clipped && ' · clipped to 24h'}
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onDiscard}
          className="px-3 py-2 rounded-lg text-sm font-body text-slate-600 hover:text-slate-800 hover:bg-slate-100/50 transition-colors"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={() => onLoad(session, hoursHundredths)}
          className="
            flex-1 px-4 py-2 rounded-lg font-body text-sm font-semibold text-white
            bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600
            hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-700
            hover:-translate-y-0.5 active:translate-y-0
            shadow-[0_4px_20px_rgba(16,185,129,0.35),0_0_24px_rgba(16,185,129,0.15),inset_0_1px_0_rgba(255,255,255,0.25)]
            hover:shadow-[0_6px_24px_rgba(16,185,129,0.45),0_0_32px_rgba(16,185,129,0.2)]
            transition-all duration-200
          "
        >
          Load {formatHoursDecimal(hoursHundredths)}h from timer →
        </button>
      </div>
    </div>
  );
}
