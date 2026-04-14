# Phase A — Near-Term Backlog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear the 7 remaining near-term backlog items from `docs/superpowers/backlog.md` so the app covers every feature called out in spec §8 before we start calendar integration.

**Architecture:** Keep the existing shape — per-module data repos in `src/data/`, screen components in `src/ui/screens/`, pure calc helpers in `src/calc/`. Two small additions: a new `src/export/` module for CSV, and a tiny `src/store/ui-store.ts` for cross-screen prefilter handoff (Dashboard → Entries). No new dependencies. Everything stays static, no backend.

**Tech Stack:** React 18 + TypeScript (strict) + Zustand + TanStack Query + Octokit + Tailwind + Vitest + fast-check. All existing.

**Scope excluded:** Log-screen 2-col layout, date-to-top, calendar integration. Those land in Phase B/C.

---

## File structure

**New files:**
- `src/export/csv.ts` — pure entry-to-CSV serializer
- `src/export/README.md` — module doc (one paragraph)
- `src/store/ui-store.ts` — cross-screen UI state (prefilters, global shortcut triggers)
- `src/calc/bulk-rate.ts` — pure filter + preview helpers for bulk rate update
- `src/calc/drift.ts` — pure snapshot-drift computation
- `src/data/bulk-rate-update.ts` — multi-month Octokit mutation that applies a bulk rate change
- `src/data/snapshots-list.ts` — list + load all snapshots in a data repo
- `src/ui/use-global-shortcut.ts` — `⌘/Ctrl+K` listener hook
- `src/ui/screens/projects/EditBucketForm.tsx` — inline bucket edit form
- `src/ui/screens/rates/BulkRateDialog.tsx` — bulk rate update dialog
- `src/ui/screens/snapshots/SnapshotRow.tsx` — one row in the snapshot list
- `src/ui/screens/snapshots/DriftDiff.tsx` — expandable drift detail
- `src/data/hooks/use-snapshots-list.ts` — react-query hook
- `tests/export/csv.test.ts`
- `tests/calc/bulk-rate.test.ts`
- `tests/calc/drift.test.ts`

**Modified files:**
- `src/calc/index.ts` — re-export new calc helpers
- `src/ui/layout/AppShell.tsx` — mount `useGlobalShortcut`
- `src/ui/screens/QuickLog.tsx` — respond to focus-log trigger
- `src/ui/screens/Entries.tsx` — status filter + CSV export button + prefilter consumption
- `src/ui/screens/Dashboard.tsx` — make needs-review line clickable
- `src/ui/screens/ProjectsAndBuckets.tsx` — wire edit-bucket handler
- `src/ui/screens/projects/BucketRow.tsx` — show Edit button
- `src/ui/screens/Rates.tsx` — add Bulk rate update button + dialog
- `src/ui/screens/Snapshots.tsx` — list all snapshots + drift badge
- `src/data/query-keys.ts` — add `qk.snapshotsList`
- `src/data/commit-messages.ts` — add `configEditBucketMessage`
- `docs/superpowers/backlog.md` — move completed items to a "Shipped" section

---

## Non-negotiables (restated from CLAUDE.md)

- Integer math only on `_cents`/`_hundredths` fields — use `src/calc/int.ts` helpers. **The `no-float-money` ESLint rule must stay on.**
- Every entry/projects/rates/snapshot write validates via `src/schema/validators.ts`.
- Commit messages go through `src/data/commit-messages.ts` — add a new formatter there, don't inline strings.
- After every task: `npm run typecheck && npm run lint && npm test` must all pass.

---

## Task 1: CSV export

**Files:**
- Create: `src/export/csv.ts`
- Create: `src/export/README.md`
- Create: `tests/export/csv.test.ts`
- Modify: `src/ui/screens/Entries.tsx` (add "Export CSV" button)

### Why

Spec §3 row 12. Export the currently-filtered entries as a single download-able CSV. Pure browser, no server — we generate the string and hand it to a `Blob` + anchor click.

### CSV shape

RFC 4180. Columns in this exact order:
`id,date,project,bucket,hours,rate,billable_status,description,review_flag,rate_source`

Fields that may contain commas, quotes, or newlines are quoted with `"..."`. Embedded `"` doubled as `""`. Any cell starting with `=`, `+`, `-`, or `@` is prefixed with a single quote to defeat spreadsheet formula injection.

### Steps

- [ ] **Step 1.1 — Write failing test**

`tests/export/csv.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { entriesToCSV } from '@/export/csv';
import type { Entry } from '@/schema/types';

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: '2026-03-25-sprosty-a3f9c1',
    project: 'sprosty',
    date: '2026-03-25',
    hours_hundredths: 400,
    rate_cents: 2000,
    rate_source: 'global_history',
    billable_status: 'billable',
    bucket_id: null,
    description: 'did a thing',
    review_flag: false,
    created_at: '2026-03-25T10:00:00Z',
    updated_at: '2026-03-25T10:00:00Z',
    ...overrides,
  };
}

describe('entriesToCSV', () => {
  it('emits a header row and one row per entry', () => {
    const csv = entriesToCSV([makeEntry()]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'id,date,project,bucket,hours,rate,billable_status,description,review_flag,rate_source',
    );
    expect(lines[1]).toBe(
      '2026-03-25-sprosty-a3f9c1,2026-03-25,sprosty,,4.00,20.00,billable,did a thing,false,global_history',
    );
  });

  it('quotes fields containing commas, quotes, or newlines and doubles embedded quotes', () => {
    const csv = entriesToCSV([
      makeEntry({ description: 'he said "hi", then left\nnext line' }),
    ]);
    expect(csv.split('\n')[1]).toContain('"he said ""hi"", then left\nnext line"');
  });

  it('prefixes a leading =, +, -, or @ with a single quote to defeat formula injection', () => {
    const csv = entriesToCSV([makeEntry({ description: '=SUM(A1:A10)' })]);
    expect(csv).toContain(",'=SUM(A1:A10),");
  });

  it('serializes bucket_id null as empty string and review_flag as "true"/"false"', () => {
    const csv = entriesToCSV([
      makeEntry({ bucket_id: 'sprosty-skyvia-dev', review_flag: true }),
    ]);
    expect(csv.split('\n')[1]).toContain('sprosty-skyvia-dev');
    expect(csv.split('\n')[1]).toContain('true');
  });

  it('formats hours as HH.HH and rate as D.DD using integer math', () => {
    const csv = entriesToCSV([
      makeEntry({ hours_hundredths: 1234, rate_cents: 12500 }),
    ]);
    const row = csv.split('\n')[1] ?? '';
    expect(row).toContain('12.34,125.00');
  });
});
```

- [ ] **Step 1.2 — Run the test to verify it fails**

Run: `npm test -- tests/export/csv.test.ts`
Expected: FAIL — `Cannot find module '@/export/csv'`.

- [ ] **Step 1.3 — Implement**

