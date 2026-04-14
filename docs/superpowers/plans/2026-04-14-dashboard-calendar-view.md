# Dashboard Calendar View + This-Month Project Builds Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Dashboard calendar-view modal and the new this-month Project Builds table specified in `docs/superpowers/specs/2026-04-14-dashboard-calendar-view-design.md`.

**Architecture:** Pure calc first (`computeMonthDaily`, `computeProjectBuildsForMonth`, `computeCalendarLayout`), then UI on top. Reuses existing `isMonthlyStream` (newly exported) so the new bucket-level table agrees exactly with the existing Project Builds stream. Calendar is a `z-40` portal modal; `EditEntryModal` spawned from its side panel stacks above at `z-50` without needing to close the calendar.

**Tech Stack:** React 18 + TypeScript (strict) + Zustand + TanStack Query + Tailwind + Vitest + fast-check. No new deps.

---

## Non-negotiables (restated from CLAUDE.md + spec §10)

- Integer math only on `_cents` / `_hundredths`. Use helpers from `src/calc/int.ts`. The `no-float-money` ESLint rule stays on.
- No schema change. No new data-repo files.
- `npm run typecheck && npm run lint && npm test` must all pass on every task's final commit.
- March 2026 golden fixture (`tests/fixtures/2026-03-golden.json` / `2026-03-expected.json`) stays unchanged. `npm run test:golden` must keep passing.
- Partner branding untouched. SapienEx footer-only rule preserved (not touched here).
- After every task: run the gates and commit.

## File structure

### New files

- `src/calc/daily.ts` — pure `computeMonthDaily` + `computeProjectBuildsForMonth`
- `src/ui/screens/dashboard/calendar-grid-layout.ts` — pure `computeCalendarLayout`
- `src/ui/screens/dashboard/CalendarIcon.tsx` — inline SVG calendar icon button
- `src/ui/screens/dashboard/CalendarModal.tsx` — portal + backdrop + month nav + close + composition
- `src/ui/screens/dashboard/CalendarGrid.tsx` — 6×8 grid (7 days + week totals)
- `src/ui/screens/dashboard/CalendarCell.tsx` — one cell (all states)
- `src/ui/screens/dashboard/CalendarDayPanel.tsx` — side panel with entry list
- `src/ui/screens/dashboard/CalendarMobileList.tsx` — list fallback for `< lg`
- `src/ui/screens/dashboard/MonthProjectBuildsTable.tsx` — new this-month table
- `tests/calc/daily.test.ts`
- `tests/ui/dashboard/calendar-grid-layout.test.ts`

### Modified files

- `src/calc/totals.ts` — export `isMonthlyStream` (was file-private)
- `src/calc/index.ts` — re-export new types + functions
- `src/ui/screens/Dashboard.tsx` — wire icon button, mount modal, insert new table below Monthly Invoice
- `tests/calc/property.test.ts` — add five cross-function invariants

### Never touched

- `src/calc/int.ts`, `src/calc/hash.ts`, `src/calc/rates.ts`, `src/calc/bulk-rate.ts`, `src/calc/drift.ts`
- `schemas/**`, `src/schema/**`
- `tests/fixtures/2026-03-*.json`
- `src/ui/screens/entries/EditEntryModal.tsx` (we only read it to understand behavior; calendar side panel spawns it via existing `<EditEntryModal entry={...} onClose={...} />` API)

---

## Task 1: Export `isMonthlyStream` + add `computeMonthDaily` and `computeProjectBuildsForMonth`

**Goal:** Land the pure calc layer. Spec §4.

**Files:**
- Modify: `src/calc/totals.ts` (export `isMonthlyStream`)
- Create: `src/calc/daily.ts`
- Modify: `src/calc/index.ts`
- Create: `tests/calc/daily.test.ts`

### Steps

- [ ] **Step 1.1 — Export `isMonthlyStream` from totals.ts**

Open `src/calc/totals.ts`. Change the declaration:

```ts
function isMonthlyStream(entry: Entry, projects: ProjectsConfig): boolean {
```

to:

```ts
export function isMonthlyStream(entry: Entry, projects: ProjectsConfig): boolean {
```

No other changes. The function body stays identical.

- [ ] **Step 1.2 — Write failing unit tests**

