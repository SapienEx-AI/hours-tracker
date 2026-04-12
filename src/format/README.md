# src/format

**Purpose:** Display-edge conversion from integer fields (_cents, _hundredths) to human-readable strings.

**Public API:**
- `formatHours(hoursHundredths) → "4.25h"`
- `formatHoursDecimal(hoursHundredths) → "4.25"`
- `formatCents(cents, currencyDisplay) → "$125.00 CAD"`

**Invariants:**
1. Inputs are integers. Outputs are strings.
2. No floating-point arithmetic. `Math.trunc` + string slicing only.
3. Currency settings come from `Partner.currency_symbol` + `currency_display_suffix` (spec §5.1).
