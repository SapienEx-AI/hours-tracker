import type { Entry } from '@/schema/types';
import { formatHours, formatCents, type CurrencyDisplay } from '@/format/format';
import { Button } from '@/ui/components/Button';
import { BucketCell } from './BucketCell';

type Props = {
  entry: Entry;
  buckets: Array<{ id: string; name: string; status: string }>;
  currency: CurrencyDisplay;
  onEdit: (entry: Entry) => void;
  onAssignBucket: (entryId: string, bucketId: string) => void;
  onDelete: (entry: Entry) => void;
  assignBusy: boolean;
};

export function EntryRow({
  entry,
  buckets,
  currency,
  onEdit,
  onAssignBucket,
  onDelete,
  assignBusy,
}: Props): JSX.Element {
  return (
    <tr
      className="border-t border-black/5 hover:bg-white/30 transition-colors cursor-pointer"
      onClick={() => onEdit(entry)}
    >
      <td className="py-2 px-3 font-mono text-slate-600">{entry.date}</td>
      <td className="py-2 px-3 font-medium text-slate-800">{entry.project}</td>
      <td className="py-2 px-3 font-mono">{formatHours(entry.hours_hundredths)}</td>
      <td className="py-2 px-3 font-mono">{formatCents(entry.rate_cents, currency)}</td>
      <td className="py-2 px-3">
        <span
          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
            entry.billable_status === 'billable'
              ? 'bg-emerald-100 text-emerald-800'
              : entry.billable_status === 'non_billable'
                ? 'bg-slate-100 text-slate-600'
                : 'bg-amber-100 text-amber-800'
          }`}
        >
          {entry.billable_status.replace('_', '-')}
        </span>
      </td>
      <td className="py-2 px-3" onClick={(ev) => ev.stopPropagation()}>
        <BucketCell
          entry={entry}
          buckets={buckets}
          onAssign={onAssignBucket}
          busy={assignBusy}
        />
      </td>
      <td className="py-2 px-3 text-slate-600 max-w-sm">
        {entry.effort.length > 0 && (
          <span className="mr-1.5 align-middle text-xs text-slate-500 font-mono">
            {entry.effort.slice(0, 3).map((item) =>
              `${item.count}·${item.kind.slice(0, 3)}`,
            ).join(' · ')}
            {entry.effort.length > 3 ? ` +${entry.effort.length - 3} more` : ''}
          </span>
        )}
        {entry.description}
      </td>
      <td className="py-2 px-3" onClick={(ev) => ev.stopPropagation()}>
        <Button
          variant="danger"
          onClick={() => {
            if (confirm(`Delete entry ${entry.id}?`)) onDelete(entry);
          }}
        >
          Delete
        </Button>
      </td>
    </tr>
  );
}
