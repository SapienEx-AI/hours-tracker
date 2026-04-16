import { useState, type RefObject } from 'react';
import type { BillableStatus, EffortItem, EffortKind, Project } from '@/schema/types';
import { Input } from '@/ui/components/Input';
import { Select } from '@/ui/components/Select';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { Banner } from '@/ui/components/Banner';
import { HoursChips } from '@/ui/components/HoursChips';
import { EffortKindSelect } from '@/ui/components/EffortKindSelect';
import { formatHoursDecimal } from '@/format/format';
import { formatRateDollars, type FormState } from './form-helpers';
import { FieldFlash, type FlashTone } from './FieldFlash';
import { EffortChips } from './EffortChips';

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
  const [pendingKind, setPendingKind] = useState<EffortKind | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(1);

  function addChip() {
    if (pendingKind === null) return;
    p.setForm((f) => {
      const existing = f.effort.find((x) => x.kind === pendingKind);
      const next: EffortItem[] = existing
        ? f.effort.map((x) =>
            x.kind === pendingKind
              ? { kind: x.kind, count: Math.min(100, x.count + pendingCount) }
              : x,
          )
        : [...f.effort, { kind: pendingKind, count: pendingCount }].sort((a, b) =>
            a.kind.localeCompare(b.kind),
          );
      return { ...f, effort: next };
    });
    setPendingKind(null);
    setPendingCount(1);
  }

  function removeChip(kind: EffortKind) {
    p.setForm((f) => ({ ...f, effort: f.effort.filter((x) => x.kind !== kind) }));
  }

  function updateChipCount(kind: EffortKind, count: number) {
    p.setForm((f) => ({
      ...f,
      effort: f.effort.map((x) => (x.kind === kind ? { ...x, count } : x)),
    }));
  }

  return (
    <FieldLabel label="Activity">
      <div className="flex flex-col gap-2">
        {wrap(
          'effort',
          p,
          <EffortChips
            items={p.form.effort}
            onRemove={removeChip}
            onUpdateCount={updateChipCount}
          />,
        )}
        <div className="flex gap-2">
          <div className="flex-1">
            <EffortKindSelect value={pendingKind} onChange={setPendingKind} />
          </div>
          <div className="w-16 shrink-0">
            <Input
              type="number"
              min="1"
              max="100"
              step="1"
              value={String(pendingCount)}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setPendingCount(Number.isNaN(n) ? 1 : Math.max(1, Math.min(100, n)));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addChip();
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={addChip}
            disabled={pendingKind === null}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-partner-mid text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
        <p className="text-[10px] text-slate-500 italic leading-snug">
          Hours apply to the whole block, not split per activity.
        </p>
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