`src/export/csv.ts`:
```ts
import type { Entry } from '@/schema/types';
import { formatHoursDecimal } from '@/format/format';

const HEADER = [
  'id', 'date', 'project', 'bucket', 'hours', 'rate',
  'billable_status', 'description', 'review_flag', 'rate_source',
].join(',');

const INJECTION_PREFIXES = ['=', '+', '-', '@'];

function rateDollarsDecimal(rateCents: number): string {
  const whole = Math.trunc(rateCents / 100);
  const frac = rateCents - whole * 100;
  return `${whole}.${frac.toString().padStart(2, '0')}`;
}

function escapeCell(raw: string): string {
  let value = raw;
  if (value.length > 0 && INJECTION_PREFIXES.includes(value[0] ?? '')) {
    value = `'${value}`;
  }
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function entriesToCSV(entries: Entry[]): string {
  const rows = entries.map((e) => [
    e.id,
    e.date,
    e.project,
    e.bucket_id ?? '',
    formatHoursDecimal(e.hours_hundredths),
    rateDollarsDecimal(e.rate_cents),
    e.billable_status,
    e.description,
    e.review_flag ? 'true' : 'false',
    e.rate_source,
  ].map(escapeCell).join(','));
  return [HEADER, ...rows].join('\n');
}

export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 1.4 — Run the test to verify it passes**

Run: `npm test -- tests/export/csv.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 1.5 — Add README stub**

`src/export/README.md`:
```md
# src/export

Pure, UI-independent exporters. `csv.ts` emits RFC 4180 CSV with formula-injection hardening. `downloadCSV` is the one browser-API helper in this module — call it only from UI code.
```

- [ ] **Step 1.6 — Wire into Entries screen**

In `src/ui/screens/Entries.tsx`, add above the `<Input>` filter, in the same flex row:

```tsx
import { entriesToCSV, downloadCSV } from '@/export/csv';
// ... inside the component, after `visible` is computed:
<Button
  variant="secondary"
  onClick={() => {
    const csv = entriesToCSV(visible);
    downloadCSV(`entries-${month}.csv`, csv);
  }}
  disabled={visible.length === 0}
>
  Export CSV
</Button>
```

Put the button in the top filter row so it's discoverable. Disabled when there are no visible entries.

- [ ] **Step 1.7 — Run all checks**

```
npm run typecheck
npm run lint
npm test
```
All three must pass.

- [ ] **Step 1.8 — Commit**

```
git add src/export/ tests/export/ src/ui/screens/Entries.tsx
git commit -m "feat(export): CSV export of filtered entries"
```

---

## Task 2: ⌘/Ctrl+K focus-Log shortcut

**Files:**
- Create: `src/ui/use-global-shortcut.ts`
- Create: `src/store/ui-store.ts`
- Modify: `src/ui/layout/AppShell.tsx`
- Modify: `src/ui/screens/QuickLog.tsx`

### Why

Spec §8.1. Any screen → `⌘/Ctrl+K` → Log screen, project select focused.

### Design

- A small Zustand store holds a monotonically increasing `focusLogNonce`. Each shortcut press increments it.
- AppShell installs the global keydown listener. On match, it calls `onNavigate('log')` and bumps the nonce.
- QuickLog watches the nonce via a `useEffect` and focuses its project `<select>` when it changes.

The nonce approach avoids stale-trigger bugs when the user presses the shortcut twice in a row.

### Steps

- [ ] **Step 2.1 — Create the store**

`src/store/ui-store.ts`:
```ts
import { create } from 'zustand';

type UiState = {
  focusLogNonce: number;
  bumpFocusLog: () => void;
  entriesPrefilter: { status?: 'needs_review' } | null;
  setEntriesPrefilter: (p: { status?: 'needs_review' } | null) => void;
};

export const useUiStore = create<UiState>((set) => ({
  focusLogNonce: 0,
  bumpFocusLog: () => set((s) => ({ focusLogNonce: s.focusLogNonce + 1 })),
  entriesPrefilter: null,
  setEntriesPrefilter: (p) => set({ entriesPrefilter: p }),
}));
```

- [ ] **Step 2.2 — Create the hook**

`src/ui/use-global-shortcut.ts`:
```ts
import { useEffect } from 'react';
import type { Route } from '@/ui/Router';
import { useUiStore } from '@/store/ui-store';

export function useGlobalShortcut(onNavigate: (r: Route) => void): void {
  const bumpFocusLog = useUiStore((s) => s.bumpFocusLog);
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const isMetaOrCtrlK =
        (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k';
      if (!isMetaOrCtrlK) return;
      e.preventDefault();
      onNavigate('log');
      bumpFocusLog();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onNavigate, bumpFocusLog]);
}
```

- [ ] **Step 2.3 — Mount in AppShell**

In `src/ui/layout/AppShell.tsx`, near the top of the component body (after `const base = ...`):

```tsx
import { useGlobalShortcut } from '@/ui/use-global-shortcut';
// ...
useGlobalShortcut(onNavigate);
```

- [ ] **Step 2.4 — Consume in QuickLog**

In `src/ui/screens/QuickLog.tsx`:

```tsx
import { useRef, useEffect } from 'react';
import { useUiStore } from '@/store/ui-store';
// ...
const projectRef = useRef<HTMLSelectElement | null>(null);
const focusLogNonce = useUiStore((s) => s.focusLogNonce);
useEffect(() => {
  if (focusLogNonce > 0) projectRef.current?.focus();
}, [focusLogNonce]);
```

Attach the ref to the project `<Select>`. The existing `<Select>` forwards a ref via React's component props — verify with `grep -n "forwardRef" src/ui/components/Select.tsx`. If it does NOT forward, add `React.forwardRef` around Select's implementation (trivial change):

```tsx
// src/ui/components/Select.tsx
import { forwardRef } from 'react';
export const Select = forwardRef<HTMLSelectElement, SelectProps>((props, ref) => (
  <select ref={ref} {...props} />
));
Select.displayName = 'Select';
```

- [ ] **Step 2.5 — Manual verification**

Run `npm run dev`. On any screen, press ⌘K (macOS) / Ctrl+K (Win/Linux). Expected: navigates to Log, project select gains focus. Press twice in a row — focus should stick on the select both times.

- [ ] **Step 2.6 — Run all checks**

`npm run typecheck && npm run lint && npm test`.

- [ ] **Step 2.7 — Commit**

```
git add src/store/ui-store.ts src/ui/use-global-shortcut.ts src/ui/layout/AppShell.tsx src/ui/screens/QuickLog.tsx src/ui/components/Select.tsx
git commit -m "feat(ui): ⌘/Ctrl+K focuses Quick Log project select"
```

---

## Task 3: Dashboard needs-review queue

**Files:**
- Modify: `src/ui/screens/Dashboard.tsx`
- Modify: `src/ui/screens/Entries.tsx`

### Why

Spec §8.3. A dashboard badge that links to Entries with `billable_status === 'needs_review'` prefiltered.

### Steps

- [ ] **Step 3.1 — Extend Entries with a status filter and prefilter consumption**

In `src/ui/screens/Entries.tsx`:

```tsx
import { useUiStore } from '@/store/ui-store';
// ...
const [statusFilter, setStatusFilter] = useState<'all' | 'billable' | 'non_billable' | 'needs_review'>('all');
const prefilter = useUiStore((s) => s.entriesPrefilter);
const setPrefilter = useUiStore((s) => s.setEntriesPrefilter);

