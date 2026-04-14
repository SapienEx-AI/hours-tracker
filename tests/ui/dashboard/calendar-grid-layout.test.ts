import { describe, it, expect } from 'vitest';
import { computeCalendarLayout } from '@/ui/screens/dashboard/calendar-grid-layout';

describe('computeCalendarLayout', () => {
  it('returns exactly 42 cells', () => {
    const r = computeCalendarLayout(2026, 4);
    expect(r).toHaveLength(42);
  });

  it('April 2026 (Wed start, 30 days): first cell is Mon Mar 30, last cell is Sun May 10', () => {
    const r = computeCalendarLayout(2026, 4);
    expect(r[0]).toEqual({ date: '2026-03-30', inMonth: false });
    expect(r[41]).toEqual({ date: '2026-05-10', inMonth: false });
  });

  it('April 2026: Apr 1 is the Wednesday of the first row (index 2)', () => {
    const r = computeCalendarLayout(2026, 4);
    expect(r[2]).toEqual({ date: '2026-04-01', inMonth: true });
  });

  it('April 2026: Apr 30 is inMonth and May 1 is padding', () => {
    const r = computeCalendarLayout(2026, 4);
    expect(r[31]).toEqual({ date: '2026-04-30', inMonth: true });
    expect(r[32]).toEqual({ date: '2026-05-01', inMonth: false });
  });

  it('February 2026 (Sun start, 28 days): first cell is Mon Jan 26, Feb 1 at index 6', () => {
    const r = computeCalendarLayout(2026, 2);
    expect(r).toHaveLength(42);
    expect(r[0]).toEqual({ date: '2026-01-26', inMonth: false });
    expect(r[6]).toEqual({ date: '2026-02-01', inMonth: true });
  });

  it('March 2026 (Sun start, 31 days): first cell is Mon Feb 23, Mar 1 at index 6', () => {
    const r = computeCalendarLayout(2026, 3);
    expect(r).toHaveLength(42);
    expect(r[0]).toEqual({ date: '2026-02-23', inMonth: false });
    expect(r[6]).toEqual({ date: '2026-03-01', inMonth: true });
  });

  it('every cell has an inMonth flag and a YYYY-MM-DD date string', () => {
    const r = computeCalendarLayout(2026, 4);
    for (const c of r) {
      expect(typeof c.inMonth).toBe('boolean');
      expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
