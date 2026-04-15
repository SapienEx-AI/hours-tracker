import { useState, useEffect, useRef } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useUiStore } from '@/store/ui-store';
import { useProjects } from '@/data/hooks/use-projects';
import { useRates } from '@/data/hooks/use-rates';
import { useProfile } from '@/data/hooks/use-profile';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useAuthStore } from '@/store/auth-store';
import { addEntry } from '@/data/entries-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { resolveRateAtLogTime } from '@/calc';
import type { EffortKind, ProjectsConfig, RatesConfig } from '@/schema/types';
import { Banner } from '@/ui/components/Banner';
import { formatHoursDecimal } from '@/format/format';
import { qk } from '@/data/query-keys';
import type { Route } from '@/ui/Router';
import type { Suggestion } from '@/data/hooks/use-calendar-events';
import { useTimerStore } from '@/store/timer-store';
import { msToHundredths, type HistoricalRecording } from '@/store/timer-session';
import type { QuickAction } from './log/QuickActivityCard';
import { LogForm } from './log/LogForm';
import { LogHelpersPanel } from './log/LogHelpersPanel';
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
  const profile = useProfile();
  const loggingMode = profile.data?.logging_mode ?? 'hours';
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(initialForm);
  const [toast, setToast] = useState<string | null>(null);
  const [prefillHint, setPrefillHint] = useState<string | null>(null);
  const [loadAnimNonce, setLoadAnimNonce] = useState(0);
  const [loadFlashFields, setLoadFlashFields] = useState<ReadonlySet<string>>(new Set());
  const [loadFlashTone, setLoadFlashTone] = useState<{ r: number; g: number; b: number } | null>(
    null,
  );
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

  const updateTimerSnapshot = useTimerStore((s) => s.updateSnapshot);

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
    setLoadFlashFields(new Set(['date', 'hoursHundredths', 'description']));
    setLoadFlashTone({ r: 99, g: 102, b: 241 }); // indigo-500 (Calendar tone)
    setLoadAnimNonce((n) => n + 1);
  }

  function clearPrefill() {
    setForm((f) => ({ ...f, hoursHundredths: 0, description: '', source_ref: null }));
    setPrefillHint(null);
  }

  function applyHistoricalRecording(rec: HistoricalRecording) {
    // Redrive: restore the full context of a past timer session. Unlike a
    // live timer load, this replaces project/bucket/date — the user is
    // explicitly asking to re-enter a previous context.
    const hours = msToHundredths(rec.elapsed_ms);
    setForm((f) => ({
      ...f,
      date: rec.date,
      projectId: rec.project_id,
      bucketId: rec.bucket_id,
      hoursHundredths: hours,
      effort_kind: rec.effort_kind,
      effort_count: rec.effort_kind === null ? null : 1,
      source_ref: { kind: 'timer', id: rec.id },
    }));
    setPrefillHint('timer · redriven');
    setLoadFlashFields(
      new Set(['date', 'projectId', 'bucketId', 'hoursHundredths', 'effort_kind', 'effort_count']),
    );
    setLoadFlashTone({ r: 245, g: 158, b: 11 });
    setLoadAnimNonce((n) => n + 1);
  }

  function changeTimerProject(projectId: string) {
    // Inline edit in the Timer panel: update form AND keep the session's
    // snapshot in sync so the archived recording reflects the chosen context.
    setForm((f) => ({ ...f, projectId, bucketId: null }));
    updateTimerSnapshot({ projectId, bucketId: null });
  }

  function changeTimerBucket(bucketId: string | null) {
    setForm((f) => ({ ...f, bucketId }));
    updateTimerSnapshot({ bucketId });
  }

  function changeTimerEffortKind(effort_kind: EffortKind | null) {
    setForm((f) => ({
      ...f,
      effort_kind,
      effort_count: effort_kind === null ? null : (f.effort_count ?? 1),
    }));
    updateTimerSnapshot({ effort_kind });
  }

  function onQuickActivity(action: QuickAction) {
    setForm((f) => ({
      ...f,
      effort_kind: action.kind,
      effort_count: 1,
      hoursHundredths: action.hoursHundredths,
    }));
    setPrefillHint(`quick: ${action.kind.replace(/_/g, ' ')}`);
    setLoadFlashFields(
      new Set(['effort_kind', 'effort_count', 'hoursHundredths']),
    );
    setLoadFlashTone({ r: 251, g: 146, b: 60 }); // orange-400 — distinct from indigo and amber
    setLoadAnimNonce((n) => n + 1);
  }

  function onBounceProject() {
    const el = projectRef.current;
    if (el === null) return;
    el.classList.add('ring-2', 'ring-red-500', 'animate-pulse');
    window.setTimeout(() => {
      el.classList.remove('ring-2', 'ring-red-500', 'animate-pulse');
    }, 800);
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
        loadAnimNonce={loadAnimNonce}
        loadFlashFields={loadFlashFields}
        loadFlashTone={loadFlashTone}
        loggingMode={loggingMode}
      />
      <LogHelpersPanel
        form={{
          projectId: form.projectId,
          bucketId: form.bucketId,
          description: form.description,
          date: form.date,
          effort_kind: form.effort_kind,
        }}
        projects={activeProjects}
        onSelectSuggestion={applySuggestion}
        onRedriveRecording={applyHistoricalRecording}
        onChangeProject={changeTimerProject}
        onChangeBucket={changeTimerBucket}
        onChangeEffortKind={changeTimerEffortKind}
        onQuickActivity={onQuickActivity}
        onBounceProject={onBounceProject}
        onNavigate={onNavigate}
      />
    </div>
  );
}
