import type { Bucket } from '@/schema/types';
import { formatHoursDecimal, formatCents, type CurrencyDisplay } from '@/format/format';
import { Button } from '@/ui/components/Button';

type Props = {
  bucket: Bucket;
  currency: CurrencyDisplay;
  onClose: () => void;
  onArchive: () => void;
  disabled: boolean;
};

export function BucketRow({ bucket, currency, onClose, onArchive, disabled }: Props): JSX.Element {
  const statusColor =
    bucket.status === 'active'
      ? 'text-green-400'
      : bucket.status === 'closed'
        ? 'text-yellow-400'
        : 'text-partner-muted';

  return (
    <div className="flex items-center justify-between py-1 pl-4 border-l-2 border-partner-border-subtle">
      <div className="flex-1">
        <span className="font-body text-sm">{bucket.name}</span>
        <span className="font-mono text-xs text-partner-muted ml-2">
          {bucket.type} · {formatHoursDecimal(bucket.budgeted_hours_hundredths)}h
          {bucket.rate_cents !== null && ` · ${formatCents(bucket.rate_cents, currency)}/hr`}
        </span>
        <span className={`text-xs ml-2 ${statusColor}`}>{bucket.status}</span>
      </div>
      <div className="flex gap-1">
        {bucket.status === 'active' && (
          <Button variant="secondary" onClick={onClose} disabled={disabled}>
            Close
          </Button>
        )}
        {bucket.status !== 'archived' && (
          <Button variant="secondary" onClick={onArchive} disabled={disabled}>
            Archive
          </Button>
        )}
      </div>
    </div>
  );
}
