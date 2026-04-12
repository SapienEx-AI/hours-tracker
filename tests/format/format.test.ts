import { describe, it, expect } from 'vitest';
import { formatHours, formatCents, formatHoursDecimal } from '@/format/format';

describe('format', () => {
  it('formatHours renders 25 hundredths as "0.25h"', () => {
    expect(formatHours(25)).toBe('0.25h');
  });

  it('formatHours renders 400 hundredths as "4.00h"', () => {
    expect(formatHours(400)).toBe('4.00h');
  });

  it('formatHoursDecimal renders 25 hundredths as "0.25"', () => {
    expect(formatHoursDecimal(25)).toBe('0.25');
  });

  it('formatCents renders 12500 as "$125.00 CAD" for CAD partner', () => {
    expect(
      formatCents(12500, { currency_symbol: '$', currency_display_suffix: 'CAD' }),
    ).toBe('$125.00 CAD');
  });

  it('formatCents renders 1312500 with thousands separators', () => {
    expect(
      formatCents(1312500, { currency_symbol: '$', currency_display_suffix: 'CAD' }),
    ).toBe('$13,125.00 CAD');
  });

  it('formatCents renders 0 as "$0.00 CAD"', () => {
    expect(formatCents(0, { currency_symbol: '$', currency_display_suffix: 'CAD' })).toBe(
      '$0.00 CAD',
    );
  });
});
