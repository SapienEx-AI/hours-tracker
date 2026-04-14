import type { RefObject } from 'react';
import type { BillableStatus, Project } from '@/schema/types';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Select } from '@/ui/components/Select';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { Banner } from '@/ui/components/Banner';
import { HoursChips } from '@/ui/components/HoursChips';
import { formatHoursDecimal } from '@/format/format';
import { formatRateDollars, type FormState } from './form-helpers';

type Props = {
  form: FormState;
  setForm: (next: FormState | ((f: FormState) => FormState)) => void;
  activeProjects: Project[];
  projectRef: RefObject<HTMLSelectElement>;
  toast: string | null;
  prefillHint: string | null;
  onClearPrefill: () => void;
  mutationError: Error | null;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
};

export function LogForm(props: Props): JSX.Element {
  const { form, setForm, activeProjects, projectRef, toast, prefillHint, onClearPrefill,
    mutationError, saving, canSave, onSave } = props;

  const selectedProject = activeProjects.find((p) => p.id === form.projectId);
  const activeBuckets = selectedProject?.buckets.filter((b) => b.status !== 'archived') ?? [];
  const selectedBucket = activeBuckets.find((b) => b.id === form.bucketId);

  return (
    <div className="flex flex-col gap-4 flex-1 max-w-[480px]">
      <h1 className="font-display text-2xl">Log hours</h1>
      {toast && <Banner variant="success">{toast}</Banner>}

      <FieldLabel label="Date">
        <Input
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
        />
      </FieldLabel>

      <FieldLabel label="Project">
        <Select
          ref={projectRef}
          value={form.projectId}
          onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value, bucketId: null }))}
        >
          <option value="">— select —</option>
          {activeProjects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
      </FieldLabel>

      <FieldLabel label="Hours">
        <Input
          type="number"
          step="0.01"
          min="0.01"
          value={form.hoursHundredths === 0 ? '' : formatHoursDecimal(form.hoursHundredths)}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              hoursHundredths: Math.round(parseFloat(e.target.value || '0') * 100),
            }))
          }
        />
      </FieldLabel>
      <HoursChips onPick={(h) => setForm((f) => ({ ...f, hoursHundredths: h }))} />

      <FieldLabel label="Bucket">
        <Select
          value={form.bucketId ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, bucketId: e.target.value || null }))}
        >
          <option value="">(none — general billable)</option>
          {activeBuckets.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}{b.status === 'closed' ? ' (closed)' : ''}
            </option>
          ))}
        </Select>
      </FieldLabel>
      {selectedBucket?.status === 'closed' && (
        <Banner variant="warning">
          This bucket is closed. New entries are allowed but may need review — the bucket was
          likely invoiced already.
        </Banner>
      )}

      <FieldLabel label="Status">
        <div className="flex gap-4 font-body text-sm">
          {(['billable', 'non_billable', 'needs_review'] as const).map((s) => (
            <StatusRadio
              key={s}
              value={s}
              currentValue={form.status}
              disabled={form.bucketId !== null}
              onChange={(next) => setForm((f) => ({ ...f, status: next }))}
            />
          ))}
        </div>
      </FieldLabel>

      <FieldLabel label="Rate ($/hr)" hint={form.rateOverridden ? 'override' : 'inherited'}>
        <Input
          type="number"
          step="0.01"
          value={formatRateDollars(form.rateCents)}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              rateCents: Math.round(parseFloat(e.target.value || '0') * 100),
              rateOverridden: true,
            }))
          }
        />
      </FieldLabel>

      <FieldLabel label="Description">
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          maxLength={500}
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-xl glass-input text-slate-800 font-body text-sm transition-all duration-200 focus:outline-none focus:border-partner-cyan/50 focus:glass-strong focus:glow-focus placeholder:text-slate-500/60"
        />
      </FieldLabel>
      {prefillHint && (
        <div className="text-xs text-slate-500">
          Prefilled from <span className="italic">{prefillHint}</span>{' '}
          <button type="button" onClick={onClearPrefill} className="underline text-slate-600">
            clear
          </button>
        </div>
      )}

      {mutationError && <Banner variant="error">{mutationError.message}</Banner>}

      <Button onClick={onSave} disabled={saving || !canSave}>
        {saving ? 'Saving…' : 'Save (⌘↵)'}
      </Button>
    </div>
  );
}

function StatusRadio({
  value,
  currentValue,
  disabled,
  onChange,
}: {
  value: BillableStatus;
  currentValue: BillableStatus;
  disabled: boolean;
  onChange: (v: BillableStatus) => void;
}): JSX.Element {
  return (
    <label className={`flex items-center gap-1 ${disabled ? 'opacity-50' : ''}`}>
      <input
        type="radio"
        name="status"
        value={value}
        checked={currentValue === value}
        onChange={() => onChange(value)}
        disabled={disabled}
      />
      {value.replace('_', '-')}
    </label>
  );
}