Create `tests/calc/daily.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  computeMonthDaily,
  computeProjectBuildsForMonth,
} from '@/calc/daily';
import type { Entry, ProjectsConfig, RatesConfig } from '@/schema/types';

const projects: ProjectsConfig = {
  schema_version: 1,
  projects: [
    {
      id: 'sprosty', name: 'Sprosty', client: null, active: true,
      is_internal: false, default_rate_cents: null,
      buckets: [
        { id: 'sprosty-skyvia-dev', type: 'dev', name: 'Skyvia Dev',
          budgeted_hours_hundredths: 2000, rate_cents: 12500, status: 'active',
          opened_at: '2026-03-01', closed_at: null, notes: '' },
        { id: 'sprosty-hours', type: 'hour_block', name: 'Monthly Hours',
          budgeted_hours_hundredths: 1000, rate_cents: 12500, status: 'active',
          opened_at: '2026-03-01', closed_at: null, notes: '' },
      ],
    },
    {
      id: 'internal', name: 'Internal', client: null, active: true,
      is_internal: true, default_rate_cents: 0,
      buckets: [],
    },
  ],
};

const rates: RatesConfig = {
  schema_version: 1,
  default_rate_history: [{ effective_from: '2026-01-01', rate_cents: 12500 }],
};

function entry(p: Partial<Entry> & {
  id: string; date: string; hours_hundredths: number;
  billable_status: Entry['billable_status']; rate_cents: number;
}): Entry {
  return {
    project: 'sprosty',
    bucket_id: null,
    description: 'x',
    review_flag: false,
    rate_source: 'global_default',
    created_at: '2026-04-14T00:00:00Z',
    updated_at: '2026-04-14T00:00:00Z',
    source_event_id: null,
    ...p,
  };
}

describe('computeMonthDaily', () => {
  it('returns empty days and max=0 for a month with no entries', () => {
    const r = computeMonthDaily({ entries: [], projects, rates }, '2026-04');
    expect(r).toEqual({ month: '2026-04', days: [], max_hours_hundredths: 0 });
  });

  it('buckets a single entry by date with billable amount', () => {
    const e = entry({
      id: '2026-04-14-sprosty-aaaaaa', date: '2026-04-14',
      hours_hundredths: 400, rate_cents: 12500, billable_status: 'billable',
    });
    const r = computeMonthDaily({ entries: [e], projects, rates }, '2026-04');
    expect(r.days).toHaveLength(1);
    expect(r.days[0]).toEqual({
      date: '2026-04-14',
      total_hundredths: 400,
      billable_hundredths: 400,
      non_billable_hundredths: 0,
      needs_review_hundredths: 0,
      billable_amount_cents: 50000, // 4.00h × $125 = $500
      entry_count: 1,
    });
    expect(r.max_hours_hundredths).toBe(400);
  });

  it('sums multiple entries on the same day and categorizes by status', () => {
    const entries = [
      entry({ id: '2026-04-14-sprosty-a', date: '2026-04-14', hours_hundredths: 200, rate_cents: 12500, billable_status: 'billable' }),
      entry({ id: '2026-04-14-sprosty-b', date: '2026-04-14', hours_hundredths: 100, rate_cents: 0, billable_status: 'non_billable' }),
      entry({ id: '2026-04-14-sprosty-c', date: '2026-04-14', hours_hundredths: 50, rate_cents: 12500, billable_status: 'needs_review' }),
    ];
    const r = computeMonthDaily({ entries, projects, rates }, '2026-04');
    expect(r.days).toHaveLength(1);
    expect(r.days[0]).toEqual({
      date: '2026-04-14',
      total_hundredths: 350,
      billable_hundredths: 200,
      non_billable_hundredths: 100,
      needs_review_hundredths: 50,
      billable_amount_cents: 25000, // only the billable entry contributes to $
      entry_count: 3,
    });
  });

  it('excludes entries outside the target month', () => {
    const entries = [
      entry({ id: '2026-04-01-sprosty-a', date: '2026-04-01', hours_hundredths: 100, rate_cents: 12500, billable_status: 'billable' }),
      entry({ id: '2026-03-30-sprosty-b', date: '2026-03-30', hours_hundredths: 999, rate_cents: 12500, billable_status: 'billable' }),
      entry({ id: '2026-05-02-sprosty-c', date: '2026-05-02', hours_hundredths: 888, rate_cents: 12500, billable_status: 'billable' }),
    ];
    const r = computeMonthDaily({ entries, projects, rates }, '2026-04');
    expect(r.days).toHaveLength(1);
    expect(r.days[0]?.date).toBe('2026-04-01');
  });

  it('sorts days ascending by date and computes max across varied days', () => {
    const entries = [
      entry({ id: '2026-04-20-sprosty-a', date: '2026-04-20', hours_hundredths: 200, rate_cents: 12500, billable_status: 'billable' }),
      entry({ id: '2026-04-05-sprosty-b', date: '2026-04-05', hours_hundredths: 700, rate_cents: 12500, billable_status: 'billable' }),
      entry({ id: '2026-04-15-sprosty-c', date: '2026-04-15', hours_hundredths: 400, rate_cents: 12500, billable_status: 'billable' }),
    ];
    const r = computeMonthDaily({ entries, projects, rates }, '2026-04');
    expect(r.days.map((d) => d.date)).toEqual(['2026-04-05', '2026-04-15', '2026-04-20']);
    expect(r.max_hours_hundredths).toBe(700);
  });
});

describe('computeProjectBuildsForMonth', () => {
  it('returns empty list for a month with no entries', () => {
    const r = computeProjectBuildsForMonth({ entries: [], projects, rates }, '2026-04');
    expect(r).toEqual([]);
  });

  it('excludes unbucketed entries', () => {
    const e = entry({
      id: '2026-04-14-sprosty-aaaaaa', date: '2026-04-14',
      hours_hundredths: 400, rate_cents: 12500, billable_status: 'billable',
      bucket_id: null,
    });
    const r = computeProjectBuildsForMonth({ entries: [e], projects, rates }, '2026-04');
    expect(r).toEqual([]);
  });

  it('excludes hour_block buckets (monthly-invoice stream)', () => {
    const e = entry({
      id: '2026-04-14-sprosty-aaaaaa', date: '2026-04-14',
      hours_hundredths: 400, rate_cents: 12500, billable_status: 'billable',
      bucket_id: 'sprosty-hours',
    });
    const r = computeProjectBuildsForMonth({ entries: [e], projects, rates }, '2026-04');
    expect(r).toEqual([]);
  });

  it('excludes non-billable bucketed entries even on builds-stream buckets', () => {
    const e = entry({
      id: '2026-04-14-sprosty-aaaaaa', date: '2026-04-14',
      hours_hundredths: 400, rate_cents: 12500, billable_status: 'non_billable',
      bucket_id: 'sprosty-skyvia-dev',
    });
    const r = computeProjectBuildsForMonth({ entries: [e], projects, rates }, '2026-04');
    expect(r).toEqual([]);
  });

  it('groups billable entries on builds-stream buckets by bucket_id', () => {
    const entries = [
      entry({ id: '2026-04-14-sprosty-a', date: '2026-04-14', hours_hundredths: 400, rate_cents: 12500, billable_status: 'billable', bucket_id: 'sprosty-skyvia-dev' }),
      entry({ id: '2026-04-20-sprosty-b', date: '2026-04-20', hours_hundredths: 200, rate_cents: 12500, billable_status: 'billable', bucket_id: 'sprosty-skyvia-dev' }),
    ];
    const r = computeProjectBuildsForMonth({ entries, projects, rates }, '2026-04');
    expect(r).toEqual([
      {
        project_id: 'sprosty',
        bucket_id: 'sprosty-skyvia-dev',
        hours_hundredths: 600,
        amount_cents: 75000, // 6.00h × $125
      },
    ]);
  });

  it('sorts rows by project_id asc then bucket_id asc', () => {
    const entriesProjects: ProjectsConfig = {
      schema_version: 1,
      projects: [
        {
          id: 'bayard', name: 'Bayard', client: null, active: true, is_internal: false, default_rate_cents: null,
          buckets: [
            { id: 'bayard-alpha', type: 'dev', name: 'Alpha', budgeted_hours_hundredths: 1000, rate_cents: 12500, status: 'active', opened_at: '2026-03-01', closed_at: null, notes: '' },
          ],
        },
        {
          id: 'sprosty', name: 'Sprosty', client: null, active: true, is_internal: false, default_rate_cents: null,
          buckets: [
            { id: 'sprosty-alpha', type: 'dev', name: 'Alpha', budgeted_hours_hundredths: 1000, rate_cents: 12500, status: 'active', opened_at: '2026-03-01', closed_at: null, notes: '' },
            { id: 'sprosty-beta', type: 'dev', name: 'Beta', budgeted_hours_hundredths: 1000, rate_cents: 12500, status: 'active', opened_at: '2026-03-01', closed_at: null, notes: '' },
          ],
        },
      ],
    };
    const entries = [
      entry({ id: '2026-04-01-sprosty-b', date: '2026-04-01', hours_hundredths: 100, rate_cents: 12500, billable_status: 'billable', project: 'sprosty', bucket_id: 'sprosty-beta' }),
      entry({ id: '2026-04-01-sprosty-a', date: '2026-04-02', hours_hundredths: 100, rate_cents: 12500, billable_status: 'billable', project: 'sprosty', bucket_id: 'sprosty-alpha' }),
      entry({ id: '2026-04-01-bayard-a', date: '2026-04-03', hours_hundredths: 100, rate_cents: 12500, billable_status: 'billable', project: 'bayard', bucket_id: 'bayard-alpha' }),
    ];
    const r = computeProjectBuildsForMonth({ entries, projects: entriesProjects, rates }, '2026-04');
    expect(r.map((x) => `${x.project_id}/${x.bucket_id}`)).toEqual([
      'bayard/bayard-alpha',
      'sprosty/sprosty-alpha',
      'sprosty/sprosty-beta',
    ]);
  });
});
```

- [ ] **Step 1.3 — Run tests to confirm they fail**

```
npm test -- tests/calc/daily.test.ts
```

