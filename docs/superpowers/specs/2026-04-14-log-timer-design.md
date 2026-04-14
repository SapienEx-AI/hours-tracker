# Log-page timer — design

Spec for the inline timer on the Log page. Third "smart" capture surface after manual entry and Google Calendar suggestions. Ships together with a schema v2 → v3 generalization that turns the single-source `source_event_id` field into a multi-source `source_ref`.

## 1. Purpose

Let a consultant time their work directly in the Log page and then **prefill** the Log form from the completed session — never silently save. Timer sessions behave like another suggestion source: the user approves before an entry is created, exactly as they do with calendar events today.

The timer lives inside the form flow (next to the Hours field), not in the right-column Suggestions panel. Rationale: calendar suggestions are *external* events ("did this meeting become work?"). A timer is an *intentional* user gesture. Putting both in the right column conflates different mental models.

## 2. Non-goals

- **No auto-save.** Every completed session waits for an explicit "Load into form" click before producing an entry.
- **No multi-timer.** One timer at a time. Starting a new session while one is running is blocked — user must stop the existing one first.
- **No cross-device sync.** Timer state lives in browser localStorage + `BroadcastChannel` for same-browser tab sync. A timer on laptop does not appear on phone. (If this becomes necessary, it's phase 2 and implies a backend — out of scope here.)
- **No auto-stop on idle.** v1 trusts the user to stop their own timer. A soft warning banner appears once elapsed exceeds 12h, but the timer keeps running.
- **No per-entry pause history.** We track total elapsed only. We do not persist when each pause/resume happened in the final entry.
- **No header-pill cross-page running indicator.** Deferred to phase 2. v1 shows the running state only on the Log page.
- **No integration with calendar suggestions.** A running timer does not dim or re-order calendar suggestions. The two surfaces coexist independently.

## 3. Architecture decisions (locked from brainstorming 2026-04-14)

| # | Decision | Rationale |
|---|---|---|
| 1 | Timer UI lives inside `LogForm`, adjacent to the Hours field | Timer is user-intentional, not an external suggestion. Keeps the right column pure for external sources. |
| 2 | Stop produces an inline pre-load banner above the form, not a toast or modal | Mirrors existing `prefillHint` slot. No new pattern. |
| 3 | "Load into form" behaves like `applySuggestion` | Identical prefill contract, zero new UX. |
| 4 | Snapshot project / bucket / description / date at start (Option 2 from brainstorm) | Session belongs to the context it was started in. Mid-run form edits do not mutate the session. |
| 5 | One active timer at a time | Matches Toggl / Harvest / Clockify. Multi-timer is a power-user feature YAGNI'd until asked. |
| 6 | localStorage-backed with `BroadcastChannel` tab sync | Static app constraint. Survives reloads, crashes, and tab re-opens. Cross-tab means opening Log in tab B shows the running timer started in tab A. |
| 7 | Wall-clock delta (`Date.now()`), not `setInterval` tick counting | Browsers throttle background timers; tick math drifts. `Date.now()` never drifts. |
| 8 | Elapsed rounded to nearest 0.01h (banker's rounding) on Load | Hundredths is the schema's native precision. Users who want to round to 15 min can use the existing chip controls after load. |
| 9 | Schema v2 → v3 generalizes `source_event_id` → `source_ref: { kind, id } \| null` | A third source (activity agent) is already on the roadmap. Keep the entry shape clean. |
| 10 | Hash canonicalization preserves old hashes exactly | March 2026 golden fixture and every existing snapshot must remain valid. `canonicalizeEntriesForHashing` projects v3 `source_ref` back to per-kind fields for hashing only. |

## 4. Data model changes

### 4.1 Entry schema bump 2 → 3

**File:** `schemas/entries.schema.json` — replace the `source_event_id` property with `source_ref` and bump `schema_version` to `3`.

New field on every entry:

```ts
type SourceRef =
  | { kind: 'calendar'; id: string }   // id = Google Calendar event id
  | { kind: 'timer'; id: string }      // id = timer session id (uuid v4)
  | null;                              // manual entry, no source

type Entry = {
  // ... all existing fields unchanged
  source_ref: SourceRef;
};
```

The `kind` enum is explicit and closed. Adding a fourth source (e.g. `'activity'`) is an additive schema change but **not** another version bump — new kinds can land without a new schema version, the same way calendar did.

### 4.2 Version compatibility matrix

| File's `schema_version` | Reader behavior | Writer behavior |
|---|---|---|
| `1` (pre-calendar) | Validator accepts. In-memory backfill: every entry gets `source_ref: null`. | Any write upgrades file to `schema_version: 3` and the commit message carries `[schema v1→v3]`. |
| `2` (calendar live) | Validator accepts. In-memory backfill: `source_event_id: null` becomes `source_ref: null`; `source_event_id: <id>` becomes `source_ref: { kind: 'calendar', id: <id> }`. | Any write upgrades file to `schema_version: 3` with `[schema v2→v3]` suffix. All existing entries in that file get their `source_event_id` lifted to `source_ref`, in order. |
| `3` (timer live) | Validator accepts. No backfill needed. | Writes stay at v3. |

**Historical files stay at their on-disk version until something writes them.** Snapshots that have already closed a month preserve that month's schema version on disk — snapshot immutability is inviolable.

### 4.3 Hash invariance

`canonicalizeEntriesForHashing` must preserve every existing hash exactly. The canonical form remains the v2 shape, projected from `source_ref`:

```ts
function canonicalSourceFields(ref: SourceRef): Record<string, string | null> {
  if (ref === null) return { source_event_id: null };
  if (ref.kind === 'calendar') return { source_event_id: ref.id };
  if (ref.kind === 'timer') return { source_timer_id: ref.id };
  // future kinds project into their own canonical field
}
```

Rules:

- A v3 entry with `source_ref: null` hashes identically to a v2 entry with `source_event_id: null` or a v1 entry with no source field at all. All three serialize as `"source_event_id": null`.
- A v3 entry with `source_ref: { kind: 'calendar', id: 'abc' }` hashes identically to a v2 entry with `source_event_id: 'abc'`.
- A v3 entry with `source_ref: { kind: 'timer', id: 'xyz' }` adds a new `source_timer_id: 'xyz'` field to the canonical form — but no existing v2 entry has one, so no existing hash moves.

**Verification:** `npm run test:golden` and the March 2026 regression fixture must continue to pass **unchanged** after this change. Any movement in those hashes is a bug in the canonicalization.

### 4.4 `FormState` update

`src/ui/screens/log/form-helpers.ts`:

```ts
export type FormState = {
  // ... existing fields
  source_ref: SourceRef;  // replaces source_event_id
};
```

`buildEntry` writes `form.source_ref` through to the Entry unchanged. `applySuggestion` for calendar sets `source_ref: { kind: 'calendar', id: event.id }`. The new timer `applyTimerSession` sets `source_ref: { kind: 'timer', id: session.id }`.

## 5. Timer session data model

**In-memory + localStorage only. Never written to the data repo except via a saved Entry's `source_ref`.**

```ts
type TimerPhase =
  | { kind: 'idle' }
  | { kind: 'running'; started_at: number; base_elapsed_ms: number }  // resumed after pause
  | { kind: 'paused'; elapsed_ms: number }
  | { kind: 'stopped'; elapsed_ms: number };

type TimerSession = {
  id: string;                     // uuid v4, generated at start
  started_wall: string;           // ISO 8601, for display + date resolution
  // Snapshot at start — immutable for the session's lifetime:
  snapshot: {
    projectId: string;            // may be '' if none selected at start
    bucketId: string | null;
    description: string;          // may be ''
    date: string;                 // YYYY-MM-DD, captured from form.date at start
  };
  phase: TimerPhase;
};
```

Live elapsed is **derived**, never stored:

```ts
function liveElapsedMs(phase: TimerPhase): number {
  if (phase.kind === 'running') {
    return phase.base_elapsed_ms + (Date.now() - phase.started_at);
  }
  if (phase.kind === 'paused' || phase.kind === 'stopped') {
    return phase.elapsed_ms;
  }
  return 0;
}
```

Pause compresses a running phase into a paused phase by freezing the current live elapsed. Resume opens a new running phase with `base_elapsed_ms` equal to the frozen value.

## 6. State machine

```
          start ▶
 ┌───────────────────┐
 │       Idle        │
 └─────────▲─────────┘
           │ load-into-form / discard (after Stopped)
           │
 ┌─────────┴─────────┐   pause ⏸   ┌───────────────────┐
 │     Running       │ ───────────▶│      Paused       │
 └─────────┬─────────┘              └─────────┬─────────┘
           │ stop ■  ▲                        │ resume ▶
           │        └─────────────────────────┘
           ▼
 ┌───────────────────┐
 │      Stopped      │  (live elapsed frozen; banner visible in UI)
 └───────────────────┘
```

Invariants:

- **Monotonic elapsed.** No transition can cause live elapsed to decrease. Pause freezes, resume continues from frozen.
- **Immutable snapshot.** The `snapshot` fields are set exactly once (at start) and never mutate.
- **Single active session.** At most one `TimerSession` exists at a time. `start` is a no-op if a session already exists in a non-Idle state.
- **Stopped is terminal until user choice.** A `stopped` session persists in localStorage until either `applyTimerSession` (load into form) or `discardTimerSession` is called.
- **Load is the only path that produces an Entry.** No internal machinery creates entries from timer state.

## 7. UX specification

### 7.1 Layout — `LogForm`

The Hours field (currently a standalone input row with chips below) becomes a composite cell:

```
┌ Hours ─────────────────────────────────────────────────────┐
│  [ ___ h ]  [▶ start timer]            [0.25][0.5][1][2]...│
└────────────────────────────────────────────────────────────┘
```

When running:

```
┌ Hours ─────────────────────────────────────────────────────┐
│  0:14:32  (live, amber accent)     [⏸ pause] [■ stop] [✕]   │
│  Snapshot: Sector Growth › Discovery  (small, slate-500)    │
└────────────────────────────────────────────────────────────┘
```

The Hours input and chips are disabled while timer is **Running** or **Paused** (a live clock is occupying that cell). On **Stopped**, the input re-enables: the user may type a manual entry in parallel with the pre-load banner — the stopped session persists as a banner until explicitly loaded or discarded, and does not block other form saves. A small `✕` next to ⏸/■ aborts the session entirely without producing a pre-load banner.

### 7.2 Post-stop pre-load banner

Rendered in the same slot as the existing `prefillHint`, above the form body:

```
┌────────────────────────────────────────────────────────────┐
│ Timer: 1h 23m — Sector Growth › Discovery                   │
│ Started 2026-04-14 09:17, stopped 10:40                     │
│                       [Discard]     [Load into form]        │
└────────────────────────────────────────────────────────────┘
```

- **Load into form** → calls `applyTimerSession` which fills the form with the session's snapshot + elapsed hours. `source_ref: { kind: 'timer', id: session.id }`. Banner dismisses; session cleared from localStorage.
- **Discard** → clears session, banner dismisses, form unchanged.
- **Reload while banner is visible** → session rehydrates, banner reappears on next Log visit. Banner does not disappear on navigation.

### 7.3 Running state across navigation (v1 scope)

- Leaving the Log page while a timer runs keeps the timer running in the background (it's derived from wall clock — it always "runs").
- Returning to the Log page shows the timer UI in its current phase.
- Phase 2 will add a header-pill indicator visible from other screens. Not in v1.

### 7.4 Empty-snapshot behaviors

- **No project selected at start.** Allowed. Running snapshot shows `Timer: 0:14:32 — no project`. Banner on stop reads `Timer: 1h 23m — no project`. Load prefills hours and description but the form's Project remains empty — `canSave` stays false until user picks a project.
- **No description at start.** Allowed. Banner and load treat description as empty string. User adds one in the form before saving.

### 7.5 Edge cases

| Situation | Behavior |
|---|---|
| Cross-midnight timer (e.g. 23:30 → 01:15 next day) | Entry date = session start date. Hours reflect full elapsed. No date split in v1. |
| Elapsed exceeds 12h | Soft warning in the running state: "⚠ Timer has been running over 12h — still active?" Timer continues. |
| Elapsed exceeds 24h (i.e. `hours_hundredths > 2400`) | Load clamps hours to 2400 (24h — the schema maximum). Banner surfaces: "Duration exceeded 24h; clipped to 24h on load. Edit after loading if needed." |
| Page reload while Running | Rehydrates from localStorage. Live elapsed continues from wall clock. |
| Browser crash / hard quit | Same as reload — session persists in localStorage. Next time Log opens, running session is visible exactly as it was. |
| Two tabs open, start in tab A | Tab B observes via `BroadcastChannel` and updates UI. Controls in either tab operate the same underlying session. |
| Clock changes (DST, manual clock change) | Elapsed uses `Date.now()` which is monotonic UTC; DST has no effect. Manual clock-backwards would produce apparent elapsed decrease — we defensively clamp live elapsed to `base_elapsed_ms` minimum. |
| User picks a different date in the form while timer is running | No effect on session. Session date = start-time snapshot. Form date change affects only the form. |
| User saves a manual entry while timer runs | Allowed. Manual entry saves normally, session unaffected. |

## 8. Implementation surface

### 8.1 New files

- `src/store/timer-store.ts` — Zustand store with `persist` middleware. Exposes:
  - `session: TimerSession | null`
  - `startTimer(snapshot)`, `pauseTimer()`, `resumeTimer()`, `stopTimer()`, `abortTimer()`, `applyTimerSession()`, `discardTimerSession()`
  - Subscribes to `BroadcastChannel('hours_tracker.timer')` for cross-tab sync.
- `src/ui/screens/log/TimerControl.tsx` — the ▶ / ⏸ / ■ / ✕ widget + live elapsed display. Embedded in `LogForm` next to Hours.
- `src/ui/screens/log/TimerBanner.tsx` — the pre-load banner that renders above the form when a stopped session exists.
- `src/store/timer-session.ts` — pure helpers (elapsed derivation, ms → hundredths conversion, snapshot construction). Fully unit-tested.

### 8.2 Modified files

- `schemas/entries.schema.json` — bump `schema_version` const to `3`, replace `source_event_id` with `source_ref`.
- `src/schema/types.ts` — add `SourceRef` type, replace `source_event_id` on `Entry`.
- `src/schema/validators.ts` — accept v1 / v2 / v3; backfill `source_ref` on read; add `source_ref` AJV validator.
- `src/data/entries-repo.ts` (or wherever `writer.ts` lives) — upgrade v1 / v2 file to v3 on any mixed write; commit-message suffix `[schema v1→v3]` or `[schema v2→v3]`; hash canonicalization per §4.3.
- `src/ui/screens/log/form-helpers.ts` — `FormState.source_ref` replaces `source_event_id`; `buildEntry` passes through.
- `src/ui/screens/log/LogForm.tsx` — embed `TimerControl`; disable Hours input + chips while timer non-Idle.
- `src/ui/screens/QuickLog.tsx` — render `TimerBanner`; wire `applyTimerSession` to form state; integrate with existing `applySuggestion` + `clearPrefill`.
- `tests/fixtures/2026-03-golden.json` / `2026-03-expected.json` — **unchanged**. Hash invariance must hold.

### 8.3 Commit-message conventions

Per `src/data/commit-messages.ts`:

- Entries written from a timer session use the normal `log:` prefix. The `source_ref` field is payload, not metadata.
- Schema-upgrading writes append `[schema v2→v3]` or `[schema v1→v3]` to the commit subject (same pattern as v1→v2).

## 9. Testing strategy

All tests follow the CLAUDE.md conventions: full-sentence test names, unit + property + schema + integration coverage.

### 9.1 Unit

- `timer-session.ts` pure helpers:
  - `liveElapsedMs` returns 0 for Idle, `base_elapsed_ms + delta` for Running, `elapsed_ms` for Paused/Stopped.
  - `msToHundredths` uses banker's rounding; `3600000 → 100`, `1800000 → 50`, `18000 → 1` (36 s), `17999 → 0` (just under).
  - `snapshotFromForm` copies `{projectId, bucketId, description, date}`, nothing else.
  - State-machine transition tests: every (from, event) → expected (to, phase) pair.
- `timer-store.ts`:
  - `startTimer` when a session already exists is a no-op.
  - `pauseTimer` freezes live elapsed exactly.
  - `resumeTimer` restores live elapsed monotonically (no jumps forward or backward).
  - `abortTimer` clears persistence.
  - `applyTimerSession` produces the expected `Suggestion`-shaped payload.

### 9.2 Property (fast-check)

- **Monotonic elapsed.** For any arbitrary sequence of `start / pause / resume / stop`, live elapsed at any point in time after `start` is ≥ live elapsed at any earlier point.
- **Snapshot immutability.** For any arbitrary form-mutation sequence during a Running session, `session.snapshot` is byte-identical to the snapshot at `startTimer` time.
- **Round-trip persistence.** For any arbitrary session state, serialize → parse → serialize yields the same bytes.
- **Hash invariance.** For any arbitrary entry set that previously hashed to `H` under v2 canonicalization, the same set upgraded to v3 (with matching `source_ref` values) hashes to `H` under v3 canonicalization.

### 9.3 Schema

- Validator accepts v1 files with no `source_event_id` and no `source_ref`.
- Validator accepts v2 files with `source_event_id` present or null.
- Validator accepts v3 files with `source_ref` in any of its three forms.
- Validator rejects v3 files with both `source_event_id` (legacy) and `source_ref` (new) present.
- Validator rejects `source_ref` with unknown `kind`.
- Backfill produces the correct v3 in-memory shape for each legacy version.

### 9.4 Golden (regression)

- `npm run test:golden` passes **unchanged** after this feature lands. March 2026 totals, source hash, and snapshot immutability all hold.

### 9.5 Integration

- Start timer, reload page mid-run, observe continued running state with correct elapsed.
- Start timer in tab A, observe running state appear in tab B via `BroadcastChannel`.
- Start with snapshot `{project: 'sector-growth', bucket: 'discovery'}`, mid-run change form project to `'acme'`, stop, Load — verify entry project is `'sector-growth'` (snapshot wins).
- Stop timer, reload, verify banner reappears.
- Complete end-to-end: start → stop → Load → save → verify committed entry has `source_ref: { kind: 'timer', id: <session id> }`.

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Schema v3 breaks a historical snapshot's hash | §4.3 canonicalization is exhaustively tested against the March 2026 fixture. Gate A re-dispatch required per CLAUDE.md before merging. |
| Users confused by "snapshot wins over form edits" | Running state shows the snapshot fields read-only. Pre-load banner explicitly names the snapshot context. If feedback shows this is still confusing, phase 2 adds Option 3 (editable snapshot mid-run). |
| Background tab time-drift | Wall-clock math sidesteps tick throttling. Validated by property test: elapsed = stop_wall − start_wall − paused_total. |
| localStorage quota exceeded | Timer state is tiny (<1 KB). No realistic quota pressure. If ever quota-full: fall back to in-memory only, surface a banner that running timer won't survive reload. |
| User forgets a running timer for days | Soft 12h warning; 24h clip. No hard auto-stop in v1 — trust the user, surface the signal. |
| `BroadcastChannel` not supported (older Safari) | Graceful degradation: fall back to `storage` event polling. Same-tab behavior unaffected. |

## 11. Phase 2 (deferred, but worth noting)

Things we deliberately did not build in v1 that we'd revisit based on usage:

- Header-pill cross-page running indicator.
- Editable snapshot mid-run (Option 3 from brainstorm).
- Keyboard shortcut (`⌘T` or similar) to start/stop the timer from any screen.
- Timer history view: list of recent stopped-then-loaded-or-discarded sessions.
- Auto-stop on prolonged idle (requires activity-tracking infrastructure from the parked design note in `docs/superpowers/research/2026-04-14-feature-research.md §8.5`).
- Cross-device sync via the activity-tracking backend (requires the same infrastructure).

## 12. Rollout

- Behind no feature flag — this is small and well-isolated.
- Schema v3 upgrade happens on first write after deploy. Users with only read activity stay on v2 on disk.
- The March 2026 golden fixture is the acceptance gate. If it drifts by a single byte, don't ship.