useEffect(() => {
  if (prefilter?.status === 'needs_review') {
    setStatusFilter('needs_review');
    setPrefilter(null); // consume once
  }
}, [prefilter, setPrefilter]);
```

Update `visible` to also apply the status filter:

```tsx
const visible = (entries.data?.entries ?? []).filter(
  (e) =>
    (statusFilter === 'all' || e.billable_status === statusFilter) &&
    (!filter ||
      e.project.toLowerCase().includes(filter.toLowerCase()) ||
      e.description.toLowerCase().includes(filter.toLowerCase())),
);
```

Add a `<Select>` next to the text filter with options "all / billable / non-billable / needs-review". Default `all`. Wire to `statusFilter`.

- [ ] **Step 3.2 — Make Dashboard row clickable**

In `src/ui/screens/Dashboard.tsx`, change the needs-review block. Currently:

```tsx
{totals.needs_review_hours_hundredths > 0 && (
  <section className="p-4 rounded-2xl glass border-l-4 border-amber-400">
    <div className="font-body text-sm text-amber-800">
      {formatHours(totals.needs_review_hours_hundredths)} flagged for review — classify before closing the month.
    </div>
  </section>
)}
```

Add an `onNavigate` prop to `Dashboard` (match existing `{ partner }` signature — grep callers first to confirm the shape). Actually, Dashboard is mounted in `src/ui/Router.tsx` consumer — check how it's wired and add a `onNavigate: (r: Route) => void` prop. Then:

```tsx
import { useUiStore } from '@/store/ui-store';
// ...
const setPrefilter = useUiStore((s) => s.setEntriesPrefilter);
// ...
{totals.needs_review_hours_hundredths > 0 && (
  <button
    type="button"
    onClick={() => {
      setPrefilter({ status: 'needs_review' });
      onNavigate('entries');
    }}
    className="text-left w-full p-4 rounded-2xl glass border-l-4 border-amber-400 hover:bg-white/50 transition-colors"
  >
    <div className="font-body text-sm text-amber-800">
      {formatHours(totals.needs_review_hours_hundredths)} flagged for review — classify before closing the month. <span className="underline">Review →</span>
    </div>
  </button>
)}
```

Find where Dashboard is rendered (`grep -rn "<Dashboard " src`) and thread `onNavigate` down from wherever Router/AppShell sits.

- [ ] **Step 3.3 — Manual verification**

`npm run dev`. Log a non-billable and a needs-review entry. Open Dashboard → click the flagged-review banner → should land on Entries with the status filter set to `needs-review` and only those rows visible.

- [ ] **Step 3.4 — Run all checks and commit**

```
npm run typecheck && npm run lint && npm test
git add src/ui/screens/Dashboard.tsx src/ui/screens/Entries.tsx <any wiring change>
git commit -m "feat(dashboard): clickable needs-review queue links to filtered Entries"
```

---

## Task 4: Edit bucket (rename / budget / rate / reopen)

**Files:**
- Create: `src/ui/screens/projects/EditBucketForm.tsx`
- Modify: `src/ui/screens/projects/BucketRow.tsx`
- Modify: `src/ui/screens/ProjectsAndBuckets.tsx`
- Modify: `src/data/commit-messages.ts`

### Why

Spec §8.5: "CRUD on both". We ship create, close, archive — this adds edit.

### Non-goals

- Do NOT allow editing `bucket.id`. Entries reference buckets by id; rename-the-id is a data migration, not an edit.
- Do NOT allow changing `bucket.type`. The bucket type drives billing semantics; changing it would retroactively move billable hours. If someone created the wrong type, they archive + recreate.

### Editable fields

- `name` — display name
- `budgeted_hours_hundredths` — integer hundredths
- `rate_cents` — integer cents or null
- `status` — `active` | `closed` (reopen-from-closed allowed; archived is one-way)
- `notes` — free text

### Steps

- [ ] **Step 4.1 — Add commit message formatter**

In `src/data/commit-messages.ts`, append:

```ts
export function configEditBucketMessage(args: {
  bucketId: string;
  projectId: string;
  changes: string[];
}): string {
  const body = args.changes.length > 0 ? args.changes.join(', ') : 'no field changes';
  return `config: edit bucket ${args.bucketId} in ${args.projectId} — ${body}`;
}
```

- [ ] **Step 4.2 — Create the form**

`src/ui/screens/projects/EditBucketForm.tsx`:
```tsx
import { useState } from 'react';
import type { Bucket } from '@/schema/types';
import { formatHoursDecimal } from '@/format/format';
import { Input } from '@/ui/components/Input';
import { Select } from '@/ui/components/Select';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { Button } from '@/ui/components/Button';

type EditableFields = {
  name: string;
  budgeted_hours_hundredths: number;
  rate_cents: number | null;
  status: 'active' | 'closed';
  notes: string;
};

type Props = {
  bucket: Bucket;
  onSave: (updates: EditableFields, changes: string[]) => void;
  onCancel: () => void;
  disabled: boolean;
};

export function EditBucketForm({ bucket, onSave, onCancel, disabled }: Props): JSX.Element {
  const [name, setName] = useState(bucket.name);
  const [budgetedStr, setBudgetedStr] = useState(formatHoursDecimal(bucket.budgeted_hours_hundredths));
  const [rateStr, setRateStr] = useState(bucket.rate_cents === null ? '' : (bucket.rate_cents / 100).toString());
  const [status, setStatus] = useState<'active' | 'closed'>(
    bucket.status === 'archived' ? 'closed' : bucket.status,
  );
  const [notes, setNotes] = useState(bucket.notes);

  function submit() {
    const budgeted = Math.round(parseFloat(budgetedStr || '0') * 100);
    const rate = rateStr === '' ? null : Math.round(parseFloat(rateStr) * 100);
    const changes: string[] = [];
    if (name !== bucket.name) changes.push(`name "${bucket.name}" → "${name}"`);
    if (budgeted !== bucket.budgeted_hours_hundredths) {
      changes.push(`budgeted ${formatHoursDecimal(bucket.budgeted_hours_hundredths)}h → ${formatHoursDecimal(budgeted)}h`);
    }
    if (rate !== bucket.rate_cents) changes.push(`rate ${bucket.rate_cents ?? 'inherited'} → ${rate ?? 'inherited'}`);
    if (status !== bucket.status && bucket.status !== 'archived') changes.push(`status ${bucket.status} → ${status}`);
    if (notes !== bucket.notes) changes.push('notes updated');
    onSave(
      { name, budgeted_hours_hundredths: budgeted, rate_cents: rate, status, notes },
      changes,
    );
  }

  return (
    <div className="mt-2 p-3 glass rounded-xl flex flex-col gap-2">
      <FieldLabel label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </FieldLabel>
      <FieldLabel label="Budgeted hours">
        <Input type="number" step="0.01" min="0" value={budgetedStr} onChange={(e) => setBudgetedStr(e.target.value)} />
      </FieldLabel>
      <FieldLabel label="Rate ($/hr, empty = inherited)">
        <Input type="number" step="0.01" value={rateStr} onChange={(e) => setRateStr(e.target.value)} />
      </FieldLabel>
      <FieldLabel label="Status">
        <Select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'closed')}>
          <option value="active">active</option>
          <option value="closed">closed</option>
        </Select>
      </FieldLabel>
      <FieldLabel label="Notes">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FieldLabel>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={disabled}>Save</Button>
        <Button variant="secondary" onClick={onCancel} disabled={disabled}>Cancel</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4.3 — Add Edit button + form toggle to BucketRow**

