/**
 * Display formatters at the UI edge.
 *
 * INPUT: integer fields from the data model (_cents, _hundredths).
 * OUTPUT: human-readable strings.
 *
 * This is the ONLY place in the app allowed to convert integers to decimal
 * strings for display. The lint rule no-float-money exempts src/calc/int.ts
 * for arithmetic; this module stays on integer inputs and uses Math.trunc +
 * string slicing to render without introducing floating-point drift.
 */

export type CurrencyDisplay = {
  currency_symbol: string;
  currency_display_suffix: string;
};

/** Format hundredths of an hour as "N.NNh". */
export function formatHours(hoursHundredths: number): string {
  return `${formatHoursDecimal(hoursHundredths)}h`;
}

/** Format hundredths of an hour as "N.NN" (no suffix). */
export function formatHoursDecimal(hoursHundredths: number): string {
  const whole = Math.trunc(hoursHundredths / 100);
  const frac = hoursHundredths - whole * 100;
  return `${whole}.${frac.toString().padStart(2, '0')}`;
}

/** Format cents as "$X,XXX.XX CAD" (or whatever the partner currency is). */
export function formatCents(amountCents: number, currency: CurrencyDisplay): string {
  const whole = Math.trunc(amountCents / 100);
  const frac = amountCents - whole * 100;
  const wholeWithSeparators = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const left = `${currency.currency_symbol}${wholeWithSeparators}.${frac.toString().padStart(2, '0')}`;
  return currency.currency_display_suffix ? `${left} ${currency.currency_display_suffix}` : left;
}