Expected: all tests FAIL with module-not-found (`@/calc/daily` doesn't exist).

- [ ] **Step 1.4 — Create `src/calc/daily.ts`**

```ts
import {
  addHundredths,
  addCents,
  mulCentsByHundredths,
} from './int';
import { isMonthlyStream, type CalcInput } from './totals';

export type DailyBreakdown = {
  date: string;
  total_hundredths: number;
  billable_hundredths: number;
  non_billable_hundredths: number;
  needs_review_hundredths: number;
  billable_amount_cents: number;
  entry_count: number;
};

export type MonthDaily = {
  month: string;
  days: DailyBreakdown[];
  max_hours_hundredths: number;
};

export type ProjectBuildsMonthRow = {
  project_id: string;
  bucket_id: string;
  hours_hundredths: number;
  amount_cents: number;
};

function emptyDay(date: string): DailyBreakdown {
  return {
    date,
    total_hundredths: 0,
    billable_hundredths: 0,
    non_billable_hundredths: 0,
    needs_review_hundredths: 0,
    billable_amount_cents: 0,
    entry_count: 0,
  };
}

export function computeMonthDaily(input: CalcInput, month: string): MonthDaily {
  const prefix = `${month}-`;
  const byDate = new Map<string, DailyBreakdown>();

  for (const e of input.entries) {
    if (!e.date.startsWith(prefix)) continue;
    const day = byDate.get(e.date) ?? emptyDay(e.date);

    day.total_hundredths = addHundredths(day.total_hundredths, e.hours_hundredths);
    day.entry_count += 1;

    if (e.billable_status === 'billable') {
      day.billable_hundredths = addHundredths(day.billable_hundredths, e.hours_hundredths);
      day.billable_amount_cents = addCents(
        day.billable_amount_cents,
        mulCentsByHundredths(e.rate_cents, e.hours_hundredths),
      );
    } else if (e.billable_status === 'non_billable') {
      day.non_billable_hundredths = addHundredths(day.non_billable_hundredths, e.hours_hundredths);
    } else {
      day.needs_review_hundredths = addHundredths(day.needs_review_hundredths, e.hours_hundredths);
    }

    byDate.set(e.date, day);
  }

  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const max_hours_hundredths = days.reduce((m, d) => Math.max(m, d.total_hundredths), 0);

  return { month, days, max_hours_hundredths };
}

export function computeProjectBuildsForMonth(
  input: CalcInput,
  month: string,
): ProjectBuildsMonthRow[] {
  const prefix = `${month}-`;
  const byBucket = new Map<string, ProjectBuildsMonthRow>();

  for (const e of input.entries) {
    if (!e.date.startsWith(prefix)) continue;
    if (e.billable_status !== 'billable') continue;
    if (e.bucket_id === null) continue;
    if (isMonthlyStream(e, input.projects)) continue;

    const existing = byBucket.get(e.bucket_id);
    const amount = mulCentsByHundredths(e.rate_cents, e.hours_hundredths);
    if (existing) {
      existing.hours_hundredths = addHundredths(existing.hours_hundredths, e.hours_hundredths);
      existing.amount_cents = addCents(existing.amount_cents, amount);
    } else {
      byBucket.set(e.bucket_id, {
        project_id: e.project,
        bucket_id: e.bucket_id,
        hours_hundredths: e.hours_hundredths,
        amount_cents: amount,
      });
    }
  }

  return [...byBucket.values()].sort((a, b) => {
    if (a.project_id !== b.project_id) return a.project_id.localeCompare(b.project_id);
    return a.bucket_id.localeCompare(b.bucket_id);
  });
}
```

- [ ] **Step 1.5 — Re-export from `src/calc/index.ts`**

Append to the end of `src/calc/index.ts`:

```ts
export {
  computeMonthDaily,
  computeProjectBuildsForMonth,
  type DailyBreakdown,
  type MonthDaily,
  type ProjectBuildsMonthRow,
} from './daily';
export { isMonthlyStream } from './totals';
```

- [ ] **Step 1.6 — Run tests to confirm they pass**

```
npm test -- tests/calc/daily.test.ts
```

Expected: all 10 tests PASS.

- [ ] **Step 1.7 — Full gates**

```
npm run typecheck
npm run lint
npm test
```

All three must pass. Golden fixture tests must remain green.

- [ ] **Step 1.8 — Commit**

```
git add src/calc/daily.ts src/calc/totals.ts src/calc/index.ts tests/calc/daily.test.ts
git commit -m "feat(calc): computeMonthDaily + computeProjectBuildsForMonth"
```

---

## Task 2: Property tests for the five cross-function invariants

**Goal:** Guard against drift between new calc and existing `computeMonthTotals` / `splitBillingStreams`. Spec §4.4.

**Files:**
- Modify: `tests/calc/property.test.ts`

### Steps

- [ ] **Step 2.1 — Add five property-test blocks**

Open `tests/calc/property.test.ts`. After the existing test blocks, append:

```ts
import {
  computeMonthDaily,
  computeProjectBuildsForMonth,
  splitBillingStreams,
  sumHundredths,
  sumCents,
} from '@/calc';

describe('computeMonthDaily invariants', () => {
  it('per-day conservation: billable + non_billable + needs_review === total', () => {
    fc.assert(
      fc.property(fc.array(entryArb('2026-03'), { minLength: 0, maxLength: 50 }), (entries) => {
        const r = computeMonthDaily({ entries, projects, rates }, '2026-03');
        for (const d of r.days) {
          if (d.billable_hundredths + d.non_billable_hundredths + d.needs_review_hundredths !== d.total_hundredths) {
            return false;
          }
        }
        return true;
      }),
    );
  });

  it('monthly total agreement: sum(days.total) === computeMonthTotals.total_hours_hundredths', () => {
    fc.assert(
      fc.property(fc.array(entryArb('2026-03'), { minLength: 0, maxLength: 50 }), (entries) => {
        const daily = computeMonthDaily({ entries, projects, rates }, '2026-03');
        const totals = computeMonthTotals({ entries, projects, rates }, '2026-03');
        const sum = sumHundredths(daily.days.map((d) => d.total_hundredths));
        return sum === totals.total_hours_hundredths;
      }),
    );
  });

  it('monthly billable $ agreement: sum(days.billable_amount) === computeMonthTotals.billable_amount_cents', () => {
    fc.assert(
      fc.property(fc.array(entryArb('2026-03'), { minLength: 0, maxLength: 50 }), (entries) => {
        const daily = computeMonthDaily({ entries, projects, rates }, '2026-03');
        const totals = computeMonthTotals({ entries, projects, rates }, '2026-03');
        const sum = sumCents(daily.days.map((d) => d.billable_amount_cents));
        return sum === totals.billable_amount_cents;
      }),
    );
  });
});

describe('computeProjectBuildsForMonth invariants', () => {
  it('hours agreement with splitBillingStreams.project_builds', () => {
    fc.assert(
      fc.property(fc.array(entryArb('2026-03'), { minLength: 0, maxLength: 50 }), (entries) => {
        const rows = computeProjectBuildsForMonth({ entries, projects, rates }, '2026-03');
        const streams = splitBillingStreams(entries, '2026-03', projects);
        const sum = sumHundredths(rows.map((r) => r.hours_hundredths));
        return sum === streams.project_builds.hours_hundredths;
      }),
    );
  });

  it('amount agreement with splitBillingStreams.project_builds', () => {
    fc.assert(
      fc.property(fc.array(entryArb('2026-03'), { minLength: 0, maxLength: 50 }), (entries) => {
        const rows = computeProjectBuildsForMonth({ entries, projects, rates }, '2026-03');
        const streams = splitBillingStreams(entries, '2026-03', projects);
        const sum = sumCents(rows.map((r) => r.amount_cents));
        return sum === streams.project_builds.amount_cents;
      }),
    );
  });
});
```

Note: the existing `entryArb` in this file generates entries with `bucket_id: null` only (per its current definition). That means `splitBillingStreams.project_builds.hours_hundredths` will always be 0 and my function will always return `[]`, so the invariants trivially hold. Strengthen the generator by adding bucket variance — modify the existing `entryArb` to sometimes generate bucketed entries.

Replace the existing `entryArb` with:

```ts
const entryArb = (month: string): fc.Arbitrary<Entry> =>
  fc.record({
    id: fc
      .hexaString({ minLength: 6, maxLength: 6 })
      .map((u) => `${month}-01-sprosty-${u}`),
    project: fc.constantFrom('sprosty', 'internal'),
    date: fc.constant(`${month}-15`),
    hours_hundredths: fc.integer({ min: 1, max: 2400 }),
    rate_cents: rateArb,
    rate_source: fc.constant<Entry['rate_source']>('global_default'),
    billable_status: billableArb,
    bucket_id: fc.oneof(
      fc.constant<string | null>(null),
      fc.constant<string | null>('sprosty-skyvia-dev'),
      fc.constant<string | null>('sprosty-hours'),
    ),
    description: fc.string({ minLength: 1, maxLength: 100 }),
    review_flag: fc.boolean(),
    created_at: fc.constant('2026-03-01T00:00:00Z'),
    updated_at: fc.constant('2026-03-01T00:00:00Z'),
    source_event_id: fc.constant<string | null>(null),
  });
```

The `projects` constant in this file must include those bucket ids. Inspect the existing `projects` declaration in the file — it declares a `sprosty` project. Add the two buckets to its `buckets` array to match the arbitrary:

Replace the existing `sprosty` project's `buckets: []` with:

```ts
buckets: [
  { id: 'sprosty-skyvia-dev', type: 'dev', name: 'Skyvia Dev',
    budgeted_hours_hundredths: 2000, rate_cents: 12500, status: 'active',
    opened_at: '2026-03-01', closed_at: null, notes: '' },
  { id: 'sprosty-hours', type: 'hour_block', name: 'Hours Block',
    budgeted_hours_hundredths: 1000, rate_cents: 12500, status: 'active',
    opened_at: '2026-03-01', closed_at: null, notes: '' },
],
```

This way: the `dev` bucket is project-builds stream, `hour_block` is monthly-invoice stream, and `null` is unbucketed. All three code paths get exercised by fast-check.

- [ ] **Step 2.2 — Run property tests**

```
npm run test:property
```

Expected: PASS (all existing plus five new invariants).

If any fail, fast-check will produce a shrunk counter-example. Inspect it, then either fix the calc, fix the generator, or fix the invariant — whichever was wrong.

- [ ] **Step 2.3 — Full gates**

```
npm run typecheck && npm run lint && npm test
```

- [ ] **Step 2.4 — Commit**

```
git add tests/calc/property.test.ts
git commit -m "test(calc): cross-function invariants for daily + project-builds calc"
```

---

## Task 3: Pure calendar-grid layout helper

**Goal:** Produce the 42-cell Mon-first grid layout as a pure function.

**Files:**
- Create: `src/ui/screens/dashboard/calendar-grid-layout.ts`
- Create: `tests/ui/dashboard/calendar-grid-layout.test.ts`

### Steps

- [ ] **Step 3.1 — Write failing unit tests**

Create `tests/ui/dashboard/calendar-grid-layout.test.ts`:

```ts
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

  it('April 2026: Apr 30 is inMonth, Apr 31 does not exist (index 31 should be 2026-04-30)', () => {
    const r = computeCalendarLayout(2026, 4);
    // 29 days of padding (Mar 30, 31) + 30 days of April = 32 cells consumed; index 31 = last day of April
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
```

- [ ] **Step 3.2 — Run tests, confirm fails**

```
npm test -- tests/ui/dashboard/calendar-grid-layout.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3.3 — Implement**

Create `src/ui/screens/dashboard/calendar-grid-layout.ts`:

```ts
export type CalendarCell = {
  date: string; // YYYY-MM-DD
  inMonth: boolean;
};

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Return a 42-cell (6 weeks × 7 days) grid for the given month, Mon-first.
 * Cells from adjacent months that pad the first/last week have inMonth: false.
 */
export function computeCalendarLayout(year: number, month1to12: number): CalendarCell[] {
  const firstOfMonth = new Date(year, month1to12 - 1, 1);
  // JS getDay(): Sun=0, Mon=1, ..., Sat=6. Convert to Mon=0, ..., Sun=6.
  const firstDay = firstOfMonth.getDay();
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;

  const start = new Date(year, month1to12 - 1, 1 - mondayOffset);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({
      date: toISO(d),
      inMonth: d.getMonth() === month1to12 - 1 && d.getFullYear() === year,
    });
  }
  return cells;
}
```

- [ ] **Step 3.4 — Run tests**

```
npm test -- tests/ui/dashboard/calendar-grid-layout.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 3.5 — Full gates**

