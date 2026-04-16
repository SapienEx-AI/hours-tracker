import type { Entry, SourceRef } from '@/schema/types';

/**
 * Canonicalize a list of entries into a deterministic JSON string suitable
 * for hashing. The output is independent of:
 *   - Key order within any entry object
 *   - Entry array order (we sort by `id`)
 *
 * source_ref is projected back to per-kind canonical fields so:
 *   - null / missing → no source field (matches v1 and v2-null hashes)
 *   - { kind: 'calendar', id } → "source_event_id": id (matches v2 calendar hashes)
 *   - { kind: 'timer', id } → "source_timer_id": id (new; no legacy conflict)
 *
 * This preserves every pre-existing snapshot hash byte-for-byte.
 */
export function canonicalizeEntriesForHashing(entries: readonly Entry[]): string {
  const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(sorted.map(canonicalizeEntry));
}

function canonicalizeEntry(e: Entry): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: e.id,
    project: e.project,
    date: e.date,
    hours_hundredths: e.hours_hundredths,
    rate_cents: e.rate_cents,
    rate_source: e.rate_source,
    billable_status: e.billable_status,
    bucket_id: e.bucket_id,
    description: e.description,
    review_flag: e.review_flag,
    created_at: e.created_at,
    updated_at: e.updated_at,
  };
  // Effort fields emitted ONLY when non-null — mirrors source_ref projection.
  // Pre-v4 entries hash identically; March 2026 golden fixture untouched.
  if (e.effort_kind !== null && e.effort_kind !== undefined) {
    base.effort_kind = e.effort_kind;
  }
  if (e.effort_count !== null && e.effort_count !== undefined) {
    base.effort_count = e.effort_count;
  }
  const source = canonicalSource(e.source_ref);
  for (const [k, v] of Object.entries(source)) {
    base[k] = v;
  }
  return base;
}

function canonicalSource(ref: SourceRef | undefined): Record<string, string> {
  // Treat undefined identically to null — the validator backfills source_ref on
  // read, but defensively allow callers that construct Entry-like values
  // without it (tests, future migrations).
  if (ref === null || ref === undefined) return {};
  if (ref.kind === 'calendar') return { source_event_id: ref.id };
  if (ref.kind === 'timer') return { source_timer_id: ref.id };
  if (ref.kind === 'slack') return { source_slack_id: ref.id };
  if (ref.kind === 'gmail') return { source_gmail_id: ref.id };
  // Exhaustiveness check — if a new kind is added without updating this file,
  // TypeScript will error here at compile time.
  const _exhaustive: never = ref;
  return _exhaustive;
}

export async function hashEntries(entries: readonly Entry[]): Promise<string> {
  const canonical = canonicalizeEntriesForHashing(entries);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}
