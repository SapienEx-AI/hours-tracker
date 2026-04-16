import { describe, it, expect } from 'vitest';
import { heuristicHoursHundredths, MINUTES_PER_UNIT } from '@/integrations/heuristics';

describe('heuristicHoursHundredths', () => {
  it('floors to 1 hundredth for zero count', () => {
    expect(heuristicHoursHundredths(2, 0)).toBe(1);
  });

  it('rounds 12 client-Slack threads at 2 min/unit to 40 hundredths', () => {
    expect(heuristicHoursHundredths(2, 12)).toBe(40);
  });

  it('rounds 8 internal emails at 1 min/unit to 13 hundredths', () => {
    expect(heuristicHoursHundredths(1, 8)).toBe(13);
  });

  it('returns 150 hundredths for a 90-min event (actual duration)', () => {
    expect(heuristicHoursHundredths(90, 1)).toBe(150);
  });

  it('MINUTES_PER_UNIT table exposes expected keys', () => {
    expect(MINUTES_PER_UNIT.slack.client).toBe(2);
    expect(MINUTES_PER_UNIT.slack.internal).toBe(1);
    expect(MINUTES_PER_UNIT.email.client).toBe(3);
    expect(MINUTES_PER_UNIT.email.internal).toBe(1);
  });
});
