import { useEffect, useState } from 'react';
import { useTimerStore } from '@/store/timer-store';
import {
  liveElapsedMs,
  type Form,
  type HistoricalRecording,
} from '@/store/timer-session';
import type { EffortKind, Project } from '@/schema/types';
import { IdleState, RunningState, PausedState } from './TimerCardStates';
import { TimerHistory } from './TimerHistory';

type Props = {
  form: Form;
  projects: Project[];
  onChangeProject: (id: string) => void;
  onChangeBucket: (id: string | null) => void;
  onChangeEffortKind: (k: EffortKind | null) => void;
  onRedrive: (rec: HistoricalRecording) => void;
};

type StatusKind = 'idle' | 'running' | 'paused';

const BADGE_MAP: Record<StatusKind, { label: string; classes: string }> = {
  idle: { label: 'idle', classes: 'bg-slate-200/60 text-slate-600 border-slate-300/50' },
  running: { label: 'running', classes: 'bg-amber-100 text-amber-800 border-amber-300/60' },
  paused: { label: 'paused', classes: 'bg-amber-50 text-amber-700 border-amber-200/60' },
};

const FRAME_BG: Record<StatusKind, string> = {
  idle: 'from-white/95 via-white/95 to-slate-50/95',
  running: 'from-amber-50 via-amber-50/95 to-white/90',
  paused: 'from-amber-50/95 via-amber-50/90 to-white/90',
};

const FRAME_BORDER: Record<StatusKind, string> = {
  idle: 'border-white/40',
  running: 'border-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.25)]',
  paused: 'border-amber-300/50',
};

function TimerIcon(): JSX.Element {
  return (
    <svg
      className="w-4 h-4 text-amber-600 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="10" y1="2" x2="14" y2="2" />
      <line x1="12" y1="14" x2="15" y2="11" />
      <circle cx="12" cy="14" r="8" />
    </svg>
  );
}

function StatusBadge({ kind }: { kind: StatusKind }): JSX.Element {
  const { label, classes } = BADGE_MAP[kind];
  return (
    <span
      className={`ml-auto inline-flex items-center text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border whitespace-nowrap ${classes}`}
    >
      {label}
    </span>
  );
}

export function TimerCard({
  form,
  projects,
  onChangeProject,
  onChangeBucket,
  onChangeEffortKind,
  onRedrive,
}: Props): JSX.Element {
  const session = useTimerStore((s) => s.session);
  const history = useTimerStore((s) => s.history);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const stop = useTimerStore((s) => s.stop);
  const abort = useTimerStore((s) => s.abort);
  const removeHistory = useTimerStore((s) => s.removeHistory);
  const [, force] = useState(0);

  useEffect(() => {
    if (session?.phase.kind !== 'running') return;
    const id = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [session?.phase.kind]);

  const kind: StatusKind =
    session === null
      ? 'idle'
      : session.phase.kind === 'running'
        ? 'running'
        : 'paused';

  // Hide history only while a timer is actively running/paused; back to
  // idle the freshly-archived entry sits at the top of Recent with LATEST.
  const showHistory = kind === 'idle';

  return (
    <div
      className={`rounded-xl p-4 flex flex-col gap-3 bg-gradient-to-br ${FRAME_BG[kind]} border ${FRAME_BORDER[kind]} backdrop-blur-sm transition-all duration-300`}
    >
      <div className="flex items-center gap-2">
        <TimerIcon />
        <h3 className="font-display text-sm text-slate-800 uppercase tracking-wide font-semibold whitespace-nowrap">
          Timer
        </h3>
        <StatusBadge kind={kind} />
      </div>

      {session === null && <IdleState form={form} onStart={start} />}
      {session !== null && session.phase.kind === 'running' && (
        <RunningState
          elapsed={liveElapsedMs(session.phase)}
          projects={projects}
          projectId={form.projectId}
          bucketId={form.bucketId}
          effortKind={form.effort_kind}
          onChangeProject={onChangeProject}
          onChangeBucket={onChangeBucket}
          onChangeEffortKind={onChangeEffortKind}
          onPause={pause}
          onStop={() => stop()}
          onAbort={abort}
        />
      )}
      {session !== null && session.phase.kind === 'paused' && (
        <PausedState
          elapsed={liveElapsedMs(session.phase)}
          projects={projects}
          projectId={form.projectId}
          bucketId={form.bucketId}
          effortKind={form.effort_kind}
          onChangeProject={onChangeProject}
          onChangeBucket={onChangeBucket}
          onChangeEffortKind={onChangeEffortKind}
          onResume={resume}
          onStop={() => stop()}
          onAbort={abort}
        />
      )}
      {showHistory && (
        <TimerHistory history={history} onRedrive={onRedrive} onRemove={removeHistory} />
      )}
    </div>
  );
}
