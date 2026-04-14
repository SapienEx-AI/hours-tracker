# Dashboard calendar view + this-month Project Builds table — design

Two Dashboard enhancements that ship together because they answer related questions ("what did I work on each day this month?" and "what bucketed work did I bill for this month?"). Both read from existing data — no schema change, no new npm deps, no new data-repo files.

## 1. Purpose

- **Calendar-view modal** — launched via an icon in the Dashboard header. A month grid with per-day breakdowns of billable / non-billable / needs-review hours, daily billable $ totals, and a subtle heatmap background. Clicking a day reveals the entry list in a side panel; clicking an entry opens the existing `EditEntryModal` on top.
- **This-month Project Builds table** — a new table on the Dashboard, styled identically to the existing Monthly Invoice table, showing this month's billable hours + $ per bucket. The existing cumulative Project Builds progress bars stay (they answer a different question — "how close to each bucket's budget are we overall").

## 2. Non-goals

- No permalink/bookmarking of the calendar view. It's a modal, not a route.
- No auto-detection of "missed days" (weekdays with zero logged hours). We have Google Calendar data now that could power that cleanly, but it's a follow-up.
- No target / capacity tracking in the calendar. No goal rings, no over/under-utilized callouts. Raw data only.
- No per-project dot layer in cells. YAGNI until density B proves insufficient.
- No mobile grid. Below `lg` (1024px) the modal falls back to a vertical day list.
- No writing. Everything in this spec is read-only over existing data.

## 3. Architecture decisions (locked from brainstorming)

| # | Decision | Rationale |
|---|---|---|
| 1 | General-purpose calendar (user scans themselves), not an opinionated "audit / billing review / capacity" view | The calendar is a dense visualization; users spot what's relevant to them rather than follow a prescribed callout. |
| 2 | Cell density B: total hours + stacked bar (billable / non-billable / review) + `$` when billable > 0 | Enough signal to spot anomalies. (C) per-project dots get messy at 7+ projects; YAGNI. |
| 3 | Smart layer B: today ring + muted weekends + heatmap background + trailing week-totals column | "At-a-glance" feel without prescriptive icons. |
| 4 | Calendar view lives in a modal, not a route or inline swap | Complementary to the Dashboard, not a replacement. Quick pop-in/out. |
| 5 | Click a day → side panel (inside the same modal) with the day's entries; click an entry → opens `EditEntryModal` on top (z-50 over calendar z-40) | Preserves grid context; keeps existing edit flow. |
| 6 | Add the this-month Project Builds table **alongside** the cumulative panel, not replacing it | Both views are useful: cumulative for budget pressure, this-month for "what am I billing for right now". |
| 7 | Mon-first week convention | Consultants think in work weeks. Sat/Sun grouped on the right. |
| 8 | Padding cells from adjacent months are shown greyed and non-interactive | Spatial consistency, no accidental cross-month drill-in. |
| 9 | Modal opens with Dashboard's currently-selected month, then has its own `← →` nav; closing doesn't write back | Calendar is a scratchpad on top of the Dashboard's state. |
| 10 | Modal icon disabled while Dashboard queries are loading/errored | Prevent opening into a broken state. |

## 4. Pure calc additions

All new code lives in `src/calc/daily.ts`. Nothing in existing `src/calc/` is modified. Both functions are pure, integer-math-only (via `src/calc/int.ts` helpers), and `CalcInput`-shaped to match sibling functions.

### 4.1 `computeMonthDaily`

```ts
export type DailyBreakdown = {
  date: string;                    // YYYY-MM-DD
  total_hundredths: number;
  billable_hundredths: number;
  non_billable_hundredths: number;
  needs_review_hundredths: number;
  billable_amount_cents: number;
  entry_count: number;
};

export type MonthDaily = {
  month: string;
  days: DailyBreakdown[];          // only days with ≥1 entry; UI fills empty cells
  max_hours_hundredths: number;    // for heatmap normalization
};

export function computeMonthDaily(input: CalcInput, month: string): MonthDaily;
```

Behavior:

- Filters `input.entries` to those where `entry.date.startsWith(`${month}-`)`.
- Groups by `entry.date` (exact string match; same-timezone guaranteed by storage format).
- For each date:
  - `total_hundredths` = `sumHundredths` of all entries' `hours_hundredths` that day.
  - `billable_hundredths` = sum where `billable_status === 'billable'`.
  - `non_billable_hundredths` = sum where `billable_status === 'non_billable'`.
  - `needs_review_hundredths` = sum where `billable_status === 'needs_review'`.
  - `billable_amount_cents` = `sumCents` of `mulCentsByHundredths(entry.rate_cents, entry.hours_hundredths)` for billable-only entries.
  - `entry_count` = count of entries on that date.