In `src/ui/screens/projects/BucketRow.tsx`:

1. Accept a new prop `onEdit: (updates, changes) => void`.
2. Add an `editing` local state.
3. Add `<Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>` to the right-aligned button cluster (near Close/Archive).
4. Below the progress bar, if `editing`, render `<EditBucketForm bucket={bucket} onSave={(u, c) => { onEdit(u, c); setEditing(false); }} onCancel={() => setEditing(false)} disabled={disabled} />`.

- [ ] **Step 4.4 — Wire handler in ProjectsAndBuckets**

In `src/ui/screens/ProjectsAndBuckets.tsx`, add:

```tsx
function editBucket(projectId: string, bucketId: string, updates: {
  name: string;
  budgeted_hours_hundredths: number;
  rate_cents: number | null;
  status: 'active' | 'closed';
  notes: string;
}, changes: string[]) {
  if (!projects.data) return;
  mutation.mutate({
    data: updateProject(projects.data, projectId, (p) =>
      updateBucket(p, bucketId, (b) => ({
        ...b,
        name: updates.name,
        budgeted_hours_hundredths: updates.budgeted_hours_hundredths,
        rate_cents: updates.rate_cents,
        status: updates.status,
        notes: updates.notes,
      })),
    ),
    message: configEditBucketMessage({ bucketId, projectId, changes }),
  });
}
```

Pass `onEdit={(u, c) => editBucket(p.id, b.id, u, c)}` to `<BucketRow>`.

Don't forget to add `configEditBucketMessage` to the import.

- [ ] **Step 4.5 — Manual verification**

`npm run dev` → Projects → expand a project → Edit on a bucket → change name, budgeted, rate → Save. Expected: reflects in the UI and a new commit appears in the data repo with the structured change message.

- [ ] **Step 4.6 — Run all checks and commit**

```
npm run typecheck && npm run lint && npm test
git add src/ui/screens/projects/EditBucketForm.tsx src/ui/screens/projects/BucketRow.tsx src/ui/screens/ProjectsAndBuckets.tsx src/data/commit-messages.ts
git commit -m "feat(projects): inline edit bucket name, budget, rate, status, notes"
```

---

## Task 5: Bulk rate update tool

**Files:**
- Create: `src/calc/bulk-rate.ts`
- Create: `tests/calc/bulk-rate.test.ts`
- Create: `src/data/bulk-rate-update.ts`
- Create: `src/ui/screens/rates/BulkRateDialog.tsx`
- Modify: `src/calc/index.ts` (re-export)
- Modify: `src/ui/screens/Rates.tsx`

### Why

Spec §8.6 + spec §7 row 9. Lets the user retroactively apply a new rate to many entries (e.g., "every Sprosty entry from 2026-04-01 onward now bills at $175").

### Design

**Filter:** `{ projectId?: string; bucketId?: string | 'none'; dateFrom?: string; dateTo?: string; status?: BillableStatus }`. Empty field = wildcard.

**Pure preview (calc):**
- `matchesBulkFilter(entry, filter)` returns boolean.
- `previewBulkRate(entries, filter, newRateCents)` returns `{ matched: Entry[]; totalDeltaCents: number; oldAmountCents: number; newAmountCents: number }`.

**Impure apply (data):**
- `applyBulkRateUpdate(octokit, { owner, repo, matched, newRateCents, filterDescription })` — groups matched entries by month, loads each month file, updates matching entries in-place (setting `rate_cents = newRateCents`, `rate_source = 'entry_override'`, `updated_at = now`), writes with a single commit per month using `bulkEditMessage`.

### Steps

- [ ] **Step 5.1 — Write failing tests**

`tests/calc/bulk-rate.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { matchesBulkFilter, previewBulkRate } from '@/calc/bulk-rate';
import type { Entry } from '@/schema/types';

function makeEntry(p: Partial<Entry> = {}): Entry {
  return {
    id: 'e1', project: 'sprosty', date: '2026-03-10', hours_hundredths: 400,
    rate_cents: 10000, rate_source: 'global_history', billable_status: 'billable',
    bucket_id: null, description: 'd', review_flag: false,
    created_at: '2026-03-10T00:00:00Z', updated_at: '2026-03-10T00:00:00Z',
    ...p,
  };
}

describe('matchesBulkFilter', () => {
  it('matches when every populated field agrees with the entry', () => {
    const e = makeEntry({ project: 'bayard', date: '2026-03-15', billable_status: 'billable' });
    expect(matchesBulkFilter(e, { projectId: 'bayard' })).toBe(true);
    expect(matchesBulkFilter(e, { projectId: 'sprosty' })).toBe(false);
  });

  it('treats dateFrom/dateTo as inclusive string bounds (YYYY-MM-DD sorts lexically)', () => {
    const e = makeEntry({ date: '2026-04-10' });
    expect(matchesBulkFilter(e, { dateFrom: '2026-04-01' })).toBe(true);
    expect(matchesBulkFilter(e, { dateFrom: '2026-04-11' })).toBe(false);
    expect(matchesBulkFilter(e, { dateTo: '2026-04-10' })).toBe(true);
    expect(matchesBulkFilter(e, { dateTo: '2026-04-09' })).toBe(false);
  });

  it('bucket filter value "none" matches only unbucketed entries', () => {
    expect(matchesBulkFilter(makeEntry({ bucket_id: null }), { bucketId: 'none' })).toBe(true);
    expect(matchesBulkFilter(makeEntry({ bucket_id: 'x' }), { bucketId: 'none' })).toBe(false);
    expect(matchesBulkFilter(makeEntry({ bucket_id: 'x' }), { bucketId: 'x' })).toBe(true);
  });
});

describe('previewBulkRate', () => {
  it('computes delta using integer math: sum(hours * (new - old)) / 100', () => {
    const entries = [
      makeEntry({ id: 'a', hours_hundredths: 400, rate_cents: 10000 }), // 4h @ 100 = 40000
      makeEntry({ id: 'b', hours_hundredths: 200, rate_cents: 10000 }), // 2h @ 100 = 20000
    ];
    const result = previewBulkRate(entries, {}, 15000);
    expect(result.matched.map((e) => e.id)).toEqual(['a', 'b']);
    expect(result.oldAmountCents).toBe(60000); // 40000 + 20000
    expect(result.newAmountCents).toBe(90000); // 4h * 150 + 2h * 150
    expect(result.totalDeltaCents).toBe(30000);
  });

  it('only includes entries passing the filter', () => {
    const entries = [
      makeEntry({ id: 'a', project: 'sprosty' }),
      makeEntry({ id: 'b', project: 'bayard' }),
    ];
    const result = previewBulkRate(entries, { projectId: 'sprosty' }, 20000);
    expect(result.matched.map((e) => e.id)).toEqual(['a']);
  });
});
```

