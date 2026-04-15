import { useState } from 'react';
import type { DigestRow } from '@/integrations/adapters/types';
import type { EffortKind } from '@/schema/types';
import { EffortKindSelect } from '@/ui/components/EffortKindSelect';
import type { DigestAcceptOverride } from './DigestPanel';

export type DigestRowCardProps = {
  row: DigestRow;
  onAccept: (row: DigestRow, override: DigestAcceptOverride) => Promise<void>;
  projects: Array<{ id: string; name: string }>;
  requiresProject?: boolean;
  requiresKind?: boolean;
};

export function DigestRowCard({
  row,
  onAccept,
  projects,
  requiresProject,
  requiresKind,
}: DigestRowCardProps): JSX.Element {
  const [projectId, setProjectId] = useState<string>(row.suggestedProjectId ?? '');
  const [effortKind, setEffortKind] = useState<EffortKind>(row.suggestedKind);
  const [hoursHundredths, setHoursHundredths] = useState<number>(row.heuristicHoursHundredths);
  const [isAccepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled =
    (requiresProject && !projectId) || (requiresKind && !effortKind) || isAccepting;

  const handleAccept = async (): Promise<void> => {
    setAccepting(true);
    setError(null);
    try {
      await onAccept(row, { hoursHundredths, projectId, effortKind });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded px-2 py-1.5 mb-1.5 text-xs">
      <div className="flex items-center gap-2 justify-between">
        <span className="truncate">{row.label}</span>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="number"
            className="w-14 border border-slate-300 px-1 py-0.5 text-right font-mono"
            step={1}
            min={1}
            value={hoursHundredths}
            onChange={(e) => setHoursHundredths(Math.max(1, parseInt(e.target.value || '1', 10)))}
          />
          <span className="text-[10px] font-mono text-slate-400">h/100</span>
          <button
            type="button"
            disabled={disabled}
            onClick={handleAccept}
            className="px-2 py-0.5 border border-slate-300 rounded text-xs disabled:opacity-50"
          >
            {isAccepting ? '…' : 'Accept'}
          </button>
        </div>
      </div>
      {(requiresProject || requiresKind) && (
        <div className="flex items-center gap-2 mt-1">
          {requiresProject && (
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={`border ${
                !projectId ? 'border-red-400' : 'border-slate-300'
              } text-xs px-1 py-0.5`}
            >
              <option value="">Pick project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          {requiresKind && (
            <EffortKindSelect
              value={effortKind}
              onChange={(k) => {
                if (k !== null) setEffortKind(k);
              }}
            />
          )}
        </div>
      )}
      {error !== null && <div className="text-[10px] text-red-600 mt-1">{error}</div>}
    </div>
  );
}
