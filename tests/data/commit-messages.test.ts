import { describe, it, expect } from 'vitest';
import {
  logMessage,
  editMessage,
  deleteMessage,
  bulkEditMessage,
  configAddProjectMessage,
  configAddRateMessage,
  snapshotCloseMessage,
  importMessage,
} from '@/data/commit-messages';

describe('commit-messages', () => {
  it('logMessage emits "log: <project> <date> <hours>h @ $<rate> (desc)"', () => {
    expect(
      logMessage({
        project: 'sprosty',
        date: '2026-03-25',
        hours_hundredths: 400,
        rate_cents: 2000,
        description: 'skyvia HS + companies configs',
      }),
    ).toBe('log: sprosty 2026-03-25 4.00h @ $20.00 (skyvia HS + companies configs)');
  });

  it('editMessage emits "edit: <id> — <change>"', () => {
    expect(editMessage('2026-03-25-sprosty-aaaaaa', 'hours 4.0 → 4.5')).toBe(
      'edit: 2026-03-25-sprosty-aaaaaa — hours 4.0 → 4.5',
    );
  });

  it('deleteMessage includes the id and reason', () => {
    expect(deleteMessage('2026-03-25-sprosty-aaaaaa', 'no longer applies')).toBe(
      'delete: 2026-03-25-sprosty-aaaaaa — no longer applies',
    );
  });

  it('bulkEditMessage describes count and filter', () => {
    expect(
      bulkEditMessage({
        rate_cents: 17500,
        count: 22,
        filter: 'project: Sprosty, date: >= 2026-04-01',
      }),
    ).toBe(
      'bulk-edit: apply $175.00 rate to 22 entries matching {project: Sprosty, date: >= 2026-04-01}',
    );
  });

  it('configAddProjectMessage emits the expected format', () => {
    expect(configAddProjectMessage('Shannex')).toBe('config: add project "Shannex"');
  });

  it('configAddRateMessage includes rate and effective date', () => {
    expect(configAddRateMessage(17500, '2026-04-01')).toBe(
      'config: add rate $175.00 effective 2026-04-01',
    );
  });

  it('snapshotCloseMessage includes totals', () => {
    expect(
      snapshotCloseMessage({
        month: '2026-03',
        billable_hours_hundredths: 8750,
        non_billable_hours_hundredths: 1800,
        billable_amount_cents: 1312500,
      }),
    ).toBe('snapshot: close 2026-03 — 87.50h billable, 18.00h non-billable, $13,125.00');
  });

  it('importMessage includes source and count', () => {
    expect(importMessage('2026-03', 'Apple Notes', 95)).toBe(
      'import: 2026-03 from Apple Notes (95 entries)',
    );
  });

  it('logMessage appends [activity: ...] when effort is present', () => {
    expect(
      logMessage({
        project: 'sprosty',
        date: '2026-03-25',
        hours_hundredths: 400,
        rate_cents: 2000,
        description: 'x',
        effort: [
          { kind: 'slack', count: 1 },
          { kind: 'meeting', count: 2 },
        ],
      }),
    ).toBe('log: sprosty 2026-03-25 4.00h @ $20.00 (x) [activity: 2 meeting, 1 slack]');
  });

  it('logMessage omits the activity suffix when effort is empty', () => {
    expect(
      logMessage({
        project: 'sprosty',
        date: '2026-03-25',
        hours_hundredths: 400,
        rate_cents: 2000,
        description: 'x',
        effort: [],
      }),
    ).toBe('log: sprosty 2026-03-25 4.00h @ $20.00 (x)');
  });

  it('logMessage renders activity and source tags in that order', () => {
    expect(
      logMessage({
        project: 'sprosty',
        date: '2026-03-25',
        hours_hundredths: 400,
        rate_cents: 2000,
        description: 'x',
        source: 'calendar',
        effort: [{ kind: 'meeting', count: 1 }],
      }),
    ).toBe('log: sprosty 2026-03-25 4.00h @ $20.00 (x) [activity: 1 meeting] [calendar]');
  });
});