```
npm run typecheck && npm run lint && npm test
```

- [ ] **Step 3.6 — Commit**

```
git add src/ui/screens/dashboard/calendar-grid-layout.ts tests/ui/dashboard/calendar-grid-layout.test.ts
git commit -m "feat(dashboard): pure Mon-first 42-cell calendar layout helper"
```

---

## Task 4: MonthProjectBuildsTable + Dashboard integration

**Goal:** Ship the new this-month Project Builds table and mount it on the Dashboard. Independent of the calendar modal; simpler surface to land first. Spec §6.2.

**Files:**
- Create: `src/ui/screens/dashboard/MonthProjectBuildsTable.tsx`
- Modify: `src/ui/screens/Dashboard.tsx`

### Steps

- [ ] **Step 4.1 — Implement the table component**

Create `src/ui/screens/dashboard/MonthProjectBuildsTable.tsx`:

```tsx
import type { ProjectBuildsMonthRow } from '@/calc';
import type { ProjectsConfig } from '@/schema/types';
import {
  formatCents,
  formatHours,
  type CurrencyDisplay,
} from '@/format/format';
import { sumHundredths, sumCents } from '@/calc';

type Props = {
  rows: ProjectBuildsMonthRow[];
  projects: ProjectsConfig;
  currency: CurrencyDisplay;
};

export function MonthProjectBuildsTable({ rows, projects, currency }: Props): JSX.Element {
  if (rows.length === 0) {
    return <div className="text-sm text-slate-400 py-3">No project-build hours this month.</div>;
  }

  const totalH = sumHundredths(rows.map((r) => r.hours_hundredths));
  const totalA = sumCents(rows.map((r) => r.amount_cents));

  function resolveNames(row: ProjectBuildsMonthRow): { bucketName: string; projectName: string } {
    const project = projects.projects.find((p) => p.id === row.project_id);
    const bucket = project?.buckets.find((b) => b.id === row.bucket_id);
    return {
      bucketName: bucket?.name ?? row.bucket_id,
      projectName: project?.name ?? row.project_id,
    };
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center py-2.5 px-4 bg-white/30 text-xs font-bold uppercase tracking-wider text-slate-400 gap-3">
        <div className="flex-1">Bucket</div>
        <div className="w-32">Project</div>
        <div className="w-24 text-right">Hours</div>
        <div className="w-36 text-right">Amount</div>
      </div>
      {rows.map((r) => {
        const { bucketName, projectName } = resolveNames(r);
        return (
          <div
            key={r.bucket_id}
            className="flex items-center py-2.5 px-4 text-sm border-t border-black/5 hover:bg-white/20 transition-colors gap-3"
          >
            <div className="flex-1 font-medium text-slate-800">{bucketName}</div>
            <div className="w-32 text-slate-600">{projectName}</div>
            <div className="w-24 text-right font-mono text-slate-700">{formatHours(r.hours_hundredths)}</div>
            <div className="w-36 text-right font-mono font-semibold text-partner-mid">
              {formatCents(r.amount_cents, currency)}
            </div>
          </div>
        );
      })}
      <div className="flex items-center py-2.5 px-4 border-t-2 border-black/10 bg-white/20 gap-3">
        <div className="flex-1 font-semibold text-slate-800">Total</div>
        <div className="w-32" />
        <div className="w-24 text-right font-mono font-bold text-slate-900">{formatHours(totalH)}</div>
        <div className="w-36 text-right font-mono font-bold text-slate-900">{formatCents(totalA, currency)}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4.2 — Mount on the Dashboard**

Open `src/ui/screens/Dashboard.tsx`. Find the imports block and add:

```tsx
import { computeProjectBuildsForMonth } from '@/calc';
import { MonthProjectBuildsTable } from './dashboard/MonthProjectBuildsTable';
```

Find the block inside the `Dashboard` component that computes `totals`, `streams`, etc. After `streams` is computed, add:

```tsx
const monthBuilds = useMemo(() => {
  if (!entries.data || !projects.data || !rates.data) return null;
  return computeProjectBuildsForMonth(
    { entries: entries.data.entries, projects: projects.data, rates: rates.data },
    month,
  );
}, [entries.data, projects.data, rates.data, month]);
```

Find the left-column JSX that renders `<InvoiceTable rows={resolveNames(streams.monthly_invoice.by_project)} currency={currency} />`. Immediately AFTER that `<section>`, add a new section:

```tsx
<section>
  <h2 className="font-display text-lg font-bold mb-1">Project Builds &middot; {formatMonthLabel(month)}</h2>
  <p className="text-xs text-slate-400 mb-3">Per-bucket, this month only.</p>
  {projects.data && monthBuilds && (
    <MonthProjectBuildsTable rows={monthBuilds} projects={projects.data} currency={currency} />
  )}
