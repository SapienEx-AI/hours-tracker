import { useState, useEffect, useRef } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useUiStore } from '@/store/ui-store';
import { useProjects } from '@/data/hooks/use-projects';
import { useRates } from '@/data/hooks/use-rates';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useAuthStore } from '@/store/auth-store';
import { addEntry } from '@/data/entries-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { resolveRateAtLogTime } from '@/calc';
import type { ProjectsConfig, RatesConfig } from '@/schema/types';
import { Banner } from '@/ui/components/Banner';
import { formatHoursDecimal } from '@/format/format';
import { qk } from '@/data/query-keys';
import type { Route } from '@/ui/Router';
import type { Suggestion } from '@/data/hooks/use-calendar-events';
import { SuggestionsPanel } from './log/SuggestionsPanel';
import { LogForm } from './log/LogForm';
import { buildEntry, initialForm, type FormState } from './log/form-helpers';

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

type Props = {
  onNavigate: (r: Route) => void;
};

export function QuickLog({ onNavigate }: Props): JSX.Element {
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const projects = useProjects();
  const rates = useRates();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(initialForm);
  const [toast, setToast] = useState<string | null>(null);
  const [prefillHint, setPrefillHint] = useState<string | null>(null);
  const projectRef = useRef<HTMLSelectElement | null>(null);
  const focusLogNonce = useUiStore((s) => s.focusLogNonce);

  useEffect(() => {
    if (focusLogNonce > 0) projectRef.current?.focus();
  }, [focusLogNonce]);

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
      // Silent — bad state handled at save time.
    }
  }, [
    form.projectId,
    form.bucketId,
    form.date,
    form.rateOverridden,
    projects.data,
    rates.data,
  ]);

  useEffect(() => {
    if (form.bucketId !== null) {
      setForm((f) => ({ ...f, status: 'billable' }));
    }
  }, [form.bucketId]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      if (!projects.data || !rates.data) throw new Error('Config not loaded');
      const { owner, repo } = splitRepoPath(dataRepo);
      const entry = buildEntry(form, projects.data, rates.data);
      await addEntry(octokit, { owner, repo, entry });
      const project = projects.data.projects.find((p) => p.id === form.projectId);
      return project?.name ?? form.projectId;
    },
    onSuccess: (projectName) => {
      const hoursDisplay = formatHoursDecimal(form.hoursHundredths);
      setToast(`Logged ${hoursDisplay}h to ${projectName}`);
      setPrefillHint(null);
      setForm((f) => ({ ...initialForm, projectId: f.projectId, date: f.date }));
      queryClient.invalidateQueries({
        queryKey: qk.monthEntries(dataRepo ?? 'none', form.date.slice(0, 7)),
      });
    },
  });

  const gate = loadingOrErrorGate(projects, rates);
  if (gate) return gate;

  const activeProjects = projects.data?.projects.filter((p) => p.active) ?? [];
  const canSave = !!form.projectId && form.hoursHundredths > 0 && form.description.trim().length > 0;

  function applySuggestion(s: Suggestion) {
    setForm((f) => ({
      ...f,
      date: s.date,
      hoursHundredths: s.hours_hundredths,
      description: s.description,
      source_ref: s.source_event_id
        ? { kind: 'calendar', id: s.source_event_id }
        : null,
    }));
    setPrefillHint(s.description || '(no title)');
  }

  function clearPrefill() {
    setForm((f) => ({ ...f, hoursHundredths: 0, description: '', source_ref: null }));
    setPrefillHint(null);
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <LogForm
        form={form}
        setForm={setForm}
        activeProjects={activeProjects}
        projectRef={projectRef}
        toast={toast}
        prefillHint={prefillHint}
        onClearPrefill={clearPrefill}
        mutationError={mutation.error as Error | null}
        saving={mutation.isPending}
        canSave={canSave}
        onSave={() => mutation.mutate()}
      />
      <div className="w-full lg:w-[380px] shrink-0">
        <SuggestionsPanel
          date={form.date}
          onSelect={applySuggestion}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}
