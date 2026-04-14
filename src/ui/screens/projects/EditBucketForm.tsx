import { useState } from 'react';
import type { Bucket } from '@/schema/types';
import { formatHoursDecimal } from '@/format/format';
import { Input } from '@/ui/components/Input';
import { Select } from '@/ui/components/Select';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { Button } from '@/ui/components/Button';

function centsToDollarsString(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const frac = cents - whole * 100;
  return `${whole}.${frac.toString().padStart(2, '0')}`;
}

export type EditBucketUpdates = {
  name: string;
  budgeted_hours_hundredths: number;
  rate_cents: number | null;
  status: 'active' | 'closed';
  notes: string;
};

type Props = {
  bucket: Bucket;
  onSave: (updates: EditBucketUpdates, changes: string[]) => void;
  onCancel: () => void;
  disabled: boolean;
};

export function EditBucketForm({ bucket, onSave, onCancel, disabled }: Props): JSX.Element {
  const [name, setName] = useState(bucket.name);
  const [budgetedStr, setBudgetedStr] = useState(formatHoursDecimal(bucket.budgeted_hours_hundredths));
  const [rateStr, setRateStr] = useState(bucket.rate_cents === null ? '' : centsToDollarsString(bucket.rate_cents));
  const [status, setStatus] = useState<'active' | 'closed'>(
    bucket.status === 'archived' ? 'closed' : bucket.status,
  );
  const [notes, setNotes] = useState(bucket.notes);

  function submit() {
    const budgeted = Math.round(parseFloat(budgetedStr || '0') * 100);
    const rate = rateStr === '' ? null : Math.round(parseFloat(rateStr) * 100);
    const changes: string[] = [];
    if (name !== bucket.name) changes.push(`name "${bucket.name}" → "${name}"`);
    if (budgeted !== bucket.budgeted_hours_hundredths) {
      changes.push(`budgeted ${formatHoursDecimal(bucket.budgeted_hours_hundredths)}h → ${formatHoursDecimal(budgeted)}h`);
    }
    if (rate !== bucket.rate_cents) {
      changes.push(`rate ${bucket.rate_cents === null ? 'inherited' : bucket.rate_cents} → ${rate === null ? 'inherited' : rate}`);
    }
    if (status !== bucket.status && bucket.status !== 'archived') {
      changes.push(`status ${bucket.status} → ${status}`);
    }
    if (notes !== bucket.notes) changes.push('notes updated');
    onSave(
      { name, budgeted_hours_hundredths: budgeted, rate_cents: rate, status, notes },
      changes,
    );
  }

  return (
    <div className="mt-2 p-3 glass rounded-xl flex flex-col gap-2">
      <FieldLabel label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </FieldLabel>
      <FieldLabel label="Budgeted hours">
        <Input type="number" step="0.01" min="0" value={budgetedStr} onChange={(e) => setBudgetedStr(e.target.value)} />
      </FieldLabel>
      <FieldLabel label="Rate ($/hr, empty = inherited)">
        <Input type="number" step="0.01" value={rateStr} onChange={(e) => setRateStr(e.target.value)} />
      </FieldLabel>
      <FieldLabel label="Status">
        <Select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'closed')}>
          <option value="active">active</option>
          <option value="closed">closed</option>
        </Select>
      </FieldLabel>
      <FieldLabel label="Notes">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FieldLabel>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={disabled}>Save</Button>
        <Button variant="secondary" onClick={onCancel} disabled={disabled}>Cancel</Button>
      </div>
    </div>
  );
}
