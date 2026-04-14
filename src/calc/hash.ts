import type { Entry } from '@/schema/types';

/**
 * Canonicalize a list of entries into a deterministic JSON string suitable
 * for hashing. The output is independent of:
 *   - Key order within any entry object
 *   - Entry array order (we sort by `id`)
 *
 * This gives us a stable "snapshot source hash" (spec §5.6) that only changes
 * when the semantic content of the entries changes.
 */
export function canonicalizeEntriesForHashing(entries: readonly Entry[]): string {
  const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(sorted.map(canonicalizeEntry));
}

function canonicalizeEntry(e: Entry): Record<string, unknown> {
  // Emit keys in fixed order. source_event_id is emitted only when non-null
  // so v1 entries (no field) and v2 entries with null hash identically.
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
  if (e.source_event_id !== null && e.source_event_id !== undefined) {
    base.source_event_id = e.source_event_id;
  }
  return base;
}

/**
 * Compute SHA-256 of the canonicalized entries, returning the string
 * `sha256:<hex>`. Uses the browser's crypto.subtle API (available in all
 * modern browsers and Node 18+).
 */
export async function hashEntries(entries: readonly Entry[]): Promise<string> {
  const canonical = canonicalizeEntriesForHashing(entries);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}
