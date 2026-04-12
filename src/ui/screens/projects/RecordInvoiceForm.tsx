import { useState } from 'react';
import type { BucketInvoice } from '@/schema/types';
import { formatHoursDecimal } from '@/format/format';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { FieldLabel } from '@/ui/components/FieldLabel';

type Props = {
  uninvoicedHours: number;
  uninvoicedAmount: number;
  onRecord: (invoice: BucketInvoice) => void;
  onCancel: () => void;
  disabled: boolean;
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function RecordInvoiceForm({ uninvoicedHours, uninvoicedAmount, onRecord, onCancel, disabled }: Props): JSX.Element {
  const [date, setDate] = useState(todayISO());
  const [hours, setHours] = useState(formatHoursDecimal(uninvoicedHours));
  const [amountDollars, setAmountDollars] = useState((uninvoicedAmount / 100).toString());
  const [note, setNote] = useState('');

  function handleRecord() {
    onRecord({
      date,
      hours_hundredths: Math.round(parseFloat(hours || '0') * 100),
      amount_cents: Math.round(parseFloat(amountDollars || '0') * 100),
      note,
    });
  }

  const hoursVal = parseFloat(hours || '0');
  const canRecord = hoursVal > 0 && parseFloat(amountDollars || '0') >= 0;

  return (
    <div className="p-3 rounded-xl glass flex flex-col gap-2 mt-2">
      <div className="font-body text-xs font-bold uppercase tracking-wider text-slate-400">
        Record Invoice
      </div>
      <div className="text-xs text-slate-500 mb-1">
        {formatHoursDecimal(uninvoicedHours)}h uninvoiced (${(uninvoicedAmount / 100).toFixed(2)})
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FieldLabel label="Invoice date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FieldLabel>
        <FieldLabel label="Hours invoiced">
          <Input type="number" step="0.01" value={hours} onChange={(e) => setHours(e.target.value)} />
        </FieldLabel>
        <FieldLabel label="Amount ($)">
          <Input type="number" step="0.01" value={amountDollars} onChange={(e) => setAmountDollars(e.target.value)} />
        </FieldLabel>
        <FieldLabel label="Reference (e.g. QBO #)" hint="optional">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="QBO #1234" />
        </FieldLabel>
      </div>
      <div className="flex gap-2 mt-1">
        <Button onClick={handleRecord} disabled={!canRecord || disabled}>Record</Button>
        <Button variant="secondary" onClick={onCancel} disabled={disabled}>Cancel</Button>
      </div>
    </div>
  );
}
