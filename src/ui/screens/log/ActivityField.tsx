import { useState } from 'react';
import type { EffortItem, EffortKind } from '@/schema/types';
import { Input } from '@/ui/components/Input';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { EffortKindSelect } from '@/ui/components/EffortKindSelect';
import { FieldFlash, type FlashTone } from './FieldFlash';
import { EffortChips } from './EffortChips';
import type { FormState } from './form-helpers';

type Props = {
  form: FormState;
  setForm: (next: FormState | ((f: FormState) => FormState)) => void;
  flashFields: ReadonlySet<string>;
  nonce: number;
  tone: FlashTone;
};

export function ActivityField(p: Props): JSX.Element {
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
        <FieldFlash
          field="effort"
          flashFields={p.flashFields}
          nonce={p.nonce}
          tone={p.tone}
        >
          <EffortChips
            items={p.form.effort}
            onRemove={removeChip}
            onUpdateCount={updateChipCount}
          />
        </FieldFlash>
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
