import type { EffortKind } from '@/schema/types';
import { Input } from '@/ui/components/Input';
import { FieldLabel } from '@/ui/components/FieldLabel';
import {
  EffortKindSelect,
  effortUnitLabel,
} from '@/ui/components/EffortKindSelect';

type Props = {
  effortKind: EffortKind | null;
  effortCount: number | null;
  onKindChange: (k: EffortKind | null) => void;
  onCountChange: (n: number | null) => void;
};

export function EditActivityField({
  effortKind,
  effortCount,
  onKindChange,
  onCountChange,
}: Props): JSX.Element {
  return (
    <FieldLabel label="Activity">
      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <EffortKindSelect
            value={effortKind}
            onChange={(k) => {
              onKindChange(k);
              onCountChange(k === null ? null : (effortCount ?? 1));
            }}
          />
        </div>
        <div className="w-28 shrink-0 flex flex-col gap-0.5">
          <Input
            type="number"
            min="1"
            max="100"
            step="1"
            disabled={effortKind === null}
            value={effortCount === null ? '' : String(effortCount)}
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10);
              if (e.target.value === '' || Number.isNaN(parsed)) {
                onCountChange(null);
              } else {
                onCountChange(Math.max(1, Math.min(100, parsed)));
              }
            }}
          />
          {effortKind !== null && effortCount !== null && (
            <span className="text-[10px] text-slate-500 font-mono px-1">
              {effortUnitLabel(effortKind, effortCount)}
            </span>
          )}
        </div>
      </div>
    </FieldLabel>
  );
}
