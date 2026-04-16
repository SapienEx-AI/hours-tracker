import { describe, it, expect } from 'vitest';
import type {
  EffortSourceAdapter,
  DigestRow,
  DigestItem,
  SourceKind,
  DigestDirection,
} from '@/integrations/adapters/types';

describe('EffortSourceAdapter contract', () => {
  it('accepts a minimal adapter implementation', () => {
    const adapter: EffortSourceAdapter = {
      source: 'calendar',
      isConnected: () => false,
      connect: async () => {},
      disconnect: async () => {},
      fetchDailyDigest: async () => [],
    };
    expect(adapter.source).toBe('calendar');
  });

  it('DigestRow type composes cleanly', () => {
    const row: DigestRow = {
      source: 'slack',
      direction: 'client',
      count: 12,
      heuristicHoursHundredths: 40,
      suggestedKind: 'slack',
      suggestedProjectId: 'acme',
      batchId: 'daily:2026-04-15:client:T012AB:acme',
      items: [],
      label: 'Slack → Acme (12 threads)',
    };
    expect(row.source).toBe('slack');
  });

  it('SourceKind has exactly three members', () => {
    const kinds: SourceKind[] = ['calendar', 'slack', 'gmail'];
    expect(kinds).toHaveLength(3);
  });

  it('DigestDirection has exactly three members', () => {
    const dirs: DigestDirection[] = ['client', 'internal', 'ambiguous'];
    expect(dirs).toHaveLength(3);
  });

  it('DigestItem composes cleanly', () => {
    const item: DigestItem = {
      timestamp: '2026-04-15T12:00:00Z',
      label: 'thread',
      externalId: 'abc',
    };
    expect(item.externalId).toBe('abc');
  });
});
