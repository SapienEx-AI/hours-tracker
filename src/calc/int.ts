/**
 * Integer-only arithmetic helpers for money (cents) and hours (hundredths).
 *
 * This is the ONLY file in src/ where raw arithmetic on _cents/_hundredths
 * fields is permitted (enforced by eslint-rules/no-float-money.cjs). Every
 * other module must call through this one.
 *
 * All functions assert their inputs are integers; any non-integer throws
 * immediately with a descriptive error. This catches a whole class of drift
 * bugs at the boundary instead of letting them propagate.
 */

export function assertInteger(n: number): void {
  if (!Number.isInteger(n)) {
    throw new Error(`int assertion failed: expected integer, got ${n}`);
  }
}

export function assertNonNegativeInteger(n: number): void {
  assertInteger(n);
  if (n < 0) {
    throw new Error(`int assertion failed: expected non-negative integer, got ${n}`);
  }
}

// ─── Cents ───

export function addCents(a: number, b: number): number {
  assertInteger(a);
  assertInteger(b);
  return a + b;
}

export function subCents(a: number, b: number): number {
  assertInteger(a);
  assertInteger(b);
  return a - b;
}

export function sumCents(values: readonly number[]): number {
  let total = 0;
  for (const v of values) {
    assertInteger(v);
    total += v;
  }
  return total;
}

// ─── Hundredths (of an hour) ───

export function addHundredths(a: number, b: number): number {
  assertNonNegativeInteger(a);
  assertNonNegativeInteger(b);
  return a + b;
}

export function sumHundredths(values: readonly number[]): number {
  let total = 0;
  for (const v of values) {
    assertNonNegativeInteger(v);
    total += v;
  }
  return total;
}

// ─── Rate × Hours ───

/**
 * Compute amount_cents from rate_cents (per hour) × hours_hundredths.
 *
 * Math: amount_cents = rate_cents * hours_hundredths / 100.
 *
 * We insist the result be an exact integer. If `rate_cents * hours_hundredths`
 * is not divisible by 100, we throw — this would mean the billing amount has
 * sub-cent precision, which we refuse to silently round. The caller must pick
 * a rate that divides cleanly or explicitly round upstream.
 *
 * Examples:
 *   $125.00/h * 4.00h  →  12500 * 400 / 100 = 50000 cents  ✓
 *   $125.00/h * 0.25h  →  12500 * 25 / 100 = 3125 cents    ✓
 *   $1.01/h  * 0.01h   →  101 * 1 / 100 = 1.01             ✗ throws
 */
export function mulCentsByHundredths(rateCents: number, hoursHundredths: number): number {
  assertNonNegativeInteger(rateCents);
  assertNonNegativeInteger(hoursHundredths);
  const product = rateCents * hoursHundredths;
  if (product % 100 !== 0) {
    throw new Error(
      `mulCentsByHundredths produced non-integer cents: rate=${rateCents}, hours=${hoursHundredths}, product=${product}`,
    );
  }
  return product / 100;
}