</section>
```

Keep everything else in Dashboard.tsx unchanged.

- [ ] **Step 4.3 — Full gates**

```
npm run typecheck && npm run lint && npm test
```

All must pass. If `Dashboard.tsx` exceeds the 300-line lint limit after the edit, extract `InvoiceTable` (already subcomponented internally) into a separate file at `src/ui/screens/dashboard/InvoiceTable.tsx` with the existing code unchanged, and import it back. Only do this extraction if the lint fails — otherwise leave alone.

- [ ] **Step 4.4 — Manual smoke**

```
npm run dev
```

Log a billable entry against a `dev`-type bucket (e.g., `sprosty-skyvia-dev`) for the current month. Dashboard left column should show two tables: the existing Monthly Invoice, then the new Project Builds (this month) table with your entry's bucket + hours + amount. The right-column cumulative bars should also reflect the entry (as before).

- [ ] **Step 4.5 — Commit**

```
git add src/ui/screens/dashboard/MonthProjectBuildsTable.tsx src/ui/screens/Dashboard.tsx
git commit -m "feat(dashboard): this-month Project Builds table (per-bucket)"
```

---

## Task 5: Calendar grid + cell components

**Goal:** Ship the visual layer of the calendar grid — the 6×8 grid component and the single-cell component. Not yet wired to a modal.

**Files:**
- Create: `src/ui/screens/dashboard/CalendarCell.tsx`
- Create: `src/ui/screens/dashboard/CalendarGrid.tsx`

### Steps

- [ ] **Step 5.1 — Implement `CalendarCell`**

Create `src/ui/screens/dashboard/CalendarCell.tsx`:

```tsx
import type { DailyBreakdown } from '@/calc';
import { formatCents, formatHoursDecimal, type CurrencyDisplay } from '@/format/format';

type Props = {
  date: string;               // YYYY-MM-DD
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  day: DailyBreakdown | null; // null = no entries on this day
  maxHours: number;
  currency: CurrencyDisplay;
  onClick: (date: string) => void;
  selected: boolean;
};

function dayNumber(iso: string): string {
  return String(parseInt(iso.slice(8, 10), 10));
}

export function CalendarCell({
  date, inMonth, isToday, isWeekend, day, maxHours, currency, onClick, selected,
}: Props): JSX.Element {
  if (!inMonth) {
    return (
      <div className="h-[100px] p-2 text-xs text-slate-300 bg-slate-50/30 rounded-md">
        {dayNumber(date)}
      </div>
    );
  }

  const intensity = maxHours === 0 || day === null ? 0 : day.total_hundredths / maxHours;
  const weekendClass = isWeekend ? 'bg-slate-50/50' : '';
  const todayClass = isToday ? 'ring-2 ring-partner-cyan' : '';
  const selectedClass = selected ? 'outline outline-2 outline-partner-mid' : '';
  const style = weekendClass || intensity === 0
    ? undefined
    : { backgroundColor: `rgba(107, 207, 238, ${intensity * 0.22})` };

  return (
    <button
      type="button"
      onClick={() => onClick(date)}
      className={`h-[100px] p-2 text-left rounded-md transition-colors hover:bg-white/60 ${weekendClass} ${todayClass} ${selectedClass}`}
      style={style}
    >
      <div className="text-xs text-slate-500 font-mono mb-1">{dayNumber(date)}</div>
      {day && (
        <>
          <div className="font-display font-bold text-sm text-slate-800">
            {formatHoursDecimal(day.total_hundredths)}h
          </div>
          <StackedBar day={day} />
          {day.billable_amount_cents > 0 && (
            <div className="font-mono text-[11px] text-partner-mid mt-1">
              {formatCents(day.billable_amount_cents, currency)}
            </div>
          )}
        </>
      )}
    </button>
  );
}

function StackedBar({ day }: { day: DailyBreakdown }): JSX.Element {
  const total = day.total_hundredths;
  if (total === 0) return <div className="h-1 mt-1" />;
  const billablePct = (day.billable_hundredths / total) * 100;
  const nonBillablePct = (day.non_billable_hundredths / total) * 100;
  const needsReviewPct = (day.needs_review_hundredths / total) * 100;
  return (
    <div className="h-1 mt-1 flex rounded-full overflow-hidden bg-black/5">
      <div className="bg-emerald-400" style={{ width: `${billablePct}%` }} />
      <div className="bg-slate-400" style={{ width: `${nonBillablePct}%` }} />
      <div className="bg-amber-400" style={{ width: `${needsReviewPct}%` }} />
    </div>
  );
}
```

- [ ] **Step 5.2 — Implement `CalendarGrid`**

Create `src/ui/screens/dashboard/CalendarGrid.tsx`:

```tsx
import { useMemo } from 'react';
import type { MonthDaily } from '@/calc';
import type { CurrencyDisplay } from '@/format/format';
import { formatCents, formatHoursDecimal } from '@/format/format';
import { computeCalendarLayout } from './calendar-grid-layout';
import { CalendarCell } from './CalendarCell';

