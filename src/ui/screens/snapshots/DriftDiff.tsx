import type { DriftDiff } from '@/calc';

export function DriftDiffView({ drift }: { drift: DriftDiff }): JSX.Element {
  if (!drift.drifted) {
    return <div className="mt-3 text-sm text-emerald-700">Hashes match. Snapshot is current.</div>;
  }
  return (
    <div className="mt-3 text-xs font-mono flex flex-col gap-2">
      <div className="text-slate-500">
        expected {drift.expectedHash.slice(0, 16)}… · actual {drift.actualHash.slice(0, 16)}…
      </div>
      {drift.added.length > 0 && (
        <div>
          <div className="text-emerald-700 font-semibold">+ added ({drift.added.length})</div>
          {drift.added.slice(0, 20).map((e) => (
            <div key={e.id} className="text-emerald-700">{e.id}</div>
          ))}
        </div>
      )}
      {drift.removed.length > 0 && (
        <div>
          <div className="text-red-700 font-semibold">− removed ({drift.removed.length})</div>
          {drift.removed.slice(0, 20).map((id) => (
            <div key={id} className="text-red-700">{id}</div>
          ))}
        </div>
      )}
      {drift.changed.length > 0 && (
        <div>
          <div className="text-amber-700 font-semibold">~ possibly changed ({drift.changed.length})</div>
          {drift.changed.slice(0, 20).map((e) => (
            <div key={e.id} className="text-amber-700">{e.id}</div>
          ))}
        </div>
      )}
    </div>
  );
}
