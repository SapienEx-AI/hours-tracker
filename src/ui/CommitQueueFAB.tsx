import { useState, useEffect } from 'react';
import { useCommitQueue, type QueueStatus, type PendingChange } from '@/store/commit-queue';

function TimerRing({ endTime }: { endTime: number }): JSX.Element {
  const [progress, setProgress] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const delay = useCommitQueue((s) => s.autoPushDelay);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      const total = delay * 1000;
      setProgress(remaining / total);
      setSecondsLeft(Math.ceil(remaining / 1000));
    }, 50);
    return () => clearInterval(interval);
  }, [endTime, delay]);

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <div className="relative w-11 h-11 flex items-center justify-center">
      <svg className="absolute -rotate-90" width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="3" />
        <circle
          cx="22" cy="22" r={radius} fill="none"
          stroke="url(#timer-grad)" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-100 ease-linear"
        />
        <defs>
          <linearGradient id="timer-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2A85C4" />
            <stop offset="100%" stopColor="#6BCFEE" />
          </linearGradient>
        </defs>
      </svg>
      <span className="relative font-mono text-xs font-bold text-slate-600">{secondsLeft}</span>
    </div>
  );
}

function SpinnerIcon(): JSX.Element {
  return (
    <svg className="animate-spin w-5 h-5 text-partner-mid" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon(): JSX.Element {
  return (
    <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function StatusIcon({ status, flushTimerEnd }: { status: QueueStatus; flushTimerEnd: number | null }): JSX.Element | null {
  if (status === 'pending' && flushTimerEnd) return <TimerRing endTime={flushTimerEnd} />;
  if (status === 'flushing') return <SpinnerIcon />;
  if (status === 'done') return <CheckIcon />;
  return null;
}

function StatusText({ status, changes }: { status: QueueStatus; changes: PendingChange[] }): JSX.Element {
  if (status === 'pending') {
    return (
      <>
        <div className="text-sm font-semibold text-slate-800">
          {changes.length} change{changes.length > 1 ? 's' : ''} pending
        </div>
        <div className="text-[11px] text-slate-400 truncate">
          {changes[changes.length - 1]?.label ?? ''}
        </div>
      </>
    );
  }
  if (status === 'flushing') return <div className="text-sm font-semibold text-slate-800">Saving changes...</div>;
  return <div className="text-sm font-semibold text-emerald-700">Changes saved</div>;
}

export function CommitQueueFAB(): JSX.Element {
  const { status, changes, flushTimerEnd, flushError, flush } = useCommitQueue();

  if (status === 'idle') return <></>;

  return (
    <div
      className={`fixed bottom-6 right-6 z-40 glass-strong rounded-2xl px-4 py-3 glow-blue transition-all duration-500 ease-out ${
        status === 'done' ? 'opacity-80 scale-95' : 'opacity-100 scale-100'
      }`}
      style={{ minWidth: '200px' }}
    >
      <div className="flex items-center gap-3">
        <StatusIcon status={status} flushTimerEnd={flushTimerEnd} />
        <div className="flex-1 min-w-0">
          <StatusText status={status} changes={changes} />
        </div>
        {status === 'pending' && (
          <button
            type="button"
            onClick={() => flush()}
            className="text-xs font-semibold text-partner-mid hover:text-partner-deep transition-colors whitespace-nowrap"
          >
            Push now
          </button>
        )}
      </div>

      {/* Error banner */}
      {flushError && (
        <div className="mt-2 text-xs text-red-600 bg-red-50/80 rounded-lg px-3 py-1.5">
          {flushError}
        </div>
      )}
    </div>
  );
}
