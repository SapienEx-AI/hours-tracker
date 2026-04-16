import type { RefObject } from 'react';
import type { BillableStatus, Project } from '@/schema/types';
import { Input } from '@/ui/components/Input';
import { Select } from '@/ui/components/Select';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { Banner } from '@/ui/components/Banner';
import { HoursChips } from '@/ui/components/HoursChips';
import { EffortKindSelect, effortUnitLabel } from '@/ui/components/EffortKindSelect';
import { formatHoursDecimal } from '@/format/format';
import { formatRateDollars, type FormState } from './form-helpers';
import { FieldFlash, type FlashTone } from './FieldFlash';

export type FieldProps = {
  form: FormState;
  setForm: (next: FormState | ((f: FormState) => FormState)) => void;
  flashFields: ReadonlySet<string>;
  nonce: number;
  tone: FlashTone;
};

function wrap(
  field: string,
  p: FieldProps,
  child: React.ReactNode,
): JSX.Element {
  return (
    <FieldFlash
      field={field}
      flashFields={p.flashFields}
      nonce={p.nonce}
      tone={p.tone}
    >
      {child}
    </FieldFlash>
  );
}

export function DateField(p: FieldProps): JSX.Element {
  return (
    <FieldLabel label="Date">
      {wrap(
        'date',
        p,
        <Input
          type="date"
          value={p.form.date}
          onChange={(e) => p.setForm((f) => ({ ...f, date: e.target.value }))}
        />,
      )}
    </FieldLabel>
  );
}

export function ProjectField(
  p: FieldProps & {
    activeProjects: Project[];
    projectRef: RefObject<HTMLSelectElement>;
  },
): JSX.Element {
  return (
    <FieldLabel label="Project">
      {wrap(
        'projectId',
        p,
        <Select
          ref={p.projectRef}
          value={p.form.projectId}
          onChange={(e) =>
            p.setForm((f) => ({ ...f, projectId: e.target.value, bucketId: null }))
          }
        >
          <option value="">— select —</option>
          {p.activeProjects.map((pr) => (
            <option key={pr.id} value={pr.id}>
              {pr.name}
            </option>
          ))}
        </Select>,
      )}
    </FieldLabel>
  );
}

export function ActivityField(p: FieldProps): JSX.Element {
  return (
    <FieldLabel label="Activity">
      <div className="flex gap-2 items-start">
        <div className="flex-1">
          {wrap(
            'effort_kind',
            p,
            <EffortKindSelect
              value={p.form.effort_kind}
              onChange={(k) =>
                p.setForm((f) => ({
                  ...f,
                  effort_kind: k,
                  effort_count: k === null ? null : (f.effort_count ?? 1),
                }))
              }
            />,
          )}
        </div>
        <div className="w-28 shrink-0 flex flex-col gap-0.5">
          {wrap(
            'effort_count',
            p,
            <Input
              type="number"
              min="1"
              max="100"
              step="1"
              disabled={p.form.effort_kind === null}
              value={p.form.effort_count === null ? '' : String(p.form.effort_count)}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                p.setForm((f) => ({
                  ...f,
                  effort_count:
                    e.target.value === '' || Number.isNaN(parsed)
                      ? null
                      : Math.max(1, Math.min(100, parsed)),
                }));
              }}
            />,
          )}
          {p.form.effort_kind !== null && p.form.effort_count !== null && (
            <span className="text-[10px] text-slate-500 font-mono px-1">
              {effortUnitLabel(p.form.effort_kind, p.form.effort_count)}
            </span>
          )}
        </div>
      </div>
    </FieldLabel>
  );
}

export function HoursField(p: FieldProps): JSX.Element {
  return (
    <>
      <FieldLabel label="Hours">
        {wrap(
          'hoursHundredths',
          p,
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={
              p.form.hoursHundredths === 0
                ? ''
                : formatHoursDecimal(p.form.hoursHundredths)
            }
            onChange={(e) =>
              p.setForm((f) => ({
                ...f,
                hoursHundredths: Math.round(parseFloat(e.target.value || '0') * 100),
              }))
            }
          />,
        )}
      </FieldLabel>
      <HoursChips
        onPick={(h) => p.setForm((f) => ({ ...f, hoursHundredths: h }))}
      />
    </>
  );
}

export function BucketField(
  p: FieldProps & { activeBuckets: Project['buckets'] },
): JSX.Element {
  const selectedBucket = p.activeBuckets.find((b) => b.id === p.form.bucketId);
  return (
    <>
      <FieldLabel label="Bucket">
        {wrap(
          'bucketId',
          p,
          <Select
            value={p.form.bucketId ?? ''}
            onChange={(e) =>
              p.setForm((f) => ({ ...f, bucketId: e.target.value || null }))
            }
          >
            <option value="">(none — general billable)</option>
            {p.activeBuckets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.status === 'closed' ? ' (closed)' : ''}
              </option>
            ))}
          </Select>,
        )}
      </FieldLabel>
      {selectedBucket?.status === 'closed' && (
        <Banner variant="warning">
          This bucket is closed. New entries are allowed but may need review — the
          bucket was likely invoiced already.
        </Banner>
      )}
    </>
  );
}

export function StatusField(p: FieldProps): JSX.Element {
  return (
    <FieldLabel label="Status">
      <div className="flex gap-4 font-body text-sm">
        {(['billable', 'non_billable', 'needs_review'] as const).map((s) => (
          <StatusRadio
            key={s}
            value={s}
            currentValue={p.form.status}
            disabled={p.form.bucketId !== null}
            onChange={(next) => p.setForm((f) => ({ ...f, status: next }))}
          />
        ))}
      </div>
    </FieldLabel>
  );
}

export function RateField(p: FieldProps): JSX.Element {
  return (
    <FieldLabel
      label="Rate ($/hr)"
      hint={p.form.rateOverridden ? 'override' : 'inherited'}
    >
      <Input
        type="number"
        step="0.01"
        value={formatRateDollars(p.form.rateCents)}
        onChange={(e) =>
          p.setForm((f) => ({
            ...f,
            rateCents: Math.round(parseFloat(e.target.value || '0') * 100),
            rateOverridden: true,
          }))
        }
      />
    </FieldLabel>
  );
}

export function DescriptionField(p: FieldProps): JSX.Element {
  return (
    <FieldLabel label="Description">
      {wrap(
        'description',
        p,
        <textarea
          value={p.form.description}
          onChange={(e) => p.setForm((f) => ({ ...f, description: e.target.value }))}
          maxLength={500}
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-xl glass-input text-slate-800 font-body text-sm transition-all duration-200 focus:outline-none focus:border-partner-cyan/50 focus:glass-strong focus:glow-focus placeholder:text-slate-500/60"
        />,
      )}
    </FieldLabel>
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
