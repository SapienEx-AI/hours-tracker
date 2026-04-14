import { useState } from 'react';
import type { Entry } from '@/schema/types';
import type { CurrencyDisplay } from '@/format/format';
import { formatCents, formatHours } from '@/format/format';
import { EditEntryModal } from '@/ui/screens/entries/EditEntryModal';

type Props = {
  date: string;
  entries: Entry[];
  currency: CurrencyDisplay;
  onClose: () => void;
};

function formatDateHeader(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function statusPillClass(status: Entry['billable_status']): string {
  if (status === 'billable') return 'bg-emerald-100 text-emerald-800';
  if (status === 'non_billable') return 'bg-slate-100 text-slate-600';
  return 'bg-amber-100 text-amber-800';
}

export function CalendarDayPanel({ date, entries, currency, onClose }: Props): JSX.Element {
  const [editing, setEditing] = useState<Entry | null>(null);

  return (
    <div className="w-[320px] shrink-0 flex flex-col gap-2 border-l border-black/5 pl-4">
      <div className="flex items-center justify-between">
        <div className="font-display font-bold text-sm">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'} on {formatDateHeader(date)}
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-800 text-xl leading-none"
          aria-label="Close day panel"
        >&times;</button>
      </div>

      {entries.length === 0 && (
        <div className="text-sm text-slate-400 py-3">No entries on this date.</div>
      )}

      <div className="flex flex-col gap-2 overflow-y-auto">
        {entries.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setEditing(e)}
            className="text-left glass rounded-xl p-3 hover:bg-white/50 transition-colors"
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-slate-800">{e.project}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusPillClass(e.billable_status)}`}>
                {e.billable_status.replace('_', '-')}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-slate-700">{formatHours(e.hours_hundredths)}</span>
              {e.billable_status === 'billable' && (
                <span className="text-partner-mid">{formatCents(e.rate_cents, currency)}/hr</span>
              )}
              {e.bucket_id && (
                <span className="px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 text-[10px]">{e.bucket_id}</span>
              )}
            </div>
            <div className="text-xs text-slate-600 mt-1 line-clamp-2">{e.description}</div>
          </button>
        ))}
      </div>

      {editing && (
        <EditEntryModal entry={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
