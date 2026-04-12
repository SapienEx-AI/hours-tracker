import { useState } from 'react';
import type { BucketType } from '@/schema/types';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Select } from '@/ui/components/Select';
import { FieldLabel } from '@/ui/components/FieldLabel';

const BUCKET_TYPES: Array<{ value: BucketType; label: string }> = [
  { value: 'hour_block', label: 'Hour Block (5/10/20h sold)' },
  { value: 'discovery', label: 'Discovery (~15h)' },
  { value: 'arch_tl', label: 'Tech Build — Architecture/TL' },
  { value: 'dev', label: 'Tech Build — Dev' },
  { value: 'custom', label: 'Custom' },
];

type Props = {
  projectId: string;
  onAdd: (bucket: {
    id: string;
    type: BucketType;
    name: string;
    budgeted_hours: number;
    rate_cents: number | null;
  }) => void;
  disabled: boolean;
};

export function AddBucketForm({ projectId, onAdd, disabled }: Props): JSX.Element {
  const [bucketId, setBucketId] = useState('');
  const [type, setType] = useState<BucketType>('hour_block');
  const [name, setName] = useState('');
  const [budgetedHours, setBudgetedHours] = useState('');
  const [rateDollars, setRateDollars] = useState('');
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <Button variant="secondary" onClick={() => setExpanded(true)}>
        + Add bucket
      </Button>
    );
  }

  function handleAdd() {
    const budgeted = Math.round(parseFloat(budgetedHours || '0') * 100);
    const rate = rateDollars.trim() ? Math.round(parseFloat(rateDollars) * 100) : null;
    onAdd({ id: bucketId, type, name, budgeted_hours: budgeted, rate_cents: rate });
    setBucketId('');
    setName('');
    setBudgetedHours('');
    setRateDollars('');
    setExpanded(false);
  }

  const canAdd = !!bucketId && !!name && parseFloat(budgetedHours || '0') > 0;

  return (
    <div className="p-3 rounded-xl glass flex flex-col gap-2">
      <div className="font-body text-xs font-semibold uppercase tracking-wide text-partner-muted">
        New bucket for {projectId}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FieldLabel label="Bucket ID">
          <Input
            value={bucketId}
            placeholder={`${projectId}-block-1`}
            onChange={(e) => setBucketId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          />
        </FieldLabel>
        <FieldLabel label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as BucketType)}>
            {BUCKET_TYPES.map((bt) => (
              <option key={bt.value} value={bt.value}>{bt.label}</option>
            ))}
          </Select>
        </FieldLabel>
        <FieldLabel label="Display name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FieldLabel>
        <FieldLabel label="Budgeted hours">
          <Input type="number" step="0.25" min="0.25" value={budgetedHours}
            onChange={(e) => setBudgetedHours(e.target.value)} />
        </FieldLabel>
        <FieldLabel label="Rate override ($/hr)" hint="Leave empty to inherit project/global rate">
          <Input type="number" step="0.01" value={rateDollars}
            onChange={(e) => setRateDollars(e.target.value)} placeholder="inherit" />
        </FieldLabel>
      </div>
      <div className="flex gap-2">
        <Button onClick={handleAdd} disabled={!canAdd || disabled}>Add bucket</Button>
        <Button variant="secondary" onClick={() => setExpanded(false)}>Cancel</Button>
      </div>
    </div>
  );
}
