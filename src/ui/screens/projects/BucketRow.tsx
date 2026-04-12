import type { Bucket } from '@/schema/types';
import { formatHoursDecimal, formatCents, type CurrencyDisplay } from '@/format/format';
import { Button } from '@/ui/components/Button';

type AllTimeConsumption = {
  consumed_hours_hundredths: number;
  amount_cents: number;
} | undefined;

type Props = {
  bucket: Bucket;
  currency: CurrencyDisplay;
  allTimeConsumption: AllTimeConsumption;
  onClose: () => void;
  onArchive: () => void;
  disabled: boolean;
};

export function BucketRow({
  bucket,
  currency,
  allTimeConsumption,
  onClose,
  onArchive,
  disabled,
}: Props): JSX.Element {
  const statusColor =
    bucket.status === 'active'
      ? 'text-green-400'
      : bucket.status === 'closed'
        ? 'text-yellow-400'
        : 'text-partner-muted';

  const consumed = allTimeConsumption?.consumed_hours_hundredths ?? 0;
  const budgeted = bucket.budgeted_hours_hundredths;
  const remaining = budgeted - consumed;
  const over = remaining < 0;
  const pct = budgeted > 0 ? Math.min(100, Math.round((consumed / budgeted) * 100)) : 0;

  return (
    <div className="py-2 pl-4 border-l-2 border-black/5">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <span className="font-body text-sm">{bucket.name}</span>
          <span className="font-mono text-xs text-partner-muted ml-2">
            {bucket.type}
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
      <div className="mt-1">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className={`font-mono ${over ? 'text-red-400' : 'text-partner-muted'}`}>
            {formatHoursDecimal(consumed)} / {formatHoursDecimal(budgeted)}h used
            {over
              ? ` (${formatHoursDecimal(Math.abs(remaining))}h over)`
              : ` (${formatHoursDecimal(remaining)}h remaining)`}
          </span>
          <span className="font-mono text-partner-muted">{pct}%</span>
        </div>
        <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${over ? 'bg-gradient-to-r from-red-400 to-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'bg-gradient-to-r from-partner-mid to-partner-cyan shadow-[0_0_8px_rgba(107,207,238,0.4)]'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
