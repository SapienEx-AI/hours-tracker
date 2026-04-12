import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useAuthStore } from '@/store/auth-store';
import { useProjects } from '@/data/hooks/use-projects';
import { useRates } from '@/data/hooks/use-rates';
import { updateEntry } from '@/data/entries-repo';
import { editMessage } from '@/data/commit-messages';
import { splitRepoPath } from '@/data/octokit-client';
import { resolveRateAtLogTime } from '@/calc';
import type { Entry, BillableStatus } from '@/schema/types';
import { formatHoursDecimal } from '@/format/format';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Select } from '@/ui/components/Select';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { Banner } from '@/ui/components/Banner';
import { HoursChips } from '@/ui/components/HoursChips';
import { qk } from '@/data/query-keys';

type FormState = {
  date: string;
  hoursHundredths: number;
  bucketId: string | null;
  status: BillableStatus;
  rateCents: number;
  rateOverridden: boolean;
  description: string;
  reviewFlag: boolean;
};

function buildChangeDescription(entry: Entry, form: FormState, newRateCents: number): string {
  const changes: string[] = [];
  if (entry.hours_hundredths !== form.hoursHundredths) {
    changes.push(`hours ${formatHoursDecimal(entry.hours_hundredths)} → ${formatHoursDecimal(form.hoursHundredths)}`);
  }
  if (entry.rate_cents !== newRateCents) changes.push(`rate ${entry.rate_cents} → ${newRateCents}`);
  if (entry.billable_status !== form.status) changes.push(`status ${entry.billable_status} → ${form.status}`);
  if (entry.description !== form.description) changes.push('description updated');
  if (entry.bucket_id !== form.bucketId) changes.push(`bucket ${entry.bucket_id ?? 'none'} → ${form.bucketId ?? 'none'}`);
  if (entry.date !== form.date) changes.push(`date ${entry.date} → ${form.date}`);
  return changes.join(', ') || 'no field changes';
}

type Props = {
  entry: Entry;
  onClose: () => void;
};

export function EditEntryModal({ entry, onClose }: Props): JSX.Element {
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const projects = useProjects();
  const rates = useRates();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(entry.date);
  const [hoursHundredths, setHoursHundredths] = useState(entry.hours_hundredths);
  const [bucketId, setBucketId] = useState<string | null>(entry.bucket_id);
  const [status, setStatus] = useState<BillableStatus>(entry.billable_status);
  const [rateCents, setRateCents] = useState(entry.rate_cents);
  const [rateOverridden, setRateOverridden] = useState(entry.rate_source === 'entry_override');
  const [description, setDescription] = useState(entry.description);
  const [reviewFlag, setReviewFlag] = useState(entry.review_flag);

  useEffect(() => {
    if (bucketId !== null) setStatus('billable');
  }, [bucketId]);

  useEffect(() => {
    if (!projects.data || !rates.data || rateOverridden) return;
    try {
      const resolved = resolveRateAtLogTime({
        project_id: entry.project,
        bucket_id: bucketId,
        date,
        projects: projects.data,
        rates: rates.data,
      });
      setRateCents(resolved.rate_cents);
    } catch {
      // silent
    }
  }, [bucketId, date, entry.project, projects.data, rates.data, rateOverridden]);

  const form: FormState = { date, hoursHundredths, bucketId, status, rateCents, rateOverridden, description, reviewFlag };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!octokit || !dataRepo || !projects.data || !rates.data) throw new Error('Not ready');
      const { owner, repo } = splitRepoPath(dataRepo);
      const resolved = resolveRateAtLogTime({
        project_id: entry.project, bucket_id: bucketId, date,
        projects: projects.data, rates: rates.data,
      });
      const finalRate = rateOverridden ? rateCents : resolved.rate_cents;
      const updated: Entry = {
        ...entry, date, hours_hundredths: hoursHundredths,
        rate_cents: finalRate,
        rate_source: rateOverridden ? 'entry_override' : resolved.source,
        billable_status: status, bucket_id: bucketId,
        description, review_flag: reviewFlag,
        updated_at: new Date().toISOString(),
      };
      await updateEntry(octokit, {
        owner, repo, entry: updated,
        message: editMessage(entry.id, buildChangeDescription(entry, form, finalRate)),
      });
    },
    onSuccess: () => {
      const month = entry.date.slice(0, 7);
      queryClient.invalidateQueries({
        queryKey: qk.monthEntries(dataRepo ?? 'none', month),
      });
      queryClient.invalidateQueries({
        queryKey: [...qk.all, 'all-entries', dataRepo ?? 'none'],
      });
      onClose();
    },
  });

  const selectedProject = projects.data?.projects.find((p) => p.id === entry.project);
  const activeBuckets = selectedProject?.buckets.filter((b) => b.status !== 'archived') ?? [];
  const canSave = hoursHundredths > 0 && description.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg glass-strong rounded-2xl p-6 glow-blue max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg">Edit entry</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-xl leading-none">
            &times;
          </button>
        </div>

        <div className="text-xs font-mono text-slate-500 mb-4">
          {entry.id} &middot; {entry.project}
        </div>

        <div className="flex flex-col gap-3">
          <FieldLabel label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FieldLabel>

          <FieldLabel label="Hours">
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={hoursHundredths === 0 ? '' : formatHoursDecimal(hoursHundredths)}
              onChange={(e) =>
                setHoursHundredths(Math.round(parseFloat(e.target.value || '0') * 100))
              }
            />
          </FieldLabel>
          <HoursChips onPick={(h) => setHoursHundredths(h)} />

          <FieldLabel label="Bucket">
            <Select
              value={bucketId ?? ''}
              onChange={(e) => setBucketId(e.target.value || null)}
            >
              <option value="">(none — general billable)</option>
              {activeBuckets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}{b.status === 'closed' ? ' (closed)' : ''}
                </option>
              ))}
            </Select>
          </FieldLabel>

          <FieldLabel label="Status">
            <div className="flex gap-4 font-body text-sm">
              {(['billable', 'non_billable', 'needs_review'] as const).map((s) => (
                <label
                  key={s}
                  className={`flex items-center gap-1 ${bucketId ? 'opacity-50' : ''}`}
                >
                  <input
                    type="radio"
                    name="edit-status"
                    value={s}
                    checked={status === s}
                    onChange={() => setStatus(s)}
                    disabled={bucketId !== null}
                  />
                  {s.replace('_', '-')}
                </label>
              ))}
            </div>
          </FieldLabel>

          <FieldLabel label="Rate (cents)" hint={rateOverridden ? 'override' : 'inherited'}>
            <Input
              type="number"
              step="1"
              value={rateCents}
              onChange={(e) => {
                setRateCents(parseInt(e.target.value || '0', 10));
                setRateOverridden(true);
              }}
            />
          </FieldLabel>

          <FieldLabel label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl glass-input text-slate-800 font-body text-sm transition-all duration-200 focus:outline-none focus:border-partner-cyan/50 focus:glass-strong focus:glow-focus"
            />
          </FieldLabel>

          <label className="flex items-center gap-2 text-sm text-slate-500">
            <input
              type="checkbox"
              checked={reviewFlag}
              onChange={(e) => setReviewFlag(e.target.checked)}
            />
            Flag for review
          </label>

          {mutation.error && (
            <Banner variant="error">{(mutation.error as Error).message}</Banner>
          )}

          <div className="flex gap-3 mt-2">
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !canSave}>
              {mutation.isPending ? 'Saving...' : 'Save changes'}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