- `days[]` sorted ascending by `date` (lexical sort on YYYY-MM-DD).
- `max_hours_hundredths` = max `day.total_hundredths` over `days`, or `0` if empty.

### 4.2 `computeProjectBuildsForMonth`

```ts
export type ProjectBuildsMonthRow = {
  project_id: string;
  bucket_id: string;
  hours_hundredths: number;
  amount_cents: number;
};

export function computeProjectBuildsForMonth(
  input: CalcInput,
  month: string,
): ProjectBuildsMonthRow[];
```

Behavior:

- Filters `input.entries` to where `entry.date.startsWith(`${month}-`) && entry.bucket_id !== null && entry.billable_status === 'billable'`.
- Groups by `bucket_id`. For each group:
  - Look up the `project_id` that owns the bucket via `input.projects`.
  - `hours_hundredths` = `sumHundredths` of group.
  - `amount_cents` = `sumCents` of `mulCentsByHundredths(entry.rate_cents, entry.hours_hundredths)` across the group.
- Returned rows sorted by `project_id` asc, then `bucket_id` asc.

### 4.3 Re-exports

`src/calc/index.ts` gains:

```ts
export {
  computeMonthDaily,
  computeProjectBuildsForMonth,
  type DailyBreakdown,
  type MonthDaily,
  type ProjectBuildsMonthRow,
} from './daily';
```

### 4.4 Invariants (property-tested)

1. Per-day conservation: `billable + non_billable + needs_review === total` on every `DailyBreakdown`.
2. Monthly total agreement: `sum(days[].total_hundredths) === computeMonthTotals(...).total_hours_hundredths` for the same inputs.
3. Monthly billable $ agreement: `sum(days[].billable_amount_cents) === computeMonthTotals(...).billable_amount_cents`.
4. Project-builds hours agreement: `sum(rows[].hours_hundredths) === splitBillingStreams(...).project_builds.hours_hundredths`.
5. Project-builds $ agreement: `sum(rows[].amount_cents) === splitBillingStreams(...).project_builds.amount_cents`.
6. Sort determinism: same input → same-ordered `days[]` and `rows[]`.

## 5. Calendar-grid layout helper

`src/ui/screens/dashboard/calendar-grid-layout.ts` — pure, tested.

```ts
export type CalendarCell = {
  date: string;       // YYYY-MM-DD
  inMonth: boolean;
};

export function computeCalendarLayout(year: number, month1to12: number): CalendarCell[];
```

Returns exactly 42 cells (6 weeks × 7 days) in Mon-first order, starting from the Monday on or before the 1st of the target month. Padding cells from previous/next month have `inMonth: false`.

Tested with April 2026 (Wed start, 30 days), February 2026 (Sun start, 28 days), March 2026 (Sun start, 31 days).

## 6. UX

### 6.1 Dashboard header (icon placement)

```
┌──────────────────────────────────────────────────────────┐
│ April 2026            [📅]   [← Prev]   [Next →]          │
└──────────────────────────────────────────────────────────┘
```

- Inline SVG calendar icon (no new dep), sized `w-5 h-5`, same muted-to-hover treatment as the Prev/Next buttons.
- Disabled while `useMonthEntries` / `useProjects` are loading or errored.
- Click → opens the calendar modal.

### 6.2 Dashboard body

```
Left column (max-w-4xl):
  ┌──────────────────────────────────┐
  │  Monthly Invoice · April 2026    │
  │  (existing InvoiceTable)         │
  ├──────────────────────────────────┤
  │  Project Builds · April 2026     │
  │  Per-bucket, this month only.    │
  │  (new MonthProjectBuildsTable)   │
  ├──────────────────────────────────┤
  │  Needs review banner (if any)    │
  └──────────────────────────────────┘

Right column (w-[520px]):
  ┌──────────────────────────────────┐
  │  Project Builds                  │
  │  Per-project, spans months.      │
  │  (existing ActiveBuilds)         │
  └──────────────────────────────────┘
```

**MonthProjectBuildsTable** columns:

| Bucket | Project | Hours | Amount |
|---|---|---|---|
| skyvia-dev | Sprosty | 7.50h | $937.50 |
| onboarding | Sterling | 2.00h | $250.00 |
| — totals — | | 9.50h | $1,187.50 |

