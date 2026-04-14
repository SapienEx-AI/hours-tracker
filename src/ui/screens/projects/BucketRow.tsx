import { useState } from 'react';
import type { Bucket, BucketInvoice } from '@/schema/types';
import { formatHoursDecimal, formatCents, type CurrencyDisplay } from '@/format/format';
import { sumHundredths, sumCents, subCents } from '@/calc';
import { Button } from '@/ui/components/Button';
import { RecordInvoiceForm } from './RecordInvoiceForm';
import { EditBucketForm, type EditBucketUpdates } from './EditBucketForm';

type AllTimeConsumption = {
  consumed_hours_hundredths: number;
  amount_cents: number;
} | undefined;

function computeInvoiceStatus(bucket: Bucket, consumption: AllTimeConsumption) {
  const consumed = consumption?.consumed_hours_hundredths ?? 0;
  const consumedAmount = consumption?.amount_cents ?? 0;
  const invoices = bucket.invoices ?? [];
  const invoicedHours = invoices.length > 0 ? sumHundredths(invoices.map((i) => i.hours_hundredths)) : 0;
  const invoicedAmount = invoices.length > 0 ? sumCents(invoices.map((i) => i.amount_cents)) : 0;
  const budgeted = bucket.budgeted_hours_hundredths;
  return {
    consumed, consumedAmount, invoicedHours, invoicedAmount,
    uninvoicedHours: subCents(consumed, invoicedHours), // reusing subCents for integer subtraction
    uninvoicedAmount: subCents(consumedAmount, invoicedAmount),
    budgeted,
    remaining: subCents(budgeted, consumed),
    over: consumed > budgeted,
    pct: budgeted > 0 ? Math.min(100, Math.round(divForDisplay(consumed, budgeted) * 100)) : 0,
    invoices,
  };
}

function divForDisplay(a: number, b: number): number {
  return a / b;
}

function ProgressBar({ pct, over }: { pct: number; over: boolean }): JSX.Element {
  const barColor = over
    ? 'bg-gradient-to-r from-red-400 to-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
    : 'bg-gradient-to-r from-partner-mid to-partner-cyan shadow-[0_0_8px_rgba(107,207,238,0.4)]';
  return (
    <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function BucketActions({
  bucket, canInvoice, editing, disabled, onInvoice, onEditToggle, onClose, onArchive,
}: {
  bucket: Bucket;
  canInvoice: boolean;
  editing: boolean;
  disabled: boolean;
  onInvoice: () => void;
  onEditToggle: () => void;
  onClose: () => void;
  onArchive: () => void;
}): JSX.Element {
  const isArchived = bucket.status === 'archived';
  const isActive = bucket.status === 'active';
  return (
    <div className="flex gap-1">
      {canInvoice && (
        <Button variant="secondary" onClick={onInvoice} disabled={disabled}>
          Record invoice
        </Button>
      )}
      {!isArchived && (
        <Button variant="secondary" onClick={onEditToggle} disabled={disabled}>
          {editing ? 'Close edit' : 'Edit'}
        </Button>
      )}
      {isActive && (
        <Button variant="secondary" onClick={onClose} disabled={disabled}>Close</Button>
      )}
      {!isArchived && (
        <Button variant="secondary" onClick={onArchive} disabled={disabled}>Archive</Button>
      )}
    </div>
  );
}

type Props = {
  bucket: Bucket;
  currency: CurrencyDisplay;
  allTimeConsumption: AllTimeConsumption;
  onClose: () => void;
  onArchive: () => void;
  onRecordInvoice: (invoice: BucketInvoice) => void;
  onEdit: (updates: EditBucketUpdates, changes: string[]) => void;
  disabled: boolean;
};

export function BucketRow({
  bucket,
  currency,
  allTimeConsumption,
  onClose,
  onArchive,
  onRecordInvoice,
  onEdit,
  disabled,
}: Props): JSX.Element {
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [editing, setEditing] = useState(false);

  const statusColor =
    bucket.status === 'active'
      ? 'text-green-400'
      : bucket.status === 'closed'
        ? 'text-yellow-400'
        : 'text-slate-500';

  const inv = computeInvoiceStatus(bucket, allTimeConsumption);
  const { consumed, budgeted, remaining, over, pct, invoicedHours, invoicedAmount, uninvoicedHours, uninvoicedAmount, invoices } = inv;

  return (
    <div className="py-3 pl-4 border-l-2 border-black/5">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <span className="font-body text-sm font-medium">{bucket.name}</span>
          <span className="font-mono text-xs text-slate-500 ml-2">
            {bucket.type}
            {bucket.rate_cents !== null && ` · ${formatCents(bucket.rate_cents, currency)}/hr`}
          </span>
          <span className={`text-xs ml-2 ${statusColor}`}>{bucket.status}</span>
        </div>
        <BucketActions
          bucket={bucket}
          canInvoice={consumed > 0 && uninvoicedHours > 0}
          editing={editing}
          disabled={disabled}
          onInvoice={() => setShowInvoiceForm(true)}
          onEditToggle={() => setEditing((v) => !v)}
          onClose={onClose}
          onArchive={onArchive}
        />
      </div>

      {/* Progress bar */}
      <div className="mt-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className={`font-mono ${over ? 'text-red-400' : 'text-slate-500'}`}>
            {formatHoursDecimal(consumed)} / {formatHoursDecimal(budgeted)}h used
            {over ? ` (${formatHoursDecimal(Math.abs(remaining))}h over)` : ` (${formatHoursDecimal(remaining)}h remaining)`}
          </span>
          <span className="font-mono text-slate-400">{pct}%</span>
        </div>
        <ProgressBar pct={pct} over={over} />
      </div>

      {/* Invoice status */}
      {consumed > 0 && (
        <div className="mt-2 flex items-center gap-4 text-xs">
          <span className="text-slate-500">
            Invoiced: <span className="font-mono font-medium text-slate-700">{formatHoursDecimal(invoicedHours)}h</span>
            {invoicedAmount > 0 && <span className="font-mono"> · {formatCents(invoicedAmount, currency)}</span>}
          </span>
          {uninvoicedHours > 0 ? (
            <span className="text-amber-600 font-medium">
              Uninvoiced: <span className="font-mono">{formatHoursDecimal(uninvoicedHours)}h · {formatCents(uninvoicedAmount, currency)}</span>
            </span>
          ) : (
            <span className="text-emerald-600 font-medium">Fully invoiced</span>
          )}
        </div>
      )}

      {/* Invoice history */}
      {invoices.length > 0 && (
        <div className="mt-2 pl-2 border-l border-black/5">
          {invoices.map((inv, i) => (
            <div key={`${inv.date}-${i}`} className="text-[11px] text-slate-400 py-0.5">
              {inv.date} — {formatHoursDecimal(inv.hours_hundredths)}h · {formatCents(inv.amount_cents, currency)}
              {inv.note && <span className="ml-1 text-slate-500">({inv.note})</span>}
            </div>
          ))}
        </div>
      )}

      {/* Record invoice form */}
      {showInvoiceForm && (
        <RecordInvoiceForm
          uninvoicedHours={uninvoicedHours}
          uninvoicedAmount={uninvoicedAmount}
          onRecord={(inv) => {
            onRecordInvoice(inv);
            setShowInvoiceForm(false);
          }}
          onCancel={() => setShowInvoiceForm(false)}
          disabled={disabled}
        />
      )}

      {/* Edit bucket form */}
      {editing && (
        <EditBucketForm
          bucket={bucket}
          onSave={(u, c) => {
            onEdit(u, c);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          disabled={disabled}
        />
      )}
    </div>
  );
}