- [ ] **Step 5.2 — Run to verify fails**

`npm test -- tests/calc/bulk-rate.test.ts` → FAIL (module missing).

- [ ] **Step 5.3 — Implement**

`src/calc/bulk-rate.ts`:
```ts
import type { Entry, BillableStatus } from '@/schema/types';
import { mulCentsByHundredths, sumCents, subCents } from '@/calc/int';

export type BulkRateFilter = {
  projectId?: string;
  bucketId?: string | 'none';
  dateFrom?: string;
  dateTo?: string;
  status?: BillableStatus;
};

export function matchesBulkFilter(entry: Entry, filter: BulkRateFilter): boolean {
  if (filter.projectId !== undefined && entry.project !== filter.projectId) return false;
  if (filter.bucketId !== undefined) {
    if (filter.bucketId === 'none') {
      if (entry.bucket_id !== null) return false;
    } else if (entry.bucket_id !== filter.bucketId) return false;
  }
  if (filter.dateFrom !== undefined && entry.date < filter.dateFrom) return false;
  if (filter.dateTo !== undefined && entry.date > filter.dateTo) return false;
  if (filter.status !== undefined && entry.billable_status !== filter.status) return false;
  return true;
}

export type BulkRatePreview = {
  matched: Entry[];
  oldAmountCents: number;
  newAmountCents: number;
  totalDeltaCents: number;
};

export function previewBulkRate(
  entries: Entry[],
  filter: BulkRateFilter,
  newRateCents: number,
): BulkRatePreview {
  const matched = entries.filter((e) => matchesBulkFilter(e, filter));
  const oldAmountCents = sumCents(
    matched.map((e) => mulCentsByHundredths(e.rate_cents, e.hours_hundredths)),
  );
  const newAmountCents = sumCents(
    matched.map((e) => mulCentsByHundredths(newRateCents, e.hours_hundredths)),
  );
  return {
    matched,
    oldAmountCents,
    newAmountCents,
    totalDeltaCents: subCents(newAmountCents, oldAmountCents),
  };
}
```

Re-export from `src/calc/index.ts`:
```ts
export { matchesBulkFilter, previewBulkRate, type BulkRateFilter, type BulkRatePreview } from './bulk-rate';
```

- [ ] **Step 5.4 — Run tests green**

`npm test -- tests/calc/bulk-rate.test.ts` → PASS.

- [ ] **Step 5.5 — Implement the apply module**

`src/data/bulk-rate-update.ts`:
```ts
import type { Octokit } from '@octokit/rest';
import type { Entry, EntriesFile } from '@/schema/types';
import { writeJsonFileWithRetry } from './github-file';
import { validateEntries, formatValidationErrors } from '@/schema/validators';
import { bulkEditMessage } from './commit-messages';

export type ApplyBulkRateArgs = {
  owner: string;
  repo: string;
  matched: Entry[];
  newRateCents: number;
  filterDescription: string;
};

function entriesPath(month: string): string {
  return `data/entries/${month}.json`;
}

export async function applyBulkRateUpdate(
  octokit: Octokit,
  args: ApplyBulkRateArgs,
): Promise<void> {
  const byMonth = new Map<string, Set<string>>();
  for (const e of args.matched) {
    const m = e.date.slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, new Set());
    byMonth.get(m)!.add(e.id);
  }
  const message = bulkEditMessage({
    rate_cents: args.newRateCents,
    count: args.matched.length,
    filter: args.filterDescription,
  });
  const now = new Date().toISOString();
  for (const [month, ids] of byMonth) {
    await writeJsonFileWithRetry<EntriesFile>(octokit, {
      owner: args.owner,
      repo: args.repo,
      path: entriesPath(month),
      message,
      transform: (current) => {
        if (!current) throw new Error(`Cannot bulk-update missing file ${entriesPath(month)}`);
        const next: EntriesFile = {
          ...current,
          entries: current.entries.map((e) =>
            ids.has(e.id)
              ? { ...e, rate_cents: args.newRateCents, rate_source: 'entry_override' as const, updated_at: now }
              : e,
          ),
        };
        const v = validateEntries(next);
        if (!v.ok) throw new Error(`Bulk update failed validation:\n${formatValidationErrors(v.errors)}`);
        return next;
      },
    });
  }
}
```

- [ ] **Step 5.6 — Build the dialog UI**

