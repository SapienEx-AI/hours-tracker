import { useState } from 'react';
import { useMonthEntries } from '@/data/hooks/use-month-entries';
import { computeDrift, type DriftDiff } from '@/calc';
import type { Snapshot, Partner } from '@/schema/types';
import { formatCents, formatHours } from '@/format/format';
import { DriftDiffView } from './DriftDiff';

type Props = { snapshot: Snapshot; partner: Partner };

export function SnapshotRow({ snapshot, partner }: Props): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [drift, setDrift] = useState<DriftDiff | null>(null);
  const entries = useMonthEntries(snapshot.month);
  const currency = {
    currency_symbol: partner.currency_symbol,
    currency_display_suffix: partner.currency_display_suffix,
  };

  async function toggle() {
    if (!expanded && entries.data && drift === null) {
      const d = await computeDrift(snapshot, entries.data.entries);
      setDrift(d);
    }
    setExpanded((v) => !v);
  }

  const drifted = drift?.drifted ?? null;
  return (
    <div className="glass rounded-xl p-4">
      <button type="button" onClick={toggle} className="w-full flex items-center justify-between">
        <div className="text-left">
          <div className="font-display font-bold">{snapshot.month}</div>
          <div className="text-xs text-slate-500">closed {snapshot.closed_at.slice(0, 10)}</div>
        </div>
        <div className="text-right text-sm">
          <div>
            {formatHours(snapshot.totals.billable_hours_hundredths)} ·{' '}
            {formatCents(snapshot.totals.billable_amount_cents, currency)}
          </div>
          {drifted === true && (
            <div className="text-amber-700 text-xs font-semibold">⚠ drift detected</div>
          )}
          {drifted === false && <div className="text-emerald-700 text-xs">✓ consistent</div>}
          {drifted === null && (
            <div className="text-slate-400 text-xs">{expanded ? 'computing…' : 'click to check'}</div>
          )}
        </div>
      </button>
      {expanded && drift && <DriftDiffView drift={drift} />}
    </div>
  );
}
