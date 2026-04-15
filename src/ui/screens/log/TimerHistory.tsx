import type { HistoricalRecording } from '@/store/timer-session';
import { msToHundredths } from '@/store/timer-session';
import { formatHoursDecimal } from '@/format/format';

type Props = {
  history: ReadonlyArray<HistoricalRecording>;
  onRedrive: (rec: HistoricalRecording) => void;
  onRemove: (id: string) => void;
};

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return iso;
  const deltaSec = Math.floor((Date.now() - then) / 1000);
  if (deltaSec < 60) return 'just now';
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ago`;
  if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)}h ago`;
  const days = Math.floor(deltaSec / 86400);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function contextLabel(rec: HistoricalRecording): string {
  if (rec.project_id === '') return 'no project';
  return rec.project_id + (rec.bucket_id !== null ? ` › ${rec.bucket_id}` : '');
}

function HistoryRow({
  rec,
  isLatest,
  onRedrive,
  onRemove,
}: {
  rec: HistoricalRecording;
  isLatest: boolean;
  onRedrive: (rec: HistoricalRecording) => void;
  onRemove: (id: string) => void;
}): JSX.Element {
  const rowClass = isLatest
    ? `
        group relative flex items-center gap-2 rounded-lg min-w-0
        px-2.5 py-1.5
        bg-emerald-50/40
        border border-emerald-300/50
        hover:border-emerald-400/60 hover:bg-emerald-50/70
        transition-all duration-150
      `
    : `
        group relative flex items-center gap-2 rounded-lg min-w-0
        px-2.5 py-1.5
        bg-white/60 hover:bg-white/85
        border border-slate-200/60 hover:border-amber-300/60
        transition-all duration-150
      `;

  return (
    <div className={rowClass}>
      <button
        type="button"
        onClick={() => onRedrive(rec)}
        className="flex-1 flex items-center gap-2 text-left"
        title={isLatest ? 'Load this recording into the form' : 'Redrive this recording into the form'}
      >
        <span
          className={`
            font-mono text-sm font-semibold tabular-nums shrink-0 w-14
            ${isLatest ? 'text-emerald-700' : 'text-amber-700'}
          `}
        >
          {formatHoursDecimal(msToHundredths(rec.elapsed_ms))}h
        </span>
        <span className="flex-1 min-w-0 flex flex-col leading-tight">
          <span
            className={`text-xs truncate ${isLatest ? 'text-slate-800 font-medium' : 'text-slate-700'}`}
          >
            {contextLabel(rec)}
          </span>
          <span className="flex items-center gap-1.5 leading-tight">
            {isLatest && (
              <span className="inline-flex items-center px-1.5 py-[1px] rounded-full text-[8px] font-mono uppercase tracking-widest font-semibold bg-emerald-100 text-emerald-700">
                latest
              </span>
            )}
            <span className="text-[10px] text-slate-400 font-mono">
              {relativeTime(rec.archived_wall)}
            </span>
          </span>
        </span>
        <span
          className={`
            ${isLatest ? 'text-emerald-600' : 'text-amber-600'}
            ${isLatest ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
            transition-opacity text-sm
          `}
        >
          →
        </span>
      </button>
      <button
        type="button"
        onClick={() => onRemove(rec.id)}
        title="Remove from history"
        className="px-1.5 py-0.5 rounded text-[11px] text-slate-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
      >
        ✕
      </button>
    </div>
  );
}

export function TimerHistory({ history, onRedrive, onRemove }: Props): JSX.Element | null {
  if (history.length === 0) return null;
  const countLabel = history.length === 1 ? '1 timed session' : `${history.length} timed sessions`;
  return (
    <div className="flex flex-col gap-1.5 pt-3 min-w-0">
      <div className="flex items-center justify-between px-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Recent
        </span>
        <span className="font-mono text-[10px] text-slate-400">{countLabel}</span>
      </div>
      {/* Capped at ~260px — fits ~5 rows comfortably; additional entries (up
          to 10 total) are reachable via an internal vertical scroll. The
          overflow-x-hidden clips any horizontal bleed from the row's
          border/shadow when the vertical scrollbar claims its width. */}
      <ul className="flex flex-col gap-2 max-h-[260px] overflow-y-auto overflow-x-hidden pr-1 -mr-1 py-0.5">
        {history.map((rec, idx) => (
          <li key={rec.id} className="min-w-0">
            <HistoryRow
              rec={rec}
              isLatest={idx === 0}
              onRedrive={onRedrive}
              onRemove={onRemove}
            />
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-slate-400 italic px-1 pt-0.5 leading-snug">
        Click any of these to load it into the form.
      </p>
    </div>
  );
}
