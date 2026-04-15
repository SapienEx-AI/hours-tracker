import { useMemo } from 'react';
import type { DigestRow } from '@/integrations/adapters/types';
import { DigestRowCard } from './DigestRow';

type Grouped = {
  client: DigestRow[];
  internal: DigestRow[];
  ambiguous: DigestRow[];
};

const SOURCE_ORDER: Record<DigestRow['source'], number> = {
  calendar: 0,
  slack: 1,
  gmail: 2,
};

export function groupRowsForDisplay(rows: readonly DigestRow[]): Grouped {
  const sorted = [...rows].sort((a, b) => {
    const s = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
    if (s !== 0) return s;
    return b.heuristicHoursHundredths - a.heuristicHoursHundredths;
  });
  return {
    client: sorted.filter((r) => r.direction === 'client'),
    internal: sorted.filter((r) => r.direction === 'internal'),
    ambiguous: sorted.filter((r) => r.direction === 'ambiguous'),
  };
}

export type DigestAcceptOverride = {
  hoursHundredths: number;
  projectId: string;
  effortKind: DigestRow['suggestedKind'];
};

export type DigestPanelProps = {
  rows: readonly DigestRow[];
  onAccept: (row: DigestRow, override: DigestAcceptOverride) => Promise<void>;
  projects: Array<{ id: string; name: string }>;
  isLoading: boolean;
  errors?: ReadonlyArray<{ source: DigestRow['source']; message: string }>;
};

export function DigestPanel({
  rows,
  onAccept,
  projects,
  isLoading,
  errors,
}: DigestPanelProps): JSX.Element {
  const grouped = useMemo(() => groupRowsForDisplay(rows), [rows]);

  if (isLoading) {
    return <div className="text-xs text-slate-500">Loading today&apos;s activity…</div>;
  }
  if (rows.length === 0 && (!errors || errors.length === 0)) {
    return <div className="text-xs text-slate-500">No activity captured today.</div>;
  }

  return (
    <div className="space-y-4">
      {errors && errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((err) => (
            <div
              key={err.source}
              className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1"
            >
              {err.source} failed: {err.message}
            </div>
          ))}
        </div>
      )}
      {grouped.client.length > 0 && (
        <div>
          <div className="text-[10px] font-mono uppercase text-slate-500 mb-1">Client</div>
          {grouped.client.map((r) => (
            <DigestRowCard key={r.batchId} row={r} onAccept={onAccept} projects={projects} />
          ))}
        </div>
      )}
      {grouped.internal.length > 0 && (
        <div>
          <div className="text-[10px] font-mono uppercase text-slate-500 mb-1">Internal</div>
          {grouped.internal.map((r) => (
            <DigestRowCard key={r.batchId} row={r} onAccept={onAccept} projects={projects} />
          ))}
        </div>
      )}
      {grouped.ambiguous.length > 0 && (
        <div>
          <div className="text-[10px] font-mono uppercase text-amber-600 mb-1">
            Ambiguous — pick project + kind
          </div>
          {grouped.ambiguous.map((r) => (
            <DigestRowCard
              key={r.batchId}
              row={r}
              onAccept={onAccept}
              projects={projects}
              requiresProject
              requiresKind
            />
          ))}
        </div>
      )}
    </div>
  );
}
