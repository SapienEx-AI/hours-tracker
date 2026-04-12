import { useState, useEffect } from 'react';
import { useProjects } from '@/data/hooks/use-projects';
import { useRates } from '@/data/hooks/use-rates';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useQueuedMutation } from '@/data/hooks/use-queued-mutation';
import { useAuthStore } from '@/store/auth-store';
import { addEntry } from '@/data/entries-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { newEntryId } from '@/data/new-entry-id';
import { resolveRateAtLogTime } from '@/calc';
import type { Entry, BillableStatus, ProjectsConfig, RatesConfig } from '@/schema/types';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Select } from '@/ui/components/Select';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { Banner } from '@/ui/components/Banner';
import { HoursChips } from '@/ui/components/HoursChips';
import { formatHoursDecimal } from '@/format/format';
import { qk } from '@/data/query-keys';

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type FormState = {
  projectId: string;
  date: string;
  hoursHundredths: number;
  bucketId: string | null;
  status: BillableStatus;
  rateCents: number;
  rateOverridden: boolean;
  description: string;
};

const initialForm: FormState = {
  projectId: '',
  date: todayISO(),
  hoursHundredths: 0,
  bucketId: null,
  status: 'billable',
  rateCents: 0,
  rateOverridden: false,
  description: '',
};

type QueryLike<T> = {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
};

function loadingOrErrorGate(
  projects: QueryLike<ProjectsConfig>,
  rates: QueryLike<RatesConfig>,
): JSX.Element | null {
  if (projects.isLoading || rates.isLoading) {
    return <div className="text-slate-500">Loading…</div>;
  }
  if (projects.error) {
    return (
      <Banner variant="error">
        Failed to load projects: {(projects.error as Error).message}
      </Banner>
    );
  }
  if (rates.error) {
    return (
      <Banner variant="error">Failed to load rates: {(rates.error as Error).message}</Banner>
    );
  }
  return null;
}

function formatRateDollars(rateCents: number): string {
  return rateCents === 0 ? '' : (rateCents / 100).toString();
}

function buildEntry(
  form: FormState,
  projects: ProjectsConfig,
  rates: RatesConfig,
): Entry {
  const resolved = resolveRateAtLogTime({
    project_id: form.projectId,
    bucket_id: form.bucketId,
    date: form.date,
    projects,
    rates,
  });
  const now = new Date().toISOString();
  return {
    id: newEntryId({ date: form.date, projectSlug: form.projectId }),
    project: form.projectId,
    date: form.date,
    hours_hundredths: form.hoursHundredths,
    rate_cents: form.rateOverridden ? form.rateCents : resolved.rate_cents,
    rate_source: form.rateOverridden ? 'entry_override' : resolved.source,
    billable_status: form.status,
    bucket_id: form.bucketId,
    description: form.description,
    review_flag: false,
    created_at: now,
    updated_at: now,
  };
}

