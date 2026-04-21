import type { EffortItem, EffortKind } from '@/schema/types';
import { EFFORT_KIND_LABEL } from '@/ui/components/EffortKindSelect';

type Props = {
  items: EffortItem[];
  onRemove: (kind: EffortKind) => void;
  onUpdateCount: (kind: EffortKind, count: number) => void;
};

export function EffortChips({ items, onRemove, onUpdateCount }: Props): JSX.Element {
  if (items.length === 0) {
    return (
      <div className="px-3 py-2 rounded-xl border border-dashed border-slate-300/60 text-xs text-slate-400 italic">
        No activities tagged.
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <EffortChip
          key={item.kind}
          item={item}
          onRemove={() => onRemove(item.kind)}
          onUpdateCount={(c) => onUpdateCount(item.kind, c)}
        />
      ))}
    </div>
  );
}

function EffortChip({
  item,
  onRemove,
  onUpdateCount,
}: {
  item: EffortItem;
  onRemove: () => void;
  onUpdateCount: (c: number) => void;
}): JSX.Element {
  return (
    <span
      role="group"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs border border-slate-200"
      onKeyDown={(e) => {
        if (e.key === 'Backspace') {
          e.preventDefault();
          onRemove();
        }
      }}
      tabIndex={0}
    >
      <input
        type="number"
        min="0"
        max="100"
        value={item.count}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (Number.isNaN(n) || n <= 0) onRemove();
          else onUpdateCount(Math.min(100, n));
        }}
        className="w-8 bg-transparent text-xs font-mono tabular-nums text-slate-800 focus:outline-none"
      />
      <span>·</span>
      <span className="truncate max-w-[120px]">{EFFORT_KIND_LABEL[item.kind]}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${EFFORT_KIND_LABEL[item.kind]}`}
        className="text-slate-400 hover:text-red-500 px-1"
      >
        ×
      </button>
    </span>
  );
}
