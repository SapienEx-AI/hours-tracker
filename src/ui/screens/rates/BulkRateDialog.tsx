import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useAllEntries } from '@/data/hooks/use-all-entries';
import { useProjects } from '@/data/hooks/use-projects';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useAuthStore } from '@/store/auth-store';
import { previewBulkRate, type BulkRateFilter } from '@/calc';
import { applyBulkRateUpdate } from '@/data/bulk-rate-update';
import { splitRepoPath } from '@/data/octokit-client';
import { formatCents, formatHoursDecimal } from '@/format/format';
import type { Partner } from '@/schema/types';
import { Input } from '@/ui/components/Input';
import { Select } from '@/ui/components/Select';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { Button } from '@/ui/components/Button';
import { Banner } from '@/ui/components/Banner';
import { qk } from '@/data/query-keys';

type Props = { partner: Partner; onClose: () => void };

function filterToDescription(f: BulkRateFilter): string {
  const parts: string[] = [];
  if (f.projectId) parts.push(`project: ${f.projectId}`);
  if (f.bucketId) parts.push(`bucket: ${f.bucketId}`);
  if (f.dateFrom) parts.push(`date >= ${f.dateFrom}`);
  if (f.dateTo) parts.push(`date <= ${f.dateTo}`);
  if (f.status) parts.push(`status: ${f.status}`);
  return parts.join(', ') || 'all entries';
}

export function BulkRateDialog({ partner, onClose }: Props): JSX.Element {
  const allEntriesQuery = useAllEntries();
  const projects = useProjects();
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const queryClient = useQueryClient();

  const [projectId, setProjectId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [newRateStr, setNewRateStr] = useState('');
  const currency = {
    currency_symbol: partner.currency_symbol,
    currency_display_suffix: partner.currency_display_suffix,
  };
  const newRateCents = newRateStr === '' ? 0 : Math.round(parseFloat(newRateStr) * 100);
  const filter: BulkRateFilter = useMemo(() => {
    const f: BulkRateFilter = {};
    if (projectId) f.projectId = projectId;
    if (dateFrom) f.dateFrom = dateFrom;
    if (dateTo) f.dateTo = dateTo;
    return f;
  }, [projectId, dateFrom, dateTo]);

  const preview = useMemo(() => {
    if (!allEntriesQuery.data || newRateCents === 0) return null;
    return previewBulkRate(allEntriesQuery.data, filter, newRateCents);
  }, [allEntriesQuery.data, filter, newRateCents]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!octokit || !dataRepo || !preview) throw new Error('Not ready');
      const { owner, repo } = splitRepoPath(dataRepo);
      await applyBulkRateUpdate(octokit, {
        owner,
        repo,
        matched: preview.matched,
        newRateCents,
        filterDescription: filterToDescription(filter),
      });
    },
    onSuccess: () => {
      const months = new Set(preview?.matched.map((e) => e.date.slice(0, 7)) ?? []);
      for (const m of months) {
        queryClient.invalidateQueries({ queryKey: qk.monthEntries(dataRepo ?? 'none', m) });
      }
      queryClient.invalidateQueries({
        queryKey: [...qk.all, 'all-entries', dataRepo ?? 'none'],
      });
      onClose();
    },
  });

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl glass-strong rounded-2xl p-6 glow-blue max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg">Bulk rate update</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-xl leading-none">&times;</button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <FieldLabel label="Project (optional)">
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">— all —</option>
              {projects.data?.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </FieldLabel>
          <FieldLabel label="New rate ($/hr)">
            <Input type="number" step="0.01" value={newRateStr} onChange={(e) => setNewRateStr(e.target.value)} />
          </FieldLabel>
          <FieldLabel label="Date from (inclusive)">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </FieldLabel>
          <FieldLabel label="Date to (inclusive)">
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </FieldLabel>
        </div>
        {preview && (
          <div className="p-4 rounded-xl glass mb-4 text-sm font-mono">
            <div>{preview.matched.length} entries match.</div>
            <div>Old total: {formatCents(preview.oldAmountCents, currency)}</div>
            <div>New total: {formatCents(preview.newAmountCents, currency)}</div>
            <div className={preview.totalDeltaCents >= 0 ? 'text-emerald-700' : 'text-red-700'}>
              Delta: {formatCents(preview.totalDeltaCents, currency)}
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-slate-600">Matched entries</summary>
              <ul className="mt-1 text-xs">
                {preview.matched.slice(0, 50).map((e) => (
                  <li key={e.id}>
                    {e.date} · {e.project} · {formatHoursDecimal(e.hours_hundredths)}h · {formatCents(e.rate_cents, currency)} → {formatCents(newRateCents, currency)}
                  </li>
                ))}
                {preview.matched.length > 50 && (
                  <li>… and {preview.matched.length - 50} more</li>
                )}
              </ul>
            </details>
          </div>
        )}
        {mutation.error && <Banner variant="error">{(mutation.error as Error).message}</Banner>}
        <div className="flex gap-3">
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !preview || preview.matched.length === 0}
          >
            {mutation.isPending ? 'Applying…' : `Apply to ${preview?.matched.length ?? 0} entries`}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
