import { describe, it } from 'vitest';
import fc from 'fast-check';
import { heuristicHoursHundredths } from '@/integrations/heuristics';

describe('heuristicHoursHundredths invariants', () => {
  it('result is always >= 1', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 120 }), fc.integer({ min: 0, max: 10000 }), (m, n) => {
        return heuristicHoursHundredths(m, n) >= 1;
      }),
    );
  });

  it('non-decreasing in count', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 120 }), fc.integer({ min: 0, max: 1000 }), (m, n) => {
        return heuristicHoursHundredths(m, n) <= heuristicHoursHundredths(m, n + 1);
      }),
    );
  });

  it('non-decreasing in minutesPerUnit', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 120 }), fc.integer({ min: 1, max: 1000 }), (m, n) => {
        return heuristicHoursHundredths(m, n) <= heuristicHoursHundredths(m + 1, n);
      }),
    );
  });
});