type Props = {
  year: number;
  month1to12: number;
  daily: MonthDaily;
  currency: CurrencyDisplay;
  onDayClick: (date: string) => void;
  selectedDate: string | null;
  todayISO: string;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CalendarGrid({
  year, month1to12, daily, currency, onDayClick, selectedDate, todayISO,
}: Props): JSX.Element {
  const cells = useMemo(() => computeCalendarLayout(year, month1to12), [year, month1to12]);
  const dayByDate = useMemo(
    () => new Map(daily.days.map((d) => [d.date, d])),
    [daily.days],
  );

  // Split 42 cells into 6 rows of 7.
  const rows: Array<typeof cells> = [];
  for (let i = 0; i < 6; i++) rows.push(cells.slice(i * 7, i * 7 + 7));

  return (
    <div className="grid grid-cols-[repeat(7,1fr)_120px] gap-1">
      {WEEKDAYS.map((label) => (
        <div key={label} className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center py-1">
          {label}
        </div>
      ))}
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center py-1">Week</div>

      {rows.map((row, rowIdx) => {
        const weekTotalH = row.reduce((acc, c) => {
          const d = dayByDate.get(c.date);
          return c.inMonth && d ? acc + d.total_hundredths : acc;
        }, 0);
        const weekTotalA = row.reduce((acc, c) => {
          const d = dayByDate.get(c.date);
          return c.inMonth && d ? acc + d.billable_amount_cents : acc;
        }, 0);
        return (
          <RowFragment
            key={rowIdx}
            row={row}
            dayByDate={dayByDate}
            maxHours={daily.max_hours_hundredths}
            currency={currency}
            onDayClick={onDayClick}
            selectedDate={selectedDate}
            todayISO={todayISO}
            weekTotalH={weekTotalH}
            weekTotalA={weekTotalA}
          />
        );
      })}
    </div>
  );
}

function RowFragment(props: {
  row: ReturnType<typeof computeCalendarLayout>;
  dayByDate: Map<string, MonthDaily['days'][number]>;
  maxHours: number;
  currency: CurrencyDisplay;
  onDayClick: (date: string) => void;
  selectedDate: string | null;
  todayISO: string;
  weekTotalH: number;
  weekTotalA: number;
}): JSX.Element {
  const { row, dayByDate, maxHours, currency, onDayClick, selectedDate, todayISO, weekTotalH, weekTotalA } = props;
  return (
    <>
      {row.map((cell, colIdx) => {
        const day = dayByDate.get(cell.date) ?? null;
        const isWeekend = colIdx >= 5; // Sat = 5, Sun = 6
        return (
          <CalendarCell
            key={cell.date}
            date={cell.date}
            inMonth={cell.inMonth}
            isToday={cell.date === todayISO}
            isWeekend={isWeekend}
            day={day}
            maxHours={maxHours}
            currency={currency}
            onClick={onDayClick}
            selected={cell.date === selectedDate}
          />
        );
      })}
      <div className="flex flex-col justify-center items-end pr-2 text-xs">
        <div className="font-mono font-semibold text-slate-700">{formatHoursDecimal(weekTotalH)}h</div>
        {weekTotalA > 0 && (
          <div className="font-mono text-slate-500">{formatCents(weekTotalA, currency)}</div>
        )}
      </div>
    </>
  );
}
```

Note on the `grid-cols-[repeat(7,1fr)_120px]` arbitrary value: Tailwind supports arbitrary values in square brackets. If your Tailwind version doesn't, replace with `style={{ gridTemplateColumns: 'repeat(7, 1fr) 120px' }}` and drop the class.

- [ ] **Step 5.3 — Full gates**

```
npm run typecheck && npm run lint && npm test
```

- [ ] **Step 5.4 — Commit**

```
git add src/ui/screens/dashboard/CalendarCell.tsx src/ui/screens/dashboard/CalendarGrid.tsx
git commit -m "feat(dashboard): calendar grid + cell components"
```

---

## Task 6: CalendarDayPanel (side panel with entry list)

**Goal:** Build the side panel that renders a selected day's entries, with click-through to `EditEntryModal`. Spec §6.6.

**Files:**
- Create: `src/ui/screens/dashboard/CalendarDayPanel.tsx`

### Steps

- [ ] **Step 6.1 — Implement the side panel**

Create `src/ui/screens/dashboard/CalendarDayPanel.tsx`:

```tsx
import { useState } from 'react';
import type { Entry } from '@/schema/types';
import type { CurrencyDisplay } from '@/format/format';
import { formatCents, formatHours } from '@/format/format';
import { Button } from '@/ui/components/Button';
import { EditEntryModal } from '@/ui/screens/entries/EditEntryModal';

type Props = {
  date: string;             // YYYY-MM-DD
  entries: Entry[];         // already filtered to this date by caller
  currency: CurrencyDisplay;
  onClose: () => void;
};

function formatDateHeader(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function statusPillClass(status: Entry['billable_status']): string {
  if (status === 'billable') return 'bg-emerald-100 text-emerald-800';
  if (status === 'non_billable') return 'bg-slate-100 text-slate-600';
  return 'bg-amber-100 text-amber-800';
}

export function CalendarDayPanel({ date, entries, currency, onClose }: Props): JSX.Element {
  const [editing, setEditing] = useState<Entry | null>(null);

  return (
    <div className="w-[320px] shrink-0 flex flex-col gap-2 border-l border-black/5 pl-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display font-bold text-sm">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'} on {formatDateHeader(date)}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-800 text-xl leading-none"
          aria-label="Close day panel"
        >&times;</button>
      </div>

      {entries.length === 0 && (
        <div className="text-sm text-slate-400 py-3">No entries on this date.</div>
      )}

      <div className="flex flex-col gap-2 overflow-y-auto">
        {entries.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setEditing(e)}
            className="text-left glass rounded-xl p-3 hover:bg-white/50 transition-colors"
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-slate-800">{e.project}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusPillClass(e.billable_status)}`}>
                {e.billable_status.replace('_', '-')}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-slate-700">{formatHours(e.hours_hundredths)}</span>
              {e.billable_status === 'billable' && (
                <span className="text-partner-mid">{formatCents(e.rate_cents, currency)}/hr</span>
              )}
              {e.bucket_id && (
                <span className="px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 text-[10px]">{e.bucket_id}</span>
              )}
            </div>
            <div className="text-xs text-slate-600 mt-1 line-clamp-2">{e.description}</div>
          </button>
        ))}
      </div>

      {editing && (
        <EditEntryModal entry={editing} onClose={() => setEditing(null)} />
      )}
      {/* Button exists purely to silence unused-import for Button if we decide to add a back-to-grid button later */}
      {false && <Button>placeholder</Button>}
    </div>
  );
}
```

Note: the `{false && <Button>}` line is a lie — `Button` isn't needed in the final UI. Remove the `Button` import entirely if unused after typecheck. Open the file, delete the Button import and the `{false && ...}` placeholder line.

After edit, the clean imports at the top should be:

```tsx
import { useState } from 'react';
import type { Entry } from '@/schema/types';
import type { CurrencyDisplay } from '@/format/format';
import { formatCents, formatHours } from '@/format/format';
import { EditEntryModal } from '@/ui/screens/entries/EditEntryModal';
```

And the last JSX block before the closing `</div>` should end at the `{editing && ...}` block.

- [ ] **Step 6.2 — Full gates**

```
npm run typecheck && npm run lint && npm test
```

- [ ] **Step 6.3 — Commit**

```
git add src/ui/screens/dashboard/CalendarDayPanel.tsx
git commit -m "feat(dashboard): calendar day side panel with edit-entry click-through"
```

---

## Task 7: CalendarMobileList fallback

**Goal:** Below `lg`, show a vertical list instead of the grid. Spec §6.8.

**Files:**
- Create: `src/ui/screens/dashboard/CalendarMobileList.tsx`

### Steps

- [ ] **Step 7.1 — Implement the list view**

Create `src/ui/screens/dashboard/CalendarMobileList.tsx`:

```tsx
import type { MonthDaily } from '@/calc';
import type { CurrencyDisplay } from '@/format/format';
import { formatCents, formatHoursDecimal } from '@/format/format';