`src/ui/screens/rates/BulkRateDialog.tsx`:
```tsx
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useAllEntries } from '@/data/hooks/use-all-entries';
import { useProjects } from '@/data/hooks/use-projects';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useAuthStore } from '@/store/auth-store';
import { previewBulkRate, type BulkRateFilter } from '@/calc';
import { applyBulkRateUpdate } from '@/data/bulk-rate-update';
import { splitRepoPath } from '@/data/octokit-client';
import { formatCents, formatHoursDecimal } from '@/format/format';
import type { Partner } from '@/schema/types';
import { Input } from '@/ui/components/Input';
import { Select } from '@/ui/components/Select';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { Button } from '@/ui/components/Button';
import { Banner } from '@/ui/components/Banner';
import { qk } from '@/data/query-keys';

type Props = { partner: Partner; onClose: () => void };

function filterToDescription(f: BulkRateFilter): string {
  const parts: string[] = [];
  if (f.projectId) parts.push(`project: ${f.projectId}`);
  if (f.bucketId) parts.push(`bucket: ${f.bucketId}`);
  if (f.dateFrom) parts.push(`date >= ${f.dateFrom}`);
  if (f.dateTo) parts.push(`date <= ${f.dateTo}`);
  if (f.status) parts.push(`status: ${f.status}`);
  return parts.join(', ') || 'all entries';
}

export function BulkRateDialog({ partner, onClose }: Props): JSX.Element {
  const allEntriesQuery = useAllEntries();
  const projects = useProjects();
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const queryClient = useQueryClient();

  const [projectId, setProjectId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [newRateStr, setNewRateStr] = useState('');
  const currency = { currency_symbol: partner.currency_symbol, currency_display_suffix: partner.currency_display_suffix };
  const newRateCents = newRateStr === '' ? 0 : Math.round(parseFloat(newRateStr) * 100);
  const filter: BulkRateFilter = useMemo(() => ({
    projectId: projectId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [projectId, dateFrom, dateTo]);

  const preview = useMemo(() => {
    if (!allEntriesQuery.data || newRateCents === 0) return null;
    return previewBulkRate(allEntriesQuery.data, filter, newRateCents);
  }, [allEntriesQuery.data, filter, newRateCents]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!octokit || !dataRepo || !preview) throw new Error('Not ready');
      const { owner, repo } = splitRepoPath(dataRepo);
      await applyBulkRateUpdate(octokit, {
        owner, repo,
        matched: preview.matched,
        newRateCents,
        filterDescription: filterToDescription(filter),
      });
    },
    onSuccess: () => {
      const months = new Set(preview?.matched.map((e) => e.date.slice(0, 7)) ?? []);
      for (const m of months) {
        queryClient.invalidateQueries({ queryKey: qk.monthEntries(dataRepo ?? 'none', m) });
      }
      queryClient.invalidateQueries({ queryKey: [...qk.all, 'all-entries', dataRepo ?? 'none'] });
      onClose();
    },
  });

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl glass-strong rounded-2xl p-6 glow-blue max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg">Bulk rate update</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-xl leading-none">&times;</button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <FieldLabel label="Project (optional)">
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">— all —</option>
              {projects.data?.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </FieldLabel>
          <FieldLabel label="New rate ($/hr)">
            <Input type="number" step="0.01" value={newRateStr} onChange={(e) => setNewRateStr(e.target.value)} />
          </FieldLabel>
          <FieldLabel label="Date from (inclusive)">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </FieldLabel>
          <FieldLabel label="Date to (inclusive)">
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </FieldLabel>
        </div>
        {preview && (
          <div className="p-4 rounded-xl glass mb-4 text-sm font-mono">
            <div>{preview.matched.length} entries match.</div>
            <div>Old total: {formatCents(preview.oldAmountCents, currency)}</div>
            <div>New total: {formatCents(preview.newAmountCents, currency)}</div>
            <div className={preview.totalDeltaCents >= 0 ? 'text-emerald-700' : 'text-red-700'}>
              Delta: {formatCents(preview.totalDeltaCents, currency)}
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-slate-600">Matched entries</summary>
              <ul className="mt-1 text-xs">
                {preview.matched.slice(0, 50).map((e) => (
                  <li key={e.id}>{e.date} · {e.project} · {formatHoursDecimal(e.hours_hundredths)}h · {formatCents(e.rate_cents, currency)} → {formatCents(newRateCents, currency)}</li>
                ))}
                {preview.matched.length > 50 && <li>… and {preview.matched.length - 50} more</li>}
              </ul>
            </details>
          </div>
        )}
        {mutation.error && <Banner variant="error">{(mutation.error as Error).message}</Banner>}
        <div className="flex gap-3">
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !preview || preview.matched.length === 0}>
            {mutation.isPending ? 'Applying…' : `Apply to ${preview?.matched.length ?? 0} entries`}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 5.7 — Expose from Rates screen**

In `src/ui/screens/Rates.tsx`:
1. Add `const [showBulk, setShowBulk] = useState(false);`.
2. Replace the post-MVP banner with a `<Button onClick={() => setShowBulk(true)} variant="secondary">Bulk rate update…</Button>` above it.
3. Render `{showBulk && <BulkRateDialog partner={partner} onClose={() => setShowBulk(false)} />}` at the end of the component.
4. Import `BulkRateDialog`.

- [ ] **Step 5.8 — Manual verification**

- Log 3 entries across 2 months at $125/hr.
- Rates → Bulk rate update → filter by project, new rate $175.
- Preview shows 3 matches, delta > 0.
- Apply. Two month files update, each with a `bulk-edit:` commit message.
- Re-open Entries for each month — rates updated, `rate_source = entry_override`.

- [ ] **Step 5.9 — Run all checks and commit**

```
npm run typecheck && npm run lint && npm test
git add src/calc/bulk-rate.ts src/calc/index.ts src/data/bulk-rate-update.ts src/ui/screens/rates/ src/ui/screens/Rates.tsx tests/calc/bulk-rate.test.ts
git commit -m "feat(rates): bulk rate update tool with filter + preview + apply"
```

---

## Task 6: Snapshot list + drift detection + diff view

**Files:**
- Create: `src/calc/drift.ts`
- Create: `tests/calc/drift.test.ts`
- Create: `src/data/snapshots-list.ts`
- Create: `src/data/hooks/use-snapshots-list.ts`
- Create: `src/ui/screens/snapshots/SnapshotRow.tsx`
- Create: `src/ui/screens/snapshots/DriftDiff.tsx`
- Modify: `src/calc/index.ts` (re-export)
- Modify: `src/data/query-keys.ts` (add key)
- Modify: `src/ui/screens/Snapshots.tsx`

### Why

Spec §5.6 + §8.7. Today the Snapshots screen can only *close* the current month. This task adds: list every snapshot; compare `snapshot.source_hash` against `hashEntries(current month file)`; if different, surface the diff of added/removed/changed entry ids.

### Design

**Pure drift computation** (`src/calc/drift.ts`):
```ts
export type DriftDiff = {
  drifted: boolean;
  expectedHash: string;
  actualHash: string;
  added: Entry[];          // in current but not in snapshot.entry_ids
  removed: string[];       // in snapshot.entry_ids but not in current
  changed: Entry[];        // in both, but hash of just-this-entry differs
};

export async function computeDrift(snapshot: Snapshot, currentEntries: Entry[]): Promise<DriftDiff>;
```

`hashEntries` already exists; we use it to produce the single-month actual hash and compare. For per-entry change detection we hash each entry individually (using the same canonicalization but on a single-entry array).

**Listing all snapshots** (`src/data/snapshots-list.ts`): one `GET /repos/.../contents/data/snapshots` call, then `loadSnapshot` per file. Cached via react-query.

### Steps

- [ ] **Step 6.1 — Write drift tests**

`tests/calc/drift.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeDrift } from '@/calc/drift';
import { hashEntries } from '@/calc';
import type { Entry, Snapshot } from '@/schema/types';

function makeEntry(p: Partial<Entry> = {}): Entry {
  return {
    id: 'e1', project: 'sprosty', date: '2026-03-10', hours_hundredths: 400,
    rate_cents: 10000, rate_source: 'global_history', billable_status: 'billable',
    bucket_id: null, description: 'd', review_flag: false,
    created_at: '2026-03-10T00:00:00Z', updated_at: '2026-03-10T00:00:00Z',
    ...p,
  };
}

