import { describe, it, expect } from 'vitest';
import { composeDigest } from '@/integrations/adapters/enabled-adapters';
import type { DigestRow, EffortSourceAdapter, SourceKind } from '@/integrations/adapters/types';

function stubAdapter(source: SourceKind, rows: DigestRow[]): EffortSourceAdapter {
  return {
    source,
    isConnected: () => true,
    connect: async () => {},
    disconnect: async () => {},
    fetchDailyDigest: async () => rows,
  };
}

function row(partial: Partial<DigestRow>): DigestRow {
  return {
    source: 'slack',
    direction: 'client',
    count: 1,
    heuristicHoursHundredths: 10,
    suggestedKind: 'slack',
    suggestedProjectId: null,
    batchId: 'b',
    items: [],
    label: 'x',
    ...partial,
  };
}

describe('composeDigest', () => {
  it('runs adapters in parallel and concatenates their rows', async () => {
    const a = stubAdapter('calendar', [row({ source: 'calendar' })]);
    const b = stubAdapter('slack', [row({ source: 'slack' })]);
    const c = stubAdapter('gmail', [row({ source: 'gmail', direction: 'internal' })]);
    const result = await composeDigest([a, b, c], '2026-04-15');
    expect(result.rows).toHaveLength(3);
    expect(result.errors).toEqual([]);
  });

  it('captures per-adapter errors without failing the batch', async () => {
    const good = stubAdapter('calendar', [row({ source: 'calendar' })]);
    const bad: EffortSourceAdapter = {
      source: 'slack',
      isConnected: () => true,
      connect: async () => {},
      disconnect: async () => {},
      fetchDailyDigest: async () => {
        throw new Error('boom');
      },
    };
    const result = await composeDigest([good, bad], '2026-04-15');
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.source).toBe('slack');
  });
});
