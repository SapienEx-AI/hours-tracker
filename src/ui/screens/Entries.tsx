import { useState, useEffect } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useMonthEntries } from '@/data/hooks/use-month-entries';
import { useProjects } from '@/data/hooks/use-projects';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useAuthStore } from '@/store/auth-store';
import { useUiStore } from '@/store/ui-store';
import { deleteEntry, updateEntry } from '@/data/entries-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { deleteMessage, editMessage } from '@/data/commit-messages';
import type { Partner, Entry } from '@/schema/types';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Select } from '@/ui/components/Select';
import { Banner } from '@/ui/components/Banner';
import { qk } from '@/data/query-keys';
import { entriesToCSV, downloadCSV } from '@/export/csv';
import { EditEntryModal } from './entries/EditEntryModal';
import { EntryRow } from './entries/EntryRow';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function prevMonth(m: string): string {
  const [yStr, mStr] = m.split('-');
  const y = parseInt(yStr ?? '0', 10);
  const mo = parseInt(mStr ?? '0', 10);
  if (mo === 1) return `${y - 1}-12`;
  return `${y}-${String(mo - 1).padStart(2, '0')}`;
}

function nextMonth(m: string): string {
  const [yStr, mStr] = m.split('-');
  const y = parseInt(yStr ?? '0', 10);
  const mo = parseInt(mStr ?? '0', 10);
  if (mo === 12) return `${y + 1}-01`;
  return `${y}-${String(mo + 1).padStart(2, '0')}`;
}

function formatMonthLabel(m: string): string {
  const [yStr, mStr] = m.split('-');
  const monthIdx = parseInt(mStr ?? '1', 10) - 1;
  return `${MONTH_NAMES[monthIdx] ?? ''} ${yStr ?? ''}`;
}

type StatusFilter = 'all' | 'billable' | 'non_billable' | 'needs_review';

export function Entries({ partner }: { partner: Partner }): JSX.Element {
  const [month, setMonth] = useState(currentMonth);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<Entry | null>(null);
  const entries = useMonthEntries(month);
  const projects = useProjects();
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const queryClient = useQueryClient();
  const prefilter = useUiStore((s) => s.entriesPrefilter);
  const setPrefilter = useUiStore((s) => s.setEntriesPrefilter);

  useEffect(() => {
    if (prefilter?.status === 'needs_review') {
      setStatusFilter('needs_review');
      setPrefilter(null);
    }
  }, [prefilter, setPrefilter]);

  const deleteMutation = useMutation({
    mutationFn: async (entry: Entry) => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      const { owner, repo } = splitRepoPath(dataRepo);
      await deleteEntry(octokit, {
        owner, repo, month, entryId: entry.id,
        message: deleteMessage(entry.id, 'deleted via UI'),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.monthEntries(dataRepo ?? 'none', month),
      });
    },
  });

  const assignBucketMutation = useMutation({
    mutationFn: async (args: { entry: Entry; bucketId: string }) => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      const { owner, repo } = splitRepoPath(dataRepo);
      const updated: Entry = {
        ...args.entry, bucket_id: args.bucketId,
        billable_status: 'billable', updated_at: new Date().toISOString(),
      };
      await updateEntry(octokit, {
        owner, repo, entry: updated,
        message: editMessage(args.entry.id, `bucket none → ${args.bucketId}`),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.monthEntries(dataRepo ?? 'none', month),
      });
      queryClient.invalidateQueries({
        queryKey: [...qk.all, 'all-entries', dataRepo ?? 'none'],
      });
    },
  });

  const visible = (entries.data?.entries ?? []).filter(
    (e) =>
      (statusFilter === 'all' || e.billable_status === statusFilter) &&
      (!filter ||
        e.project.toLowerCase().includes(filter.toLowerCase()) ||
        e.description.toLowerCase().includes(filter.toLowerCase())),
  );
  const currency = {
    currency_symbol: partner.currency_symbol,
    currency_display_suffix: partner.currency_display_suffix,
  };

  function getBucketsForProject(projectId: string) {
    const project = projects.data?.projects.find((p) => p.id === projectId);
    return project?.buckets ?? [];
  }

  function handleAssign(entryId: string, bucketId: string) {
    const target = entries.data?.entries.find((x) => x.id === entryId);
    if (target) assignBucketMutation.mutate({ entry: target, bucketId });
  }

  return (
    <div className="flex flex-col gap-4 max-w-6xl">
      <div className="flex items-end gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold">
            Entries &middot; {formatMonthLabel(month)}
          </h1>
          <div className="flex gap-1 font-body text-sm font-medium">
            <button
              className="text-slate-400 hover:text-sky-500 transition-colors px-1"
              onClick={() => setMonth(prevMonth(month))}
            >←</button>
            <button
              className="text-slate-400 hover:text-sky-500 transition-colors px-1"
              onClick={() => setMonth(nextMonth(month))}
            >→</button>
          </div>
        </div>
        <div className="max-w-xs flex-1">
          <Input
            placeholder="filter by project or text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="w-48">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">all statuses</option>
            <option value="billable">billable</option>
            <option value="non_billable">non-billable</option>
            <option value="needs_review">needs-review</option>
          </Select>
        </div>
        <Button
          variant="secondary"
          onClick={() => downloadCSV(`entries-${month}.csv`, entriesToCSV(visible))}
          disabled={visible.length === 0}
        >
          Export CSV
        </Button>
      </div>
      {entries.isLoading && <div className="text-slate-500">Loading...</div>}
      {entries.error && <Banner variant="error">{(entries.error as Error).message}</Banner>}
      {deleteMutation.error && (
        <Banner variant="error">{(deleteMutation.error as Error).message}</Banner>
      )}
      {assignBucketMutation.error && (
        <Banner variant="error">{(assignBucketMutation.error as Error).message}</Banner>
      )}

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 bg-white/30 text-xs font-bold uppercase tracking-wider">
              <th className="py-2.5 px-3">Date</th>
              <th className="py-2.5 px-3">Project</th>
              <th className="py-2.5 px-3">Hours</th>
              <th className="py-2.5 px-3">Rate</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Bucket</th>
              <th className="py-2.5 px-3">Description</th>
              <th className="py-2.5 px-3" />
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <EntryRow
                key={e.id}
                entry={e}
                buckets={getBucketsForProject(e.project)}
                currency={currency}
                onEdit={setEditing}
                onAssignBucket={handleAssign}
                onDelete={(x) => deleteMutation.mutate(x)}
                assignBusy={assignBucketMutation.isPending}
              />
            ))}
          </tbody>
        </table>
      </div>

      {visible.length === 0 && !entries.isLoading && (
        <div className="text-center text-slate-500 py-8">
          No entries for {formatMonthLabel(month)}
          {filter ? ` matching "${filter}"` : ''}
        </div>
      )}

      {editing && (
        <EditEntryModal entry={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