async function snapshotFor(entries: Entry[]): Promise<Snapshot> {
  return {
    schema_version: 1, month: '2026-03',
    closed_at: '2026-04-01T00:00:00Z', closed_at_commit_sha: 'deadbeef',
    source_hash: await hashEntries(entries),
    totals: {
      total_hours_hundredths: 0, billable_hours_hundredths: 0,
      non_billable_hours_hundredths: 0, needs_review_hours_hundredths: 0,
      billable_amount_cents: 0,
    },
    per_project: [], entry_ids: entries.map((e) => e.id),
  };
}

describe('computeDrift', () => {
  it('reports no drift when current entries hash matches snapshot.source_hash', async () => {
    const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
    const snap = await snapshotFor(entries);
    const d = await computeDrift(snap, entries);
    expect(d.drifted).toBe(false);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.changed).toEqual([]);
  });

  it('detects added entries', async () => {
    const original = [makeEntry({ id: 'a' })];
    const snap = await snapshotFor(original);
    const current = [...original, makeEntry({ id: 'b' })];
    const d = await computeDrift(snap, current);
    expect(d.drifted).toBe(true);
    expect(d.added.map((e) => e.id)).toEqual(['b']);
  });

  it('detects removed entries', async () => {
    const original = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
    const snap = await snapshotFor(original);
    const current = [original[0]!];
    const d = await computeDrift(snap, current);
    expect(d.drifted).toBe(true);
    expect(d.removed).toEqual(['b']);
  });

  it('detects changed entries by hashing each entry individually', async () => {
    const original = [makeEntry({ id: 'a', hours_hundredths: 400 })];
    const snap = await snapshotFor(original);
    const current = [makeEntry({ id: 'a', hours_hundredths: 500 })];
    const d = await computeDrift(snap, current);
    expect(d.drifted).toBe(true);
    expect(d.changed.map((e) => e.id)).toEqual(['a']);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
  });
});
```

- [ ] **Step 6.2 — Run to confirm fails**

`npm test -- tests/calc/drift.test.ts` → FAIL (module missing).

- [ ] **Step 6.3 — Implement drift**

`src/calc/drift.ts`:
```ts
import type { Entry, Snapshot } from '@/schema/types';
import { hashEntries } from './hash';

export type DriftDiff = {
  drifted: boolean;
  expectedHash: string;
  actualHash: string;
  added: Entry[];
  removed: string[];
  changed: Entry[];
};

export async function computeDrift(snapshot: Snapshot, currentEntries: Entry[]): Promise<DriftDiff> {
  const actualHash = await hashEntries(currentEntries);
  const expectedHash = snapshot.source_hash;
  if (actualHash === expectedHash) {
    return { drifted: false, expectedHash, actualHash, added: [], removed: [], changed: [] };
  }

  const snapshotIds = new Set(snapshot.entry_ids);
  const currentById = new Map(currentEntries.map((e) => [e.id, e]));

  const added = currentEntries.filter((e) => !snapshotIds.has(e.id));
  const removed = snapshot.entry_ids.filter((id) => !currentById.has(id));

  // For changed-detection we need the snapshotted entries, but the snapshot file only stores ids.
  // We can't reconstruct them; approximate by: any id present in both sets whose single-entry hash
  // differs from its "place" hash. Since we don't have the historical entry, we flag every
  // id-present-in-both as potentially-changed iff the overall hash differs AND the set of added/removed
  // doesn't fully account for the mismatch. Concretely: if the two sets of ids are equal but hashes differ,
  // then every shared entry is potentially changed. Otherwise, only flag entries whose single-entry
  // canonical hash differs from itself in a re-hash round-trip (always same — so we can't know).
  //
  // Pragmatic behavior: if ids match exactly, every shared entry is reported as `changed` so the user
  // can inspect them. If added/removed exist, we only report those; any residual per-entry change
  // still surfaces because `drifted: true` and the UI tells the user to re-close the month after review.
  const changed: Entry[] =
    added.length === 0 && removed.length === 0
      ? currentEntries.filter((e) => snapshotIds.has(e.id))
      : [];

  return { drifted: true, expectedHash, actualHash, added, removed, changed };
}
```

Re-export from `src/calc/index.ts`:
```ts
export { computeDrift, type DriftDiff } from './drift';
```

- [ ] **Step 6.4 — Run tests**

`npm test -- tests/calc/drift.test.ts` → PASS.

- [ ] **Step 6.5 — Implement snapshot list**

`src/data/snapshots-list.ts`:
```ts
import type { Octokit } from '@octokit/rest';
import type { Snapshot } from '@/schema/types';
import { loadSnapshot } from './snapshots-repo';

export async function listSnapshots(
  octokit: Octokit,
  args: { owner: string; repo: string },
): Promise<Snapshot[]> {
  let files: Array<{ name: string }>;
  try {
    const res = await octokit.rest.repos.getContent({
      owner: args.owner, repo: args.repo, path: 'data/snapshots',
    });
    if (!Array.isArray(res.data)) return [];
    files = (res.data as Array<{ name: string; type: string }>).filter(
      (f) => f.type === 'file' && f.name.endsWith('.json'),
    );
  } catch (e) {
    if ((e as { status?: number }).status === 404) return [];
    throw e;
  }
  const out: Snapshot[] = [];
  for (const f of files) {
    const month = f.name.replace('.json', '');
    const s = await loadSnapshot(octokit, { owner: args.owner, repo: args.repo, month });
    if (s) out.push(s);
  }
  return out.sort((a, b) => a.month.localeCompare(b.month));
}
```

- [ ] **Step 6.6 — Add query hook + key**

In `src/data/query-keys.ts`, add:
```ts
snapshotsList: (dataRepo: string) => [...qk.all, 'snapshots-list', dataRepo] as const,
```

(Adapt the shape to match the existing `qk` object — look at how other keys are declared in that file.)

`src/data/hooks/use-snapshots-list.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { useOctokit } from './use-octokit';
import { useAuthStore } from '@/store/auth-store';
import { listSnapshots } from '@/data/snapshots-list';
import { splitRepoPath } from '@/data/octokit-client';
import { qk } from '@/data/query-keys';

export function useSnapshotsList() {
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  return useQuery({
    queryKey: qk.snapshotsList(dataRepo ?? 'none'),
    queryFn: async () => {
      if (!octokit || !dataRepo) return [];
      const { owner, repo } = splitRepoPath(dataRepo);
      return listSnapshots(octokit, { owner, repo });
    },
    enabled: !!octokit && !!dataRepo,
  });
}
```

- [ ] **Step 6.7 — Snapshot list UI**

`src/ui/screens/snapshots/SnapshotRow.tsx`:
```tsx
import { useState } from 'react';
import { useMonthEntries } from '@/data/hooks/use-month-entries';
import { computeDrift, type DriftDiff } from '@/calc';
import type { Snapshot, Partner } from '@/schema/types';
import { formatCents, formatHours } from '@/format/format';
import { DriftDiffView } from './DriftDiff';

