import type { ProjectsConfig, RatesConfig, RateSource } from '@/schema/types';

export type ResolveRateArgs = {
  project_id: string;
  bucket_id: string | null;
  date: string; // YYYY-MM-DD
  projects: ProjectsConfig;
  rates: RatesConfig;
};

export type ResolvedRate = {
  rate_cents: number;
  source: RateSource;
};

/**
 * Resolve the effective rate for an entry at log time.
 *
 * Priority (spec §3 decision 4):
 *   1. Bucket override (`bucket.rate_cents` if set)       → `entry_override`
 *   2. Project default (`project.default_rate_cents`)    → `project_default`
 *   3. Global default valid at the entry's date          → `global_default`
 *
 * Throws on missing project, missing bucket, or unresolvable global rate.
 * Never returns a default value silently; bad input is a bug, not a soft failure.
 */
export function resolveRateAtLogTime(args: ResolveRateArgs): ResolvedRate {
  const { project_id, bucket_id, date, projects, rates } = args;

  const project = projects.projects.find((p) => p.id === project_id);
  if (!project) {
    throw new Error(`resolveRateAtLogTime: project "${project_id}" not found`);
  }

  if (bucket_id !== null) {
    const bucket = project.buckets.find((b) => b.id === bucket_id);
    if (!bucket) {
      throw new Error(
        `resolveRateAtLogTime: bucket "${bucket_id}" not found in project "${project_id}"`,
      );
    }
    if (bucket.rate_cents !== null) {
      return { rate_cents: bucket.rate_cents, source: 'entry_override' };
    }
    // Fall through to project/global lookup.
  }

  if (project.default_rate_cents !== null) {
    return { rate_cents: project.default_rate_cents, source: 'project_default' };
  }

  return { rate_cents: resolveGlobalRate(date, rates), source: 'global_default' };
}

/**
 * Walk rate history in descending order of effective_from; return the rate
 * of the first entry whose effective_from <= target date. Throws if no entry
 * covers the date.
 */
function resolveGlobalRate(date: string, rates: RatesConfig): number {
  // Sort a copy descending. History is expected to be small (~10 entries).
  const history = [...rates.default_rate_history].sort((a, b) =>
    b.effective_from.localeCompare(a.effective_from),
  );
  for (const h of history) {
    if (h.effective_from <= date) return h.rate_cents;
  }
  const earliest = history.length > 0 ? history[history.length - 1] : undefined;
  throw new Error(
    `resolveRateAtLogTime: no global rate valid at date ${date}. Earliest rate is ${earliest?.effective_from ?? '(none)'}.`,
  );
}
