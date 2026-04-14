import { useState } from 'react';
import type { Entry } from '@/schema/types';
import { Select } from '@/ui/components/Select';

type Props = {
  entry: Entry;
  buckets: Array<{ id: string; name: string; status: string }>;
  onAssign: (entryId: string, bucketId: string) => void;
  busy: boolean;
};

export function BucketCell({ entry, buckets, onAssign, busy }: Props): JSX.Element {
  const [picking, setPicking] = useState(false);

  if (entry.bucket_id) {
    const bucket = buckets.find((b) => b.id === entry.bucket_id);
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700">
        {bucket?.name ?? entry.bucket_id}
      </span>
    );
  }

  if (picking) {
    return (
      <Select
        className="!py-1 !px-2 !text-xs !w-36"
        autoFocus
        value=""
        onChange={(e) => {
          if (e.target.value) {
            onAssign(entry.id, e.target.value);
          }
          setPicking(false);
        }}
        onBlur={() => setPicking(false)}
        disabled={busy}
      >
        <option value="">select bucket...</option>
        {buckets
          .filter((b) => b.status !== 'archived')
          .map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
      </Select>
    );
  }

  return (
    <button
      type="button"
      onClick={(ev) => {
        ev.stopPropagation();
        setPicking(true);
      }}
      className="text-xs text-slate-400 hover:text-sky-500 transition-colors"
    >
      + assign
    </button>
  );
}