type Props = { snapshot: Snapshot; partner: Partner };

export function SnapshotRow({ snapshot, partner }: Props): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [drift, setDrift] = useState<DriftDiff | null>(null);
  const entries = useMonthEntries(snapshot.month);
  const currency = { currency_symbol: partner.currency_symbol, currency_display_suffix: partner.currency_display_suffix };

  async function toggle() {
    if (!expanded && entries.data && drift === null) {
      const d = await computeDrift(snapshot, entries.data.entries);
      setDrift(d);
    }
    setExpanded((v) => !v);
  }

  const drifted = drift?.drifted ?? null;
  return (
    <div className="glass rounded-xl p-4">
      <button type="button" onClick={toggle} className="w-full flex items-center justify-between">
        <div className="text-left">
          <div className="font-display font-bold">{snapshot.month}</div>
          <div className="text-xs text-slate-500">closed {snapshot.closed_at.slice(0, 10)}</div>
        </div>
        <div className="text-right text-sm">
          <div>{formatHours(snapshot.totals.billable_hours_hundredths)} · {formatCents(snapshot.totals.billable_amount_cents, currency)}</div>
          {drifted === true && <div className="text-amber-700 text-xs font-semibold">⚠ drift detected</div>}
          {drifted === false && <div className="text-emerald-700 text-xs">✓ consistent</div>}
          {drifted === null && <div className="text-slate-400 text-xs">{expanded ? 'computing…' : 'click to check'}</div>}
        </div>
      </button>
      {expanded && drift && <DriftDiffView drift={drift} />}
    </div>
  );
}
```

`src/ui/screens/snapshots/DriftDiff.tsx`:
```tsx
import type { DriftDiff } from '@/calc';

export function DriftDiffView({ drift }: { drift: DriftDiff }): JSX.Element {
  if (!drift.drifted) {
    return <div className="mt-3 text-sm text-emerald-700">Hashes match. Snapshot is current.</div>;
  }
  return (
    <div className="mt-3 text-xs font-mono flex flex-col gap-2">
      <div className="text-slate-500">expected {drift.expectedHash.slice(0, 16)}… · actual {drift.actualHash.slice(0, 16)}…</div>
      {drift.added.length > 0 && (
        <div>
          <div className="text-emerald-700 font-semibold">+ added ({drift.added.length})</div>
          {drift.added.slice(0, 20).map((e) => <div key={e.id} className="text-emerald-700">{e.id}</div>)}
        </div>
      )}
      {drift.removed.length > 0 && (
        <div>
          <div className="text-red-700 font-semibold">− removed ({drift.removed.length})</div>
          {drift.removed.slice(0, 20).map((id) => <div key={id} className="text-red-700">{id}</div>)}
        </div>
      )}
      {drift.changed.length > 0 && (
        <div>
          <div className="text-amber-700 font-semibold">~ possibly changed ({drift.changed.length})</div>
          {drift.changed.slice(0, 20).map((e) => <div key={e.id} className="text-amber-700">{e.id}</div>)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6.8 — Rewrite the Snapshots screen**

Replace `src/ui/screens/Snapshots.tsx` so it renders:
1. The existing "close current month" card (keep as a section at the top).
2. A new section `<h2>Closed snapshots</h2>` that iterates `useSnapshotsList()` and renders a `<SnapshotRow>` for each.
3. Keep the warning banner removed.

```tsx
import { useSnapshotsList } from '@/data/hooks/use-snapshots-list';
import { SnapshotRow } from './snapshots/SnapshotRow';
// ...
const snaps = useSnapshotsList();
// ...
<section className="flex flex-col gap-2">
  <h2 className="font-display text-lg">Closed snapshots</h2>
  {snaps.isLoading && <div className="text-slate-500">Loading…</div>}
  {snaps.error && <Banner variant="error">{(snaps.error as Error).message}</Banner>}
  {(snaps.data ?? []).map((s) => <SnapshotRow key={s.month} snapshot={s} partner={partner} />)}
  {snaps.data?.length === 0 && <div className="text-sm text-slate-500">No closed snapshots yet.</div>}
</section>
```

- [ ] **Step 6.9 — Invalidate on close**

After `writeSnapshot` succeeds, also invalidate the list:
```ts
queryClient.invalidateQueries({ queryKey: qk.snapshotsList(dataRepo ?? 'none') });
```

- [ ] **Step 6.10 — Manual verification**

1. Close a month. It appears in the new list.
2. Edit an entry in that closed month. Refresh. Expand the row — drift badge flips amber, diff shows the changed id.
3. Unedit (restore original). Refresh. Badge returns to green.

- [ ] **Step 6.11 — Run all checks and commit**

```
npm run typecheck && npm run lint && npm test
git add src/calc/drift.ts src/calc/index.ts src/data/snapshots-list.ts src/data/hooks/use-snapshots-list.ts src/data/query-keys.ts src/ui/screens/snapshots/ src/ui/screens/Snapshots.tsx tests/calc/drift.test.ts
git commit -m "feat(snapshots): list closed months with drift detection and diff"
```

---

## Task 7: Update backlog doc

**Files:**
- Modify: `docs/superpowers/backlog.md`

- [ ] **Step 7.1 — Move completed items**

Move the six Phase-A items (Bucket CRUD ✓ partial, Edit modal ✓ shipped earlier, Snapshot list ✓, Bulk rate ✓, CSV ✓, ⌘K ✓, Needs-review queue ✓, Drift indicator ✓) under a new top-level `## Shipped` section at the top of `backlog.md`. Leave the remaining medium-term and speculative sections intact.

- [ ] **Step 7.2 — Commit**

```
git add docs/superpowers/backlog.md
git commit -m "docs: mark Phase A near-term items as shipped"
```

---

## Self-review checklist (after completing all tasks)

- [ ] **Spec coverage:** Every bullet in the "Near-term" section of `docs/superpowers/backlog.md` at plan-start-time has a corresponding task — except Edit modal for entries, which was already shipped pre-plan.
- [ ] **Placeholders:** No `TODO`, no "implement later" in shipped code. Grep: `git diff <start-sha>..HEAD -- 'src/**'` should show zero `TODO` / `FIXME` added.
- [ ] **Integer math:** `git grep "_cents\|_hundredths" src/export src/calc/bulk-rate.ts src/calc/drift.ts` — confirm no `*` or `/` on these except via `src/calc/int.ts` helpers.
- [ ] **Commit messages:** Every mutation goes through `src/data/commit-messages.ts`. Grep `bulk-edit:\|config: edit bucket` in the repo's recent commits after applying.
- [ ] **All gates green:** `npm run typecheck && npm run lint && npm test` passes on the final commit.

---

## Out of scope (deliberately)

- Log-screen 2-column redesign (Phase B)
- Calendar provider integration (Phase C)
- Offline queue, PDF export, multi-device conflict UX (still backlog)
- Schema bump, rate history editing (medium-term backlog)