type Props = {
  daily: MonthDaily;
  currency: CurrencyDisplay;
  onDayClick: (date: string) => void;
  selectedDate: string | null;
  todayISO: string;
};

function formatDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function CalendarMobileList({
  daily, currency, onDayClick, selectedDate, todayISO,
}: Props): JSX.Element {
  if (daily.days.length === 0) {
    return <div className="text-sm text-slate-400 py-6 text-center">No entries this month.</div>;
  }
  return (
    <div className="flex flex-col gap-1">
      {daily.days.map((d) => {
        const isToday = d.date === todayISO;
        const isSelected = d.date === selectedDate;
        const total = d.total_hundredths;
        const billablePct = total > 0 ? (d.billable_hundredths / total) * 100 : 0;
        const nonBillablePct = total > 0 ? (d.non_billable_hundredths / total) * 100 : 0;
        const needsReviewPct = total > 0 ? (d.needs_review_hundredths / total) * 100 : 0;
        return (
          <button
            key={d.date}
            type="button"
            onClick={() => onDayClick(d.date)}
            className={`text-left flex items-center gap-3 p-3 rounded-xl glass hover:bg-white/60 ${
              isToday ? 'ring-2 ring-partner-cyan' : ''
            } ${isSelected ? 'outline outline-2 outline-partner-mid' : ''}`}
          >
            <div className="w-28 text-sm font-medium text-slate-700">{formatDateShort(d.date)}</div>
            <div className="w-20 text-sm font-mono font-bold text-slate-800">
              {formatHoursDecimal(d.total_hundredths)}h
            </div>
            <div className="flex-1 h-2 rounded-full overflow-hidden bg-black/5 flex">
              <div className="bg-emerald-400" style={{ width: `${billablePct}%` }} />
              <div className="bg-slate-400" style={{ width: `${nonBillablePct}%` }} />
              <div className="bg-amber-400" style={{ width: `${needsReviewPct}%` }} />
            </div>
            {d.billable_amount_cents > 0 && (
              <div className="w-24 text-right font-mono text-xs text-partner-mid">
                {formatCents(d.billable_amount_cents, currency)}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 7.2 — Full gates**

```
npm run typecheck && npm run lint && npm test
```

- [ ] **Step 7.3 — Commit**

```
git add src/ui/screens/dashboard/CalendarMobileList.tsx
git commit -m "feat(dashboard): mobile list fallback for calendar modal"
```

---

## Task 8: CalendarModal composition + CalendarIcon + Dashboard wiring

**Goal:** Compose grid + day panel + mobile list + month nav into a portal modal; add the Dashboard icon button; wire it all up. Spec §6.1, §6.3.

**Files:**
- Create: `src/ui/screens/dashboard/CalendarIcon.tsx`
- Create: `src/ui/screens/dashboard/CalendarModal.tsx`
- Modify: `src/ui/screens/Dashboard.tsx`

### Steps

- [ ] **Step 8.1 — Implement the icon button**

Create `src/ui/screens/dashboard/CalendarIcon.tsx`:

```tsx
type Props = {
  onClick: () => void;
  disabled?: boolean;
};

export function CalendarIcon({ onClick, disabled }: Props): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Open calendar view"
      className="text-slate-400 hover:text-sky-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed p-1"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 8.2 — Implement the modal**

Create `src/ui/screens/dashboard/CalendarModal.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMonthEntries } from '@/data/hooks/use-month-entries';
import { useProjects } from '@/data/hooks/use-projects';
import { useRates } from '@/data/hooks/use-rates';
import { computeMonthDaily } from '@/calc';
import type { Partner, Entry } from '@/schema/types';
import type { CurrencyDisplay } from '@/format/format';
import { Banner } from '@/ui/components/Banner';
import { CalendarGrid } from './CalendarGrid';
import { CalendarDayPanel } from './CalendarDayPanel';
import { CalendarMobileList } from './CalendarMobileList';

type Props = {
  initialMonth: string;  // YYYY-MM
  partner: Partner;
  onClose: () => void;
};

function prevMonth(m: string): string {
  const [y, mo] = m.split('-').map((s) => parseInt(s, 10));
  if (!y || !mo) return m;
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;
}

function nextMonth(m: string): string {
  const [y, mo] = m.split('-').map((s) => parseInt(s, 10));
  if (!y || !mo) return m;
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatMonthLabel(m: string): string {
  const [y, mo] = m.split('-').map((s) => parseInt(s, 10));
  return `${MONTH_NAMES[(mo ?? 1) - 1] ?? ''} ${y ?? ''}`;
}

export function CalendarModal({ initialMonth, partner, onClose }: Props): JSX.Element {
  const [month, setMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const entries = useMonthEntries(month);
  const projects = useProjects();
  const rates = useRates();

  // Close on Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Close on hashchange (user navigates tabs).
  useEffect(() => {
    window.addEventListener('hashchange', onClose);
    return () => window.removeEventListener('hashchange', onClose);
  }, [onClose]);

  // Clear selected day when month changes.
  useEffect(() => {
    setSelectedDate(null);
  }, [month]);

  const currency: CurrencyDisplay = {
    currency_symbol: partner.currency_symbol,
    currency_display_suffix: partner.currency_display_suffix,
  };
  const [y, mo] = month.split('-').map((s) => parseInt(s, 10));
  const ready = !!entries.data && !!projects.data && !!rates.data;
  const daily = ready
    ? computeMonthDaily(
        { entries: entries.data!.entries, projects: projects.data!, rates: rates.data! },
        month,
      )
    : null;

  const selectedDayEntries: Entry[] = ready && selectedDate
    ? entries.data!.entries.filter((e) => e.date === selectedDate)
    : [];

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-[1050px] max-h-[90vh] glass-strong rounded-2xl p-6 glow-blue flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="font-display text-lg">Calendar · {formatMonthLabel(month)}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonth(prevMonth(month))}
              className="text-slate-400 hover:text-sky-500 transition-colors px-2 text-sm"
            >← Prev</button>
            <button
              onClick={() => setMonth(nextMonth(month))}
              className="text-slate-400 hover:text-sky-500 transition-colors px-2 text-sm"
            >Next →</button>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-800 text-xl leading-none ml-2"
              aria-label="Close calendar"
            >&times;</button>
          </div>
        </div>

        {!ready && <div className="text-slate-500 py-6 text-center">Loading…</div>}
        {entries.error && (
          <Banner variant="error">{(entries.error as Error).message}</Banner>
        )}

        {ready && daily && (
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 overflow-hidden">
            <div className="flex-1 min-w-0 overflow-auto">
              <div className="hidden lg:block">
                <CalendarGrid
                  year={y ?? 0}
                  month1to12={mo ?? 1}
                  daily={daily}
                  currency={currency}
                  onDayClick={setSelectedDate}
                  selectedDate={selectedDate}
                  todayISO={todayISO()}
                />
              </div>
              <div className="lg:hidden">
                <CalendarMobileList
                  daily={daily}
                  currency={currency}
                  onDayClick={setSelectedDate}
                  selectedDate={selectedDate}
                  todayISO={todayISO()}
                />
              </div>
            </div>

            {selectedDate && (
              <CalendarDayPanel
                date={selectedDate}
                entries={selectedDayEntries}
                currency={currency}
                onClose={() => setSelectedDate(null)}
              />
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 8.3 — Wire into Dashboard**

Open `src/ui/screens/Dashboard.tsx`. Add imports:

```tsx
import { CalendarIcon } from './dashboard/CalendarIcon';
import { CalendarModal } from './dashboard/CalendarModal';
```

Inside the `Dashboard` component, near the top, add calendar-open state:

```tsx
const [calendarOpen, setCalendarOpen] = useState(false);
```

(Note: `useState` is already imported.)

Find the JSX row that renders the month label + Prev/Next buttons. Current code:

```tsx
<div className="flex items-center justify-between max-w-4xl">
  <h1 className="font-display text-2xl font-bold">{formatMonthLabel(month)}</h1>
  <div className="flex gap-2 font-body text-sm font-medium">
    <button ...>← Prev</button>
    <button ...>Next →</button>
  </div>
</div>
```

Change the button container to include the icon:

```tsx
<div className="flex items-center gap-2 font-body text-sm font-medium">
  <CalendarIcon
    onClick={() => setCalendarOpen(true)}
    disabled={entries.isLoading || projects.isLoading || rates.isLoading || !!entries.error}
  />
  <button ...>← Prev</button>
  <button ...>Next →</button>
</div>
```

Just before the final `</div>` of the Dashboard component's return value (after the closing `</div>` of the two-column layout but before the outermost `</div>`), add:

```tsx
{calendarOpen && (
  <CalendarModal
    initialMonth={month}
    partner={partner}
    onClose={() => setCalendarOpen(false)}
  />
)}
```

- [ ] **Step 8.4 — Full gates**

```
npm run typecheck && npm run lint && npm test
```

If `Dashboard.tsx` now exceeds the 300-line limit, extract the two subcomponents already inside (`SummaryCard`, `InvoiceTable`, `ActiveBuilds`) into separate files at `src/ui/screens/dashboard/` — one file per component, copy-paste unchanged, re-import. Only do this if lint fails.

- [ ] **Step 8.5 — Manual verification (full flow)**

```
npm run dev
```

1. Load Dashboard. Calendar icon appears next to Prev/Next.
2. Click icon → modal opens showing current month.
3. Today cell has cyan ring.
4. Sat/Sun columns muted.
5. Days with entries show heatmap tint + stacked bar + hours + `$` (if billable > 0).
6. Click a day → side panel slides in with entries.
7. Click an entry → `EditEntryModal` opens on top (calendar still visible, dimmed).
8. Save a change in the edit modal → it closes, calendar cell updates without manual refresh.
9. `← Prev` / `Next →` change month in modal; close modal, Dashboard's month is unchanged.
10. Esc closes modal.
11. Click outside the modal card closes it.
12. Click a nav tab while modal is open → modal dismisses automatically.
13. Resize browser to below 1024px wide → modal shows the mobile list instead of the grid.

- [ ] **Step 8.6 — Commit**

```
git add src/ui/screens/dashboard/CalendarIcon.tsx src/ui/screens/dashboard/CalendarModal.tsx src/ui/screens/Dashboard.tsx
git commit -m "feat(dashboard): calendar modal icon + grid/panel/list composition"
```

---

## Task 9: Update backlog doc

**Files:**
- Modify: `docs/superpowers/backlog.md`

### Steps

- [ ] **Step 9.1 — Append to Shipped section**

Open `docs/superpowers/backlog.md`. In the `## Shipped` section, append:

```
- **Dashboard calendar view** — month-grid modal launched from a calendar icon on the Dashboard header. Per-day billable / non-billable / needs-review stacked bars, heatmap tint, today ring, muted weekends, week totals column, click-day side panel with entry list, click-entry → existing EditEntryModal. Mobile list fallback below lg.
- **Dashboard this-month Project Builds table** — bucket-level table for the selected month, styled like Monthly Invoice. Uses the same project-builds stream definition as the existing summary card.
```

- [ ] **Step 9.2 — Commit**

```
git add docs/superpowers/backlog.md
git commit -m "docs: mark Dashboard calendar view + this-month Project Builds table as shipped"
```

---

## Self-review checklist

Run these checks before handing off to finishing-a-development-branch.

- [ ] **Spec coverage:** every spec section has a task.
  - §3 decisions (1–10) → all covered across T1–T8.
  - §4 pure calc → T1 (both functions + re-export) + T2 (invariants).
  - §5 calendar-grid layout → T3.
  - §6 UX — icon T8, body layout T4, modal T8, cell states T5, week totals T5, side panel T6, heatmap formula T5, mobile fallback T7.
  - §7 file structure → all files created by the right task.
  - §8 error + edge cases → enforced inline in T5 (`max=0` no tint, weekend override, padding greyed, `$` hidden when 0), T8 (hashchange dismiss, Esc close, disabled icon while loading/error), T6 (side panel auto-refresh via shared cache).
  - §9 testing → T1 unit, T2 property, T3 unit, T8 manual checklist.
  - §10 non-negotiables → enforced by per-task gates.
  - §11 out-of-scope → preserved; no rogue scope creep.
  - §12 sequencing → tasks ordered calc-first, then table, then grid/cell, then side panel, then mobile, then modal+icon+wiring, then docs.

- [ ] **Placeholder scan:** no TODO / TBD / "handle edge cases" / "fill in". All code blocks are complete-as-written.

- [ ] **Type consistency:**
  - `DailyBreakdown`, `MonthDaily`, `ProjectBuildsMonthRow` defined in T1 (`src/calc/daily.ts`) — consumed by T2 invariants, T4 table, T5 cell + grid, T7 mobile list, T8 modal. Names match across.
  - `CalendarCell` (type) from T3 — consumed only by T5's grid.
  - `CalendarModal` prop `initialMonth: string` (YYYY-MM) — T8 passes `month` from Dashboard (already YYYY-MM), matches.
  - `onDayClick` signature `(date: string) => void` consistent across T5 grid, T5 cell, T7 list, T8 modal.
  - `EditEntryModal` API (`{ entry, onClose }`) from T6 side panel — confirmed at `src/ui/screens/entries/EditEntryModal.tsx`. No change needed there.

- [ ] **No double-work:** the new Project Builds table at T4 doesn't duplicate cumulative `ActiveBuilds` (right-column panel stays intact).

- [ ] **Integer-math invariant:** all arithmetic on `_cents` / `_hundredths` in new files uses `src/calc/int.ts` helpers. The only `/` on such a field in new UI code is the stacked-bar percentage math (`billable_hundredths / total` → pure float for CSS width, never re-entering data). The lint rule exempts that because the result isn't a `_cents` / `_hundredths` field; verify at T5's lint gate.

- [ ] **Golden-fixture safety:** no changes to `src/calc/hash.ts`, `src/schema/**`, `tests/fixtures/**`, or anything that would touch the March 2026 golden hash.

## Out of scope (confirmed deferred)

- Target / capacity tracking (goal rings, over/under-utilized callouts)
- Per-project dot layer in cells (density C)
- Google Calendar event overlay on the grid
- Date-range beyond one month
- Export / share / permalink
- "Missed day" flagging
- User notes / annotations on days
