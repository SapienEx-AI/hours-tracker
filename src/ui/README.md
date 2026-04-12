# src/ui

**Purpose:** React components. Screens compose primitives from `components/`. Layout chrome lives in `layout/`.

**Public API:**
- `layout/AppShell.tsx` — top-level wrapper with partner logo, nav, footer
- `layout/LeftNav.tsx`, `layout/Footer.tsx`
- `Router.tsx` — hash-based router with `Route` type + `useRoute` hook
- `screens/*.tsx` — one file per spec §8 screen
- `components/*.tsx` — shared primitives (Button, Input, Select, etc.)
- `runtime-invariants.ts` — cross-path verification of calc outputs at render time

**Invariants:**
1. No data fetching inside components — use React Query hooks from `src/data/hooks/`.
2. No direct localStorage access — go through `src/store/auth-store`.
3. Partner branding (logo, theme) is always sourced from `src/partner/apply-theme.ts` having run at app start; components read from CSS variables.
4. SapienEx attribution never appears outside `layout/Footer.tsx`.

**Dependencies:** React, `@/schema/types`, `@/store/*`, `@/data/*`, `@/calc/*`, `@/format/format`.
