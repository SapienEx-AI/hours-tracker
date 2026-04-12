import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useMonthEntries } from '@/data/hooks/use-month-entries';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useAuthStore } from '@/store/auth-store';
import { deleteEntry } from '@/data/entries-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { deleteMessage } from '@/data/commit-messages';
import { formatHours, formatCents } from '@/format/format';
import type { Partner, Entry } from '@/schema/types';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Banner } from '@/ui/components/Banner';
import { qk } from '@/data/query-keys';
import { EditEntryModal } from './entries/EditEntryModal';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function Entries({ partner }: { partner: Partner }): JSX.Element {
  const [month, setMonth] = useState(currentMonth);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<Entry | null>(null);
  const entries = useMonthEntries(month);
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (entry: Entry) => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      const { owner, repo } = splitRepoPath(dataRepo);
      await deleteEntry(octokit, {
        owner,
        repo,
        month,
        entryId: entry.id,
        message: deleteMessage(entry.id, 'deleted via UI'),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.monthEntries(dataRepo ?? 'none', month),
      });
    },
  });

  const visible = (entries.data?.entries ?? []).filter(
    (e) =>
      !filter ||
      e.project.toLowerCase().includes(filter.toLowerCase()) ||
      e.description.toLowerCase().includes(filter.toLowerCase()),
  );
  const currency = {
    currency_symbol: partner.currency_symbol,
    currency_display_suffix: partner.currency_display_suffix,
  };

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <div className="flex items-end gap-4">
        <h1 className="font-display text-2xl">Entries &middot; {month}</h1>
        <div className="max-w-xs flex-1">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div className="max-w-xs flex-1">
          <Input
            placeholder="filter by project or text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>
      {entries.isLoading && <div className="text-slate-500">Loading...</div>}
      {entries.error && <Banner variant="error">{(entries.error as Error).message}</Banner>}
      {deleteMutation.error && (
        <Banner variant="error">{(deleteMutation.error as Error).message}</Banner>
      )}

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full font-mono text-sm">
          <thead>
            <tr className="text-left text-slate-500 bg-white/30">
              <th className="py-2.5 px-3">Date</th>
              <th className="py-2.5 px-3">Project</th>
              <th className="py-2.5 px-3">Hours</th>
              <th className="py-2.5 px-3">Rate</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Description</th>
              <th className="py-2.5 px-3" />
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <tr
                key={e.id}
                className="border-t border-black/5 hover:bg-white/30 transition-colors cursor-pointer"
                onClick={() => setEditing(e)}
              >
                <td className="py-2 px-3">{e.date}</td>
                <td className="py-2 px-3">{e.project}</td>
                <td className="py-2 px-3">{formatHours(e.hours_hundredths)}</td>
                <td className="py-2 px-3">{formatCents(e.rate_cents, currency)}</td>
                <td className="py-2 px-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      e.billable_status === 'billable'
                        ? 'bg-emerald-100 text-emerald-800'
                        : e.billable_status === 'non_billable'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {e.billable_status.replace('_', '-')}
                  </span>
                </td>
                <td className="py-2 px-3 truncate max-w-xs">{e.description}</td>
                <td className="py-2 px-3" onClick={(ev) => ev.stopPropagation()}>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (confirm(`Delete entry ${e.id}?`)) deleteMutation.mutate(e);
                    }}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visible.length === 0 && !entries.isLoading && (
        <div className="text-center text-slate-500 py-8">
          No entries for {month}{filter ? ` matching "${filter}"` : ''}
        </div>
      )}

      {editing && (
        <EditEntryModal entry={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
