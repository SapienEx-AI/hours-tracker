import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { hashEntries } from '@/calc/hash';
import type { Entry, SourceRef } from '@/schema/types';

const baseEntry: Entry = {
  id: '2026-04-15-acme-abc123',
  project: 'acme',
  date: '2026-04-15',
  hours_hundredths: 40,
  rate_cents: 10000,
  rate_source: 'project_default',
  billable_status: 'billable',
  bucket_id: null,
  description: 'd',
  review_flag: false,
  created_at: '2026-04-15T12:00:00Z',
  updated_at: '2026-04-15T12:00:00Z',
  source_ref: null,
  effort_kind: null,
  effort_count: null,
};

describe('hashEntries with v5 source_ref kinds', () => {
  it('produces a stable hash for entries carrying source_ref.kind slack', async () => {
    const entries: Entry[] = [
      {
        ...baseEntry,
        source_ref: { kind: 'slack', id: 'daily:2026-04-15:client:T012AB:acme' },
      },
    ];
    expect(await hashEntries(entries)).toBe(await hashEntries(entries));
  });

  it('produces a stable hash for entries carrying source_ref.kind gmail', async () => {
    const entries: Entry[] = [
      {
        ...baseEntry,
        source_ref: { kind: 'gmail', id: 'daily:2026-04-15:client:acme' },
      },
    ];
    expect(await hashEntries(entries)).toBe(await hashEntries(entries));
  });

  it('is insensitive to array order for v5 kinds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            kind: fc.constantFrom('calendar', 'timer', 'slack', 'gmail', null),
            id: fc.string({ minLength: 1 }),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        async (refs) => {
          const entries: Entry[] = refs.map((r, i) => ({
            ...baseEntry,
            id: `2026-04-15-acme-${String(i).padStart(6, '0')}`,
            source_ref:
              r.kind === null
                ? null
                : ({
                    kind: r.kind as Exclude<SourceRef, null>['kind'],
                    id: r.id,
                  } as SourceRef),
          }));
          const shuffled = [...entries].reverse();
          return (await hashEntries(entries)) === (await hashEntries(shuffled));
        },
      ),
    );
  });

  it('preserves canonical form for entries with source_ref null', async () => {
    const entries: Entry[] = [{ ...baseEntry, source_ref: null }];
    const h = await hashEntries(entries);
    expect(h).toMatch(/^sha256:[a-f0-9]+$/);
    expect(await hashEntries(entries)).toBe(h);
  });
});
