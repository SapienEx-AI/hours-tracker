import { describe, it, expect } from 'vitest';
import {
  addCents,
  subCents,
  sumCents,
  addHundredths,
  sumHundredths,
  mulCentsByHundredths,
  assertInteger,
  assertNonNegativeInteger,
} from '@/calc/int';

describe('int helpers — cents', () => {
  it('addCents sums two positive integers', () => {
    expect(addCents(100, 250)).toBe(350);
  });

  it('addCents throws on a non-integer input', () => {
    expect(() => addCents(100.5, 0)).toThrow();
  });

  it('subCents returns a positive difference', () => {
    expect(subCents(500, 200)).toBe(300);
  });

  it('subCents allows a negative result (e.g., refund math)', () => {
    expect(subCents(100, 500)).toBe(-400);
  });

  it('sumCents sums an array of cent values exactly', () => {
    expect(sumCents([100, 200, 300, 50])).toBe(650);
  });

  it('sumCents returns 0 for an empty array', () => {
    expect(sumCents([])).toBe(0);
  });
});

describe('int helpers — hundredths', () => {
  it('addHundredths sums two values', () => {
    expect(addHundredths(25, 75)).toBe(100);
  });

  it('sumHundredths sums an array', () => {
    expect(sumHundredths([25, 50, 75, 100])).toBe(250);
  });
});

describe('int helpers — rate × hours', () => {
  it('mulCentsByHundredths computes exact amount: 12500c × 400h-hundredths = 50000c', () => {
    // $125/hr * 4h = $500 = 50000 cents.
    // rate_cents (per hour) * hours_hundredths / 100 = amount_cents
    expect(mulCentsByHundredths(12500, 400)).toBe(50000);
  });

  it('mulCentsByHundredths handles fractional hours: 12500c × 25h-hundredths = 3125c', () => {
    // $125/hr * 0.25h = $31.25 = 3125 cents.
    expect(mulCentsByHundredths(12500, 25)).toBe(3125);
  });

  it('mulCentsByHundredths throws if the result would not be an integer', () => {
    // $1.01/hr × 0.01h = 0.0101 cents — truly non-integer. Reject.
    // rate_cents = 101, hours_hundredths = 1  →  101 * 1 / 100 = 1.01 (non-integer).
    expect(() => mulCentsByHundredths(101, 1)).toThrow();
  });

  it('mulCentsByHundredths returns 0 when hours is 0', () => {
    expect(mulCentsByHundredths(12500, 0)).toBe(0);
  });
});

describe('int helpers — assertions', () => {
  it('assertInteger passes integers', () => {
    expect(() => assertInteger(5)).not.toThrow();
    expect(() => assertInteger(0)).not.toThrow();
    expect(() => assertInteger(-3)).not.toThrow();
  });

  it('assertInteger throws on non-integer', () => {
    expect(() => assertInteger(1.5)).toThrow();
  });

  it('assertInteger throws on NaN', () => {
    expect(() => assertInteger(NaN)).toThrow();
  });

  it('assertNonNegativeInteger rejects negative', () => {
    expect(() => assertNonNegativeInteger(-1)).toThrow();
  });
});