export function QuickLog(): JSX.Element {
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const projects = useProjects();
  const rates = useRates();

  const [form, setForm] = useState<FormState>(initialForm);
  const [toast, setToast] = useState<string | null>(null);

  // Auto-resolve rate when project/bucket/date changes (if not manually overridden).
  useEffect(() => {
    if (!projects.data || !rates.data || !form.projectId) return;
    if (form.rateOverridden) return;
    try {
      const resolved = resolveRateAtLogTime({
        project_id: form.projectId,
        bucket_id: form.bucketId,
        date: form.date,
        projects: projects.data,
        rates: rates.data,
      });
      setForm((f) => ({ ...f, rateCents: resolved.rate_cents }));
    } catch {
      // Silent — bad state is handled at save time.
    }
  }, [
    form.projectId,
    form.bucketId,
    form.date,
    form.rateOverridden,
    projects.data,
    rates.data,
  ]);

  // A bucket selection auto-locks status to billable (spec §8.2).
  useEffect(() => {
    if (form.bucketId !== null) {
      setForm((f) => ({ ...f, status: 'billable' }));
    }
  }, [form.bucketId]);

  const mutation = useQueuedMutation<{ entry: Entry; projectName: string }>({
    label: (args) => `Log ${formatHoursDecimal(args.entry.hours_hundredths)}h to ${args.projectName}`,
    mutationFn: async (args) => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      const { owner, repo } = splitRepoPath(dataRepo);
      await addEntry(octokit, { owner, repo, entry: args.entry });
    },
    invalidateKeys: [
      qk.monthEntries(dataRepo ?? 'none', form.date.slice(0, 7)),
      [...qk.all, 'all-entries', dataRepo ?? 'none'],
    ],
  });

  const gate = loadingOrErrorGate(projects, rates);
  if (gate) return gate;

  const activeProjects = projects.data?.projects.filter((p) => p.active) ?? [];
  const selectedProject = activeProjects.find((p) => p.id === form.projectId);
  const activeBuckets = selectedProject?.buckets.filter((b) => b.status !== 'archived') ?? [];
  const canSave = !!form.projectId && form.hoursHundredths > 0 && form.description.trim().length > 0;

  function handleSave() {
    if (!projects.data || !rates.data) return;
    const entry = buildEntry(form, projects.data, rates.data);
    const project = projects.data.projects.find((p) => p.id === form.projectId);
    const projectName = project?.name ?? form.projectId;
    mutation.mutate({ entry, projectName }, {
      onSuccess: () => {
        setToast(`Logged ${formatHoursDecimal(form.hoursHundredths)}h to ${projectName}`);
        setForm((f) => ({ ...initialForm, projectId: f.projectId, date: f.date }));
      },
    });
  }

  return (
    <div className="max-w-xl flex flex-col gap-4">
      <h1 className="font-display text-2xl">Log hours</h1>
      {toast && <Banner variant="success">{toast}</Banner>}

      <FieldLabel label="Project">
        <Select
          value={form.projectId}
          onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value, bucketId: null }))}
        >
          <option value="">— select —</option>
          {activeProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </FieldLabel>

      <FieldLabel label="Date">
        <Input
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
        />
      </FieldLabel>

      <FieldLabel label="Hours">
        <Input
          type="number"
          step="0.01"
          min="0.01"
          value={form.hoursHundredths === 0 ? '' : formatHoursDecimal(form.hoursHundredths)}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              hoursHundredths: Math.round(parseFloat(e.target.value || '0') * 100),
            }))
          }
        />
      </FieldLabel>
      <HoursChips onPick={(h) => setForm((f) => ({ ...f, hoursHundredths: h }))} />

      <FieldLabel label="Bucket">
        <Select
          value={form.bucketId ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, bucketId: e.target.value || null }))}
        >
          <option value="">(none — general billable)</option>
          {activeBuckets.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}{b.status === 'closed' ? ' (closed)' : ''}
            </option>
          ))}
        </Select>
      </FieldLabel>
      {form.bucketId && activeBuckets.find((b) => b.id === form.bucketId)?.status === 'closed' && (
        <Banner variant="warning">
          This bucket is closed. New entries are allowed but may need review — the bucket was
          likely invoiced already.
        </Banner>
      )}

      <FieldLabel label="Status">
        <div className="flex gap-4 font-body text-sm">
          {(['billable', 'non_billable', 'needs_review'] as const).map((s) => (
            <label
              key={s}
              className={`flex items-center gap-1 ${form.bucketId ? 'opacity-50' : ''}`}
            >
              <input
                type="radio"
                name="status"
                value={s}
                checked={form.status === s}
                onChange={() => setForm((f) => ({ ...f, status: s }))}
                disabled={form.bucketId !== null}
              />
              {s.replace('_', '-')}
            </label>
          ))}
        </div>
      </FieldLabel>

      <FieldLabel label="Rate ($/hr)" hint={form.rateOverridden ? 'override' : 'inherited'}>
        <Input
          type="number"
          step="0.01"
          value={formatRateDollars(form.rateCents)}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              rateCents: Math.round(parseFloat(e.target.value || '0') * 100),
              rateOverridden: true,
            }))
          }
        />
      </FieldLabel>

      <FieldLabel label="Description">
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          maxLength={500}
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-xl glass-input text-slate-800 font-body text-sm transition-all duration-200 focus:outline-none focus:border-partner-cyan/50 focus:glass-strong focus:glow-focus placeholder:text-slate-500/60"
        />
      </FieldLabel>

      {mutation.error && <Banner variant="error">{(mutation.error as Error).message}</Banner>}

      <Button onClick={() => handleSave()} disabled={mutation.isPending || !canSave}>
        {mutation.isPending ? 'Saving…' : 'Save (⌘↵)'}
      </Button>
    </div>
  );
}