- Bucket name bold, project name muted underneath (same two-line pattern we'll use in the cell).
- Empty state: "No project-build hours this month."
- Footer row: sum of hours + sum of amount, same styling as `InvoiceTable`.

### 6.3 Calendar modal layout

- Max width `1050px`, max height `90vh`, centered, `z-40`.
- Header: `Calendar · April 2026` + `← →` month nav + close `×`.
- Grid: 8 columns × 6 rows. Columns 1–7 are weekdays Mon–Sun. Column 8 is week totals. Rows are weeks.
- Cell: `~110px × ~100px`.
- Side panel: hidden by default. When a day is clicked, slides in to the right of the grid (~320px wide). Stays in place until the day is clicked again or another day is selected or month changes.

Backdrop: `bg-black/30 backdrop-blur-sm`, click-outside to close.

### 6.4 Calendar cell states

- **In-month, has entries:** day number top-left, hours (e.g. `7.50h`) prominent, stacked bar under hours (billable green / non-billable slate / needs-review amber, widths proportional), `$` line below bar if `billable_amount_cents > 0`. Background tinted with cyan proportional to `total_hundredths / max_hours_hundredths`.
- **In-month, no entries:** day number only, white background. Hover: subtle ring.
- **Today:** cyan ring border (`ring-2 ring-partner-cyan`).
- **Weekend (Sat/Sun):** muted background (`bg-slate-50/50`). Overrides heatmap tint.
- **Padding (not in month):** day number only, greyed, not interactive.

### 6.5 Week totals column (8th column)

Per row, small pill:

```
  15.0h
  $1,250
```

Totals are derived client-side from `days[]` — sum `total_hundredths` and `billable_amount_cents` across the in-month cells in that row. Padding-month days (from the previous or next month) do NOT contribute. Rationale: the calendar modal is scoped to "April 2026" — the user expects totals to reflect April's work only. A week row spanning Mar 30 – Apr 5 shows totals from Apr 1–5 only. Natural week totals crossing months are out of scope (see §11).

### 6.6 Day side panel

Opens when an in-month cell is clicked.

- Header: `N entries on Mon, Apr 14`
- Close `×`
- Entry list: each entry is a tile with project name, hours, rate, description, bucket badge (if any), status badge.
- Click an entry → spawns `EditEntryModal` at `z-50` (above calendar's `z-40`).
- When `EditEntryModal` saves/closes, side panel re-renders automatically via shared react-query cache (`qk.monthEntries` invalidation already happens in the existing edit flow).

### 6.7 Heatmap intensity

```ts
const intensity = max_hours_hundredths === 0 ? 0 : total_hundredths / max_hours_hundredths;
const bg = `rgba(107, 207, 238, ${intensity * 0.22})`; // partner-cyan at up-to-22% opacity
```

Subtle on purpose — cells should still be readable with the bar + numbers on top.

### 6.8 Mobile fallback (`< lg`, <1024px)

Modal shows a vertical list instead of the grid:

```
Fri, Apr 3     7.50h   $938   [▓▓▓░░░░]
Sat, Apr 4     0.00h
Mon, Apr 7     6.00h   $750   [▓▓▓▓░░]
...
```

One row per in-month day. Click expands to show entries below (accordion) or opens a bottom sheet. No week totals column, no grid. Icon still visible on narrow Dashboard.

## 7. File structure

**New files:**

- `src/calc/daily.ts` — pure `computeMonthDaily` + `computeProjectBuildsForMonth`.
- `src/ui/screens/dashboard/calendar-grid-layout.ts` — pure `computeCalendarLayout`.
- `src/ui/screens/dashboard/CalendarModal.tsx` — portal + backdrop + month nav + close + grid+panel composition.
- `src/ui/screens/dashboard/CalendarGrid.tsx` — the 6×8 grid (7 days + week totals).
- `src/ui/screens/dashboard/CalendarCell.tsx` — one cell, covers all states (in-month, padding, today, weekend).
- `src/ui/screens/dashboard/CalendarDayPanel.tsx` — day side panel, entry list, wires to `EditEntryModal`.
- `src/ui/screens/dashboard/MonthProjectBuildsTable.tsx` — the new this-month table.
- `src/ui/screens/dashboard/CalendarIcon.tsx` — the inline SVG icon button for the Dashboard header.
- `src/ui/screens/dashboard/calendar-mobile-fallback.tsx` — the list-view fallback for `< lg`.
- `tests/calc/daily.test.ts`
- `tests/ui/dashboard/calendar-grid-layout.test.ts`

**Modified files:**

- `src/calc/index.ts` — re-export new types + functions.
- `src/ui/screens/Dashboard.tsx` — add icon button in header, mount `CalendarModal` (open/close state), insert `MonthProjectBuildsTable` below the Monthly Invoice section on the left column.
- `tests/calc/property.test.ts` — add invariants from §4.4.
- `docs/superpowers/backlog.md` — mark as shipped under the Shipped section on completion.

## 8. Error + edge cases (summary — details in §5 of brainstorming)

| Scenario | Visible behavior |
|---|---|
| Month with zero entries | Empty cells, `max=0` → no tint, week totals all `0.0h`, new table shows empty state. |
| Partial month (today mid-month) | Future in-month cells render as empty (no special "future" styling). |
| Only needs-review on a day | Full amber bar, hours shown, no `$` line. |
| `bucket_id` set with `billable_status !== 'billable'` | Excluded from new Project Builds table; still visible in cell bar. |
| Mobile viewport | List fallback per §6.8. |
| EditEntryModal save from inside side panel | Shared react-query cache invalidation refreshes cells + side panel automatically. |
| User navigates tabs while modal open | Modal dismisses (hashchange listener). |
| Side panel open → month change | Selected-day state clears; panel closes. |

## 9. Testing expectations

### 9.1 Unit tests (hand-crafted inputs)

`tests/calc/daily.test.ts` covers:

- `computeMonthDaily`: zero entries, single entry, multiple entries same day, multiple days, mixed billable / non-billable / needs-review on same day, entries outside month excluded, `max_hours_hundredths` correct across varied days.
- `computeProjectBuildsForMonth`: zero entries, unbucketed entries excluded, non-billable bucketed excluded, needs-review bucketed excluded, same bucket summed, multiple buckets distinct rows, sort order (project_id asc then bucket_id asc).

`tests/ui/dashboard/calendar-grid-layout.test.ts` covers `computeCalendarLayout` for April 2026 (Wed start, 30 days), February 2026 (Sun start, 28 days), March 2026 (Sun start, 31 days). Verifies exact 42-cell count, Mon-first ordering, and `inMonth` flag correctness on leading and trailing padding cells.

### 9.2 Property tests (`tests/calc/property.test.ts`)

Five invariants from §4.4, using the existing `entryArb` generator.

### 9.3 Manual verification

Run `npm run dev` against a data repo with a representative spread of entries for the current month.

1. Dashboard loads. Calendar icon appears next to month nav. Disabled during initial queries, enabled once data is ready.
2. Click icon → modal opens with current month.
3. Today cell shows cyan ring border.
4. Saturday + Sunday columns visibly muted.
5. Cells with entries show heatmap tint proportional to hours; the highest-hour day of the month has the strongest tint.
6. A day with only non-billable entries shows a full slate bar and no `$` line.
7. A day with only needs-review entries shows a full amber bar and no `$` line.
8. Week totals column (rightmost) matches an eyeball-sum of in-month cells in each row.
9. Modal `← →` arrows move between months; after closing, Dashboard's selected month is unchanged.
10. Click a day with entries → side panel slides in, header shows `N entries on [date]`, entries listed with project / hours / rate / description / bucket / status.
11. Click an entry in the panel → `EditEntryModal` opens above the calendar.
12. Save in `EditEntryModal` → modal closes, the underlying calendar cell + side panel reflect the change without a manual refresh.
13. Navigate to another nav tab while the calendar modal is open → modal dismisses automatically.
14. Close via `×`, Esc, or click-outside all work.
15. Resize viewport below 1024px → modal shows the vertical list fallback (§6.8); icon still visible on Dashboard.
16. Dashboard left column now contains both tables (Monthly Invoice, then Project Builds this month). Right column cumulative bars unchanged.
17. New table empty state: "No project-build hours this month." renders when no billable bucketed entries exist for the month.
18. Log a billable entry against a bucketed project for this month → new table gains a row with correct hours + `$`.

### 9.4 Not testing

- No E2E browser automation — manual checklist is sufficient.
- No visual regression snapshots.
- No performance benchmarks.

## 10. Non-negotiables (restated from CLAUDE.md)

- Integer math only on `_cents` / `_hundredths`. Calc helpers from `src/calc/int.ts` exclusively. New code follows the rule; `no-float-money` ESLint rule stays on.
- No schema change. No new data-repo files.
- No partner-branding edits.
- `npm run typecheck && npm run lint && npm test` must pass on every task's final commit.
- March 2026 golden fixture stays passing unchanged (this spec doesn't touch entries, hash, or snapshots — safe by construction, but still: `npm run test:golden` is the gate).

## 11. Out of scope (deferred)

- Dashboard-wide date range (beyond "this month").
- Weekly / quarterly / annual views.
- Calendar-event source overlay (showing Google Calendar events alongside logged entries). Feasible given Phase C data, but a follow-up.
- "Missed day" / "under target" badges. Requires target concept.
- Per-project dot layer in cells (cell density C).
- Export calendar as CSV / PDF / ICS.
- Annotations by the user (notes on a day).

## 12. Sequencing

One combined implementation plan. Inside the plan, tasks ordered:

1. Pure calc (`computeMonthDaily`, `computeProjectBuildsForMonth`) + tests. Unblocks UI work.
2. Pure calendar-grid layout helper + tests.
3. `MonthProjectBuildsTable` component + Dashboard integration (simpler surface, adds to Dashboard first).
4. `CalendarCell` + `CalendarGrid` + `CalendarDayPanel` subcomponents.
5. `CalendarModal` composition + `CalendarIcon` in Dashboard header.
6. Mobile fallback list view.
7. Property test additions.
8. Backlog doc.

Each task leaves the repo green — no partial half-wires.
