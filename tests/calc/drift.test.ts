import { describe, it, expect } from 'vitest';
import { computeDrift } from '@/calc/drift';
import { hashEntries } from '@/calc';
import type { Entry, Snapshot } from '@/schema/types';

function makeEntry(p: Partial<Entry> = {}): Entry {
  return {
    id: 'e1', project: 'sprosty', date: '2026-03-10', hours_hundredths: 400,
    rate_cents: 10000, rate_source: 'global_default', billable_status: 'billable',
    bucket_id: null, description: 'd', review_flag: false,
    created_at: '2026-03-10T00:00:00Z', updated_at: '2026-03-10T00:00:00Z',
    source_ref: null,
    effort_kind: null,
    effort_count: null,
    ...p,
  };
}

async function snapshotFor(entries: Entry[]): Promise<Snapshot> {
  return {
    schema_version: 1,
    month: '2026-03',
    closed_at: '2026-04-01T00:00:00Z',
    closed_at_commit_sha: 'deadbeef',
    source_hash: await hashEntries(entries),
    totals: {
      total_hours_hundredths: 0,
      billable_hours_hundredths: 0,
      non_billable_hours_hundredths: 0,
      needs_review_hours_hundredths: 0,
      billable_amount_cents: 0,
    },
    per_project: [],
    entry_ids: entries.map((e) => e.id),
  };
}

describe('computeDrift', () => {
  it('reports no drift when current entries hash matches snapshot.source_hash', async () => {
    const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
    const snap = await snapshotFor(entries);
    const d = await computeDrift(snap, entries);
    expect(d.drifted).toBe(false);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.changed).toEqual([]);
  });

  it('detects added entries', async () => {
    const original = [makeEntry({ id: 'a' })];
    const snap = await snapshotFor(original);
    const current = [...original, makeEntry({ id: 'b' })];
    const d = await computeDrift(snap, current);
    expect(d.drifted).toBe(true);
    expect(d.added.map((e) => e.id)).toEqual(['b']);
  });

  it('detects removed entries', async () => {
    const original = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
    const snap = await snapshotFor(original);
    const current = [original[0]!];
    const d = await computeDrift(snap, current);
    expect(d.drifted).toBe(true);
    expect(d.removed).toEqual(['b']);
  });

  it('reports all shared entries as possibly-changed when ids match but hash differs', async () => {
    const original = [makeEntry({ id: 'a', hours_hundredths: 400 })];
    const snap = await snapshotFor(original);
    const current = [makeEntry({ id: 'a', hours_hundredths: 500 })];
    const d = await computeDrift(snap, current);
    expect(d.drifted).toBe(true);
    expect(d.changed.map((e) => e.id)).toEqual(['a']);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
  });
});
