import { describe, it, expect } from 'vitest';
import { validateEntries } from '@/schema/validators';
import type { EntriesFile } from '@/schema/types';

describe('Entry v5 schema migration', () => {
  it('accepts a v5 file with source_ref.kind slack', () => {
    const file = {
      schema_version: 5,
      month: '2026-04',
      entries: [
        {
          id: '2026-04-15-acme-abc123',
          project: 'acme',
          date: '2026-04-15',
          hours_hundredths: 40,
          rate_cents: 10000,
          rate_source: 'project_default',
          billable_status: 'billable',
          bucket_id: null,
          description: 'Slack batch',
          review_flag: false,
          created_at: '2026-04-15T12:00:00Z',
          updated_at: '2026-04-15T12:00:00Z',
          source_ref: { kind: 'slack', id: 'daily:2026-04-15:client:T012AB:acme' },
          effort_kind: 'slack',
          effort_count: 12,
        },
      ],
    };
    const result = validateEntries(file);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.schema_version).toBe(5);
  });

  it('accepts a v5 file with source_ref.kind gmail', () => {
    const file: EntriesFile = {
      schema_version: 5,
      month: '2026-04',
      entries: [
        {
          id: '2026-04-15-acme-def456',
          project: 'acme',
          date: '2026-04-15',
          hours_hundredths: 15,
          rate_cents: 10000,
          rate_source: 'project_default',
          billable_status: 'billable',
          bucket_id: null,
          description: 'Email batch',
          review_flag: false,
          created_at: '2026-04-15T12:00:00Z',
          updated_at: '2026-04-15T12:00:00Z',
          source_ref: { kind: 'gmail', id: 'daily:2026-04-15:client:acme' },
          effort_kind: 'email',
          effort_count: 3,
        },
      ],
    };
    const result = validateEntries(file);
    expect(result.ok).toBe(true);
  });

  it('rejects schema_version 6 (not widened)', () => {
    const file = {
      schema_version: 6,
      month: '2026-04',
      entries: [],
    };
    const result = validateEntries(file as unknown as EntriesFile);
    expect(result.ok).toBe(false);
  });

  it('rejects unknown source_ref.kind', () => {
    const file = {
      schema_version: 5,
      month: '2026-04',
      entries: [
        {
          id: '2026-04-15-acme-xyz789',
          project: 'acme',
          date: '2026-04-15',
          hours_hundredths: 10,
          rate_cents: 10000,
          rate_source: 'project_default',
          billable_status: 'billable',
          bucket_id: null,
          description: 'foo',
          review_flag: false,
          created_at: '2026-04-15T12:00:00Z',
          updated_at: '2026-04-15T12:00:00Z',
          source_ref: { kind: 'outlook', id: 'anything' },
          effort_kind: null,
          effort_count: null,
        },
      ],
    };
    const result = validateEntries(file as unknown as EntriesFile);
    expect(result.ok).toBe(false);
  });
});
