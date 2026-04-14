import type { BillableStatus, Entry, ProjectsConfig, RatesConfig } from '@/schema/types';
import { resolveRateAtLogTime } from '@/calc';
import { newEntryId } from '@/data/new-entry-id';

export type FormState = {
  projectId: string;
  date: string;
  hoursHundredths: number;
  bucketId: string | null;
  status: BillableStatus;
  rateCents: number;
  rateOverridden: boolean;
  description: string;
  source_event_id: string | null;
};

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const initialForm: FormState = {
  projectId: '',
  date: todayISO(),
  hoursHundredths: 0,
  bucketId: null,
  status: 'billable',
  rateCents: 0,
  rateOverridden: false,
  description: '',
  source_event_id: null,
};

export function formatRateDollars(rateCents: number): string {
  return rateCents === 0 ? '' : (rateCents / 100).toString();
}

export function buildEntry(
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
    source_event_id: form.source_event_id,
  };
}
