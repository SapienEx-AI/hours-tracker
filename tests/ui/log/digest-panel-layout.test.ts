import { describe, it, expect } from 'vitest';
import { groupRowsForDisplay } from '@/ui/screens/log/DigestPanel';
import type { DigestRow } from '@/integrations/adapters/types';

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

describe('groupRowsForDisplay', () => {
  it('groups into CLIENT, INTERNAL, AMBIGUOUS', () => {
    const rows = [
      row({ direction: 'client', batchId: 'a' }),
      row({ direction: 'internal', batchId: 'b' }),
      row({ direction: 'ambiguous', batchId: 'c' }),
    ];
    const result = groupRowsForDisplay(rows);
    expect(result.client).toHaveLength(1);
    expect(result.internal).toHaveLength(1);
    expect(result.ambiguous).toHaveLength(1);
  });

  it('within a group, sorts by source order calendar > slack > gmail', () => {
    const rows = [
      row({ direction: 'client', source: 'slack', label: 'slack-x', batchId: 'a' }),
      row({ direction: 'client', source: 'calendar', label: 'cal-x', batchId: 'b' }),
      row({ direction: 'client', source: 'gmail', label: 'gmail-x', batchId: 'c' }),
    ];
    const result = groupRowsForDisplay(rows);
    expect(result.client.map((r) => r.source)).toEqual(['calendar', 'slack', 'gmail']);
  });

  it('within a source, sorts by descending heuristicHoursHundredths', () => {
    const rows = [
      row({
        direction: 'client',
        source: 'slack',
        heuristicHoursHundredths: 10,
        label: 'a',
        batchId: 'a',
      }),
      row({
        direction: 'client',
        source: 'slack',
        heuristicHoursHundredths: 40,
        label: 'b',
        batchId: 'b',
      }),
    ];
    const result = groupRowsForDisplay(rows);
    expect(result.client[0]?.label).toBe('b');
  });
});
