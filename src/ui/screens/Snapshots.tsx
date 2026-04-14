import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useMonthEntries } from '@/data/hooks/use-month-entries';
import { useProjects } from '@/data/hooks/use-projects';
import { useRates } from '@/data/hooks/use-rates';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useSnapshotsList } from '@/data/hooks/use-snapshots-list';
import { useAuthStore } from '@/store/auth-store';
import { splitRepoPath } from '@/data/octokit-client';
import { writeSnapshot } from '@/data/snapshots-repo';
import { computeMonthTotals, hashEntries } from '@/calc';
import type { Partner, Snapshot } from '@/schema/types';
import { formatCents, formatHours } from '@/format/format';
import { Banner } from '@/ui/components/Banner';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { qk } from '@/data/query-keys';
import { SnapshotRow } from './snapshots/SnapshotRow';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function Snapshots({ partner }: { partner: Partner }): JSX.Element {
  const [month, setMonth] = useState(currentMonth);
  const entries = useMonthEntries(month);
  const projects = useProjects();
  const rates = useRates();
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const queryClient = useQueryClient();
  const snaps = useSnapshotsList();

  const currency = {
    currency_symbol: partner.currency_symbol,
    currency_display_suffix: partner.currency_display_suffix,
  };

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      if (!entries.data || !projects.data || !rates.data) throw new Error('Data not loaded');
      const { owner, repo } = splitRepoPath(dataRepo);
      const totals = computeMonthTotals(
        { entries: entries.data.entries, projects: projects.data, rates: rates.data },
        month,
      );
      const sourceHash = await hashEntries(entries.data.entries);
      const snap: Snapshot = {
        schema_version: 1,
        month,
        closed_at: new Date().toISOString(),
        closed_at_commit_sha: '0000000',
        source_hash: sourceHash,
        totals: {
          total_hours_hundredths: totals.total_hours_hundredths,
          billable_hours_hundredths: totals.billable_hours_hundredths,
          non_billable_hours_hundredths: totals.non_billable_hours_hundredths,
          needs_review_hours_hundredths: totals.needs_review_hours_hundredths,
          billable_amount_cents: totals.billable_amount_cents,
        },
        per_project: totals.per_project,
        entry_ids: entries.data.entries.map((e) => e.id),
      };
      await writeSnapshot(octokit, { owner, repo, snapshot: snap });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.snapshot(dataRepo ?? 'none', month),
      });
      queryClient.invalidateQueries({
        queryKey: qk.snapshotsList(dataRepo ?? 'none'),
      });
    },
  });

  const ready = !!entries.data && !!projects.data && !!rates.data;
  const totals = ready
    ? computeMonthTotals(
        {
          entries: entries.data!.entries,
          projects: projects.data!,
          rates: rates.data!,
        },
        month,
      )
    : null;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <h1 className="font-display text-2xl">Snapshots</h1>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg">Close a month</h2>
        <FieldLabel label="Month to close">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </FieldLabel>
        {totals && (
          <div className="p-4 rounded-2xl glass font-mono text-sm">
            <div>
              Billable: {formatHours(totals.billable_hours_hundredths)} ·{' '}
              {formatCents(totals.billable_amount_cents, currency)}
            </div>
            <div>Non-billable: {formatHours(totals.non_billable_hours_hundredths)}</div>
            <div>Needs review: {formatHours(totals.needs_review_hours_hundredths)}</div>
          </div>
        )}
        {closeMutation.error && (
          <Banner variant="error">{(closeMutation.error as Error).message}</Banner>
        )}
        <Button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending || !ready}>
          {closeMutation.isPending ? 'Closing…' : `Close ${month}`}
        </Button>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg">Closed snapshots</h2>
        {snaps.isLoading && <div className="text-slate-500">Loading…</div>}
        {snaps.error && <Banner variant="error">{(snaps.error as Error).message}</Banner>}
        {(snaps.data ?? []).map((s) => (
          <SnapshotRow key={s.month} snapshot={s} partner={partner} />
        ))}
        {snaps.data?.length === 0 && (
          <div className="text-sm text-slate-500">No closed snapshots yet.</div>
        )}
      </section>
    </div>
  );
}
