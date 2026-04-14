# Log-screen redesign + Google Calendar integration — design

Spec for combined Phase B + C work. Phase A (near-term backlog) shipped 2026-04-14 as commit `1ab53e9`.

## 1. Purpose

Turn the Log screen into a two-column workspace: the familiar form on the left, a live column of calendar suggestions on the right. Clicking a suggestion **prefills** the form with date, duration, and a description — the user still picks project/bucket/status/rate and saves. Accepted events carry their calendar event id into the saved entry, so reopening the same date surfaces a persistent "✓ logged" marker that survives reloads and device switches.

This spec covers two things that ship together because they are mutually useless apart:

- the UI restructuring (2-col layout, date-field moved to top)
- the calendar data source + auth

## 2. Non-goals

- Auto-mapping event titles to projects. The user always picks.
- Writing back to Google Calendar. Read-only, always.
- Support for providers other than Google in this spec. We design an interface that would accommodate Outlook/ICS later, but we ship only Google.
- Offline capture of calendar events. Suggestions fetch live from Google whenever a date changes. No local cache beyond react-query's 2-minute stale time.
- Project-keyword rules, ML matching, attendee-based inference, or any other "smart" suggestion routing.

## 3. Architecture decisions (locked from brainstorming)

| # | Decision | Rationale |
|---|---|---|
| 1 | Google Calendar only, concrete integration | YAGNI — abstracting before a second provider is real is speculative. Interface lives in code, one impl. |
| 2 | Browser-only OAuth via Google Identity Services (GIS) token flow | Matches the app's no-backend constraint. Access tokens only; no refresh tokens needed because silent re-auth works while the user is signed in to Google. |
| 3 | `calendar.readonly` scope | Minimum necessary. Read-only. |
| 4 | One shared Google Cloud Web Client ID, committed to the repo | Web client IDs are not secret. A per-user setup would be hostile. Consent screen runs in Testing mode (≤100 users, no verification). |
| 5 | Multi-calendar (all readable calendars, user-selected subset) | Primary-only misses shared team calendars that consultants actually care about. Checkbox list in Settings. |
| 6 | Click prefills form (not one-click log) | Per explicit user feedback: prefills hours from event duration and description from event title; user still completes project/bucket/status/rate. |
| 7 | Persist dedupe via new `source_event_id` field on Entry | One nullable string. Schema bump 1→2. The lightest change that gives real cross-reload dedupe. |
| 8 | Show all events except declined and all-day | Defaults that respect the user's time. No Settings toggles until evidence of need. |
| 9 | Round suggested hours to nearest 15 min (25 hundredths) | Matches existing hours-chips UX. Meetings usually land on 15-min grid. |
| 10 | Fetch only the selected date, react-query cache with 2-min stale time | Simple. Each date nav = one `events.list` per enabled calendar. Cache makes flipping back instant. |
| 11 | Calendar setup lives in Settings; Log-screen right column shows a persistent CTA until connected | Two entry points: Settings is canonical, Log-screen CTA is discoverable. |

## 4. Data model changes

### 4.1 Entry schema bump 1 → 2

Add one optional nullable field to `schemas/entries.schema.json` and `src/schema/types.ts`:

```ts
type Entry = {
  // ... existing fields unchanged
  source_event_id: string | null;
};
```

Rules:

- **Write path:** every new entry written after this change has an explicit `source_event_id`. Manual entries (form-only, no calendar prefill) write `null`. Calendar-prefilled entries write the event's Google Calendar id (the `id` field returned by `events.list`).
- **Read path:** `validators.ts` accepts both `schema_version: 1` and `schema_version: 2`. When a v1 record is read, the validator fills `source_event_id: null` in-memory before returning. The file on disk is not touched by a read.
- **Mixed writes upgrade:** the first write that changes a v1 month file upgrades the whole file to `schema_version: 2`. Entries already in that file get `source_event_id: null` backfilled. The commit message for the upgrade-touching write includes a `[schema v1→v2]` suffix.
- **Historical files stay v1 on disk** until something writes them. March 2026 entries (`data/entries/2026-03.json`) remain v1 — this is required by the snapshot-immutability invariant (spec §5.6).
- **Hash invariance.** `canonicalizeEntriesForHashing` treats `source_event_id: null` identically to a missing field. A non-null value participates in the hash. This preserves the March 2026 golden fixture unchanged — its hash does not move, its expected totals do not move, `npm run test:golden` keeps passing.

### 4.2 New config file — `config/calendar.json` (in the data repo)

```json
{
  "schema_version": 1,
  "provider": "google",
  "enabled_calendars": ["primary", "prash@sapienex.com"],
  "last_connected_at": "2026-04-14T14:22:00Z"
}
```

Stores the user's per-device-stable calendar preferences. **Never** contains credentials — those stay in localStorage. New JSON schema `schemas/calendar-config.schema.json` and a validator pair matching the existing pattern.

`enabled_calendars` is a list of Google Calendar ids. `"primary"` is a special alias Google itself accepts, referring to the user's primary calendar (email address).

## 5. Auth

### 5.1 Library — Google Identity Services (GIS)

Loaded in `index.html`:

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

All interaction goes through `google.accounts.oauth2.initTokenClient`. The older `gapi.auth2` is deprecated.

### 5.2 Flow — Token Model (implicit-flow replacement)

We ask for an access token; Google returns one valid for approximately one hour. There is **no refresh token** — in a browser-only app there is nowhere safe to store one. When a token expires, we call the same token client with `prompt: ''`; Google silently returns a fresh token if the user is still signed in, otherwise it shows the consent dialog.

### 5.3 Scope — `https://www.googleapis.com/auth/calendar.readonly`

That is the only scope we request. The consent screen tells the user we read their calendars and nothing else. We never pass a write scope.

### 5.4 Shared Web Client ID

One OAuth 2.0 Web Client lives in a Google Cloud project owned by SapienEx. The client ID is committed to the app as a constant:

```
src/integrations/google/client-id.ts
```

Web client IDs are public by design (they identify the app to Google; the origin allow-list is what actually authorizes the redirect). **Authorized origins** on the client:

- `https://sapienex-ai.github.io`
- `http://localhost:5173`
- `http://localhost:5174`

New ports or custom domains require an origin to be added to the Google Cloud console.

### 5.5 Consent screen — Testing mode

The OAuth consent screen is published in **Testing** state. This supports up to 100 users without verification, which is the right fit for a consultant-internal tool. Users seen in testing mode must be added to the "Test users" list in the Google Cloud console, by email. If we ever need to support more than 100 users, we publish and go through verification.

### 5.6 Token storage — localStorage key `hours-tracker.google-token`

```ts
type StoredGoogleToken = {
  access_token: string;
  expires_at: number; // epoch ms
};
```

Isolated from the GitHub PAT key (`hours-tracker.pat`). Cleared on Disconnect, token revoke, or manual storage clear. Never sent anywhere except `https://www.googleapis.com/...`.

### 5.7 Refresh strategy

Lazy, at API-call time. Pseudocode:

```ts
async function getValidToken() {
  const stored = readStoredToken();
  if (stored && stored.expires_at > Date.now() + 60_000) return stored.access_token;
  return requestNewToken({ prompt: '' }); // silent if possible
}
```

If `prompt: ''` fails (session expired, user revoked), we fall back to an explicit prompt with a user-visible "Reconnect calendar" button. No silent background refresh loop.

### 5.8 Provider abstraction

Even though we ship only Google, a small interface in `src/integrations/calendar/provider.ts`:

```ts
export type CalendarProvider = {
  id: 'google';
  listCalendars(): Promise<CalendarInfo[]>;
  listEvents(args: { calendarId: string; timeMin: string; timeMax: string }): Promise<CalendarEvent[]>;
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
};
```

Keeps the door open for Outlook/ICS without paying much upfront cost.

## 6. UX

### 6.1 Log screen (§8.2 in the base spec — this supersedes the single-column version)

Desktop (`min-width: 1024px`) layout:

```
┌──────────────────────────────────────────────────────────────────┐
│  Log hours                                                       │
├────────────────────────────────┬─────────────────────────────────┤
│  Date        [2026-04-14]      │  Suggested from calendar        │
│  Project     [— select —]      │  ┌───────────────────────────┐  │
│  Hours       [       ]  chips  │  │ 09:00–09:30  0.50h        │  │
│  Bucket      [— none —]        │  │ Sprosty standup           │  │
│  Status      ○ bill ○ non ○    │  │ ✓ logged                  │  │
│  Rate        [       ]         │  └───────────────────────────┘  │
│  Description [          ]      │  ┌───────────────────────────┐  │
│                                │  │ 10:30–11:15  0.75h        │  │
│  [ Save (⌘↵) ]                 │  │ HS config review          │  │
│                                │  └───────────────────────────┘  │
└────────────────────────────────┴─────────────────────────────────┘
```

Narrower viewports: stacks vertically, suggestions below form. Implemented with Tailwind `flex flex-col lg:flex-row`.

**Field order (left column):** `Date → Project → Hours → Bucket → Status → Rate → Description → Save`. Date moves to the top.

**Column widths (desktop):** form column `flex-1 max-w-[480px]`, suggestions column `w-[380px] shrink-0`, `gap-6`.

### 6.2 Suggestion card

```
┌─────────────────────────────────┐
│  09:00–09:30         0.50h      │  ← time range + rounded duration
│  Sprosty standup                 │  ← event title (truncates at 2 lines)
│  prash@sapienex.com              │  ← source calendar name (if >1 enabled)
│  ✓ logged                        │  ← present only when already logged
└─────────────────────────────────┘
```

Behaviors:

- **Hover:** card lightens (`hover:bg-white/50`). Cursor pointer.
- **Click:** prefill the left form. `date` already matches (we're viewing this date). `hours_hundredths` = rounded event duration. `description` = event title. `source_event_id` = the event's id. The form's `projectId`, `bucketId`, `status`, `rate` are left unchanged from their current values so the user sees what they still need to pick.
- **Last-click-wins:** clicking a second card overwrites the prefill. A "prefilled from *HS config review*" hint appears below the Description field with a "clear" link.
- **Already-logged card click:** still prefills. The user may want to log additional time against the same event under a different project. They lose the `✓ logged` marker until they save.

### 6.3 Right-column states

- **Not connected:** single CTA card — "Connect Google Calendar to see suggestions" + Connect button. Persistent — stays visible on every Log visit until the user connects. A small "Set up in Settings →" link underneath.
- **Connected, loading:** three skeleton cards.
- **Connected, no events:** "No calendar events on this date."
- **Connected, events present:** cards, sorted by start time.
- **Token expired / revoked:** error banner "Calendar access expired" + Reconnect button. Doesn't block manual logging.
- **Network failure:** "Couldn't load events." + Retry.

### 6.4 Settings screen additions

New section — **Calendar integration**:

```
Calendar integration
  Google Calendar                      [ Connected · prash@... ] [Disconnect]
  Calendars to include
    [x] prash@sapienex.com (primary)
    [x] Sprosty shared
    [ ] Holidays in Canada
    [ ] Birthdays
  Last connected: 2026-04-14 10:22 AM
```

- Connect / Disconnect buttons.
- Checkbox list of all calendars the user can read. Changes persist to `config/calendar.json`.
- Connected-as email read from the access token's `id_token` (or from a one-time `/userinfo` call at connect time).

## 7. Module layout

### 7.1 New modules

- `src/integrations/google/client-id.ts` — exports the public Google Web Client ID as a string constant. One-line module. Committed to the repo (web client IDs are not secret).
- `src/integrations/google/gis-client.ts` — wraps `google.accounts.oauth2.initTokenClient`. Owns token lifecycle. Exports `connect()`, `disconnect()`, `getAccessToken()`, `isConnected()`.
- `src/integrations/google/calendar-api.ts` — pure `fetch` wrappers: `listCalendars(token)`, `listEvents(token, { calendarId, timeMin, timeMax })`. Returns typed DTOs. Retries 401 once via silent re-token.
- `src/integrations/calendar/provider.ts` — the `CalendarProvider` interface and the Google implementation that bridges `calendar-api.ts` to it.
- `src/integrations/calendar/event-to-entry.ts` — pure `eventToFormState(event, roundingMinutes = 15)`. Filters declined + all-day here. Handles cross-midnight clip.
- `src/store/calendar-store.ts` — Zustand: connection state, enabled-calendars list, last-error.
- `src/data/calendar-config-repo.ts` — Octokit read/write of `config/calendar.json`.
- `src/data/hooks/use-calendar-events.ts` — react-query: fan-out to each enabled calendar for the selected date, merge, annotate with dedupe flag from current-month entries.
- `src/data/hooks/use-calendar-config.ts` — react-query for `config/calendar.json`.
- `src/ui/screens/log/SuggestionsPanel.tsx` — right-column container.
- `src/ui/screens/log/SuggestionCard.tsx` — one card.
- `src/ui/screens/settings/CalendarSection.tsx` — the Settings block.
- `schemas/calendar-config.schema.json` — validator for the new config file.

### 7.2 Modified files

- `schemas/entries.schema.json` — `source_event_id` added as `{ "type": ["string", "null"] }`, `schema_version` accepts both 1 and 2.
- `src/schema/types.ts` — add field to `Entry`, add `SCHEMA_VERSION_CURRENT = 2`.
- `src/schema/validators.ts` — accept v1 entries, backfill `source_event_id: null` in memory.
- `src/calc/hash.ts` — canonicalization explicitly omits `source_event_id` keys whose value is `null` so v1 and v2-with-null entries hash identically.
- `src/data/entries-repo.ts` — when writing to a v1 file, upgrade all entries + `schema_version` in the same transform. Commit message carries `[schema v1→v2]` on the upgrading write.
- `src/data/commit-messages.ts` — `logMessage` gains an optional `source?: 'calendar'` that appends `[calendar]` to the message.
- `src/ui/screens/QuickLog.tsx` — form accepts an imperative `prefillFromEvent(event)` method; tracks `source_event_id` in form state; top-of-form date; renders inside a left-column wrapper with `SuggestionsPanel` on the right.
- `src/ui/screens/Settings.tsx` — add the calendar section.
- `index.html` — add the GIS script tag.
- `docs/architecture/adding-a-field.md` — new migration playbook entry documenting the v1→v2 bump.
- `docs/architecture/google-calendar-setup.md` — **new** — one-time Google Cloud setup playbook.
- `tests/fixtures/2026-03-golden.json` — **unchanged**, used as regression guard.

### 7.3 Nothing we touch

- Calc totals (`src/calc/totals.ts`), rate resolution, bucket consumption, snapshot writer, snapshot-list drift detection, bulk rate update, existing CSV export.
- Partner config, partner theme.
- March 2026 golden fixture and expected totals.

## 8. Data flow — trace of a calendar-prefilled log

1. User is on **Log**, date picker shows `2026-04-14`. They have Google connected and two calendars enabled.
2. `useCalendarEvents('2026-04-14')` fires. Two parallel `events.list` calls under the hood (one per enabled calendar). `timeMin` = 2026-04-14T00:00 local, `timeMax` = 2026-04-14T23:59 local.
3. Results merge. Each event runs through `eventToFormState` which skips declined + all-day.
4. `useMonthEntries('2026-04')` is already cached from the Entries screen; its entries provide the `source_event_id` set used to mark each card.
5. `SuggestionsPanel` renders cards sorted by start time.
6. User clicks a card.
7. `QuickLog.prefillFromEvent(event)` sets `form.hoursHundredths`, `form.description`, `form.source_event_id`. Project / bucket / status / rate stay as-is.
8. User picks project = Sprosty, bucket = skyvia-dev. Rate auto-resolves. They hit Save.
9. `addEntry` builds an `Entry` including `source_event_id: event.id`. Validates against entries.schema.json v2. Commits with message `log: sprosty 2026-04-14 0.75h @ $125 (HS config review) [calendar]`.
10. `useMonthEntries` invalidates on success. `useCalendarEvents` re-derives its dedupe annotations → the clicked card now shows `✓ logged`.

## 9. Error handling — summary

| Failure mode | Visible behavior |
|---|---|
| Popup blocked on Connect | Banner: "Pop-ups blocked — allow pop-ups for `accounts.google.com`". Nothing persists. |
| User closes consent dialog | No-op. Connect button stays enabled. |
| User revokes access externally | Next `events.list` returns 401 → silent retry with `prompt: ''` → if that fails, clear stored token, show "Calendar disconnected — reconnect" in right column. |
| Network failure on events fetch | Right column shows retry. Manual logging unaffected. |
| `origin_mismatch` from Google | Surface Google's raw message — this is a developer-config error, not a user error. |
| Event with `start === end` | Event is skipped entirely (no zero-hour suggestion). |
| Event spans midnight | Clipped to selected date: suggested hours = minutes from start to local midnight, rounded. |
| Overlapping events | Both shown. User decides which to log. |
| Event with empty title | Card shows `(no title)`. Prefilled description is empty — user types one before saving. |
| Reading v1 file | Validator backfills `source_event_id: null` in memory. File not touched. |
| Writing new entry into v1 file | Upgrade to v2 in the same commit. All existing entries get `source_event_id: null`. Commit message suffix `[schema v1→v2]`. |
| Golden fixture hash drift | **Must not happen.** `canonicalizeEntriesForHashing` omits `null` `source_event_id` keys specifically to prevent this. A test in `tests/calc/hash-v2.test.ts` guards it. |

## 10. Testing expectations

### 10.1 Unit tests (pure)

- `tests/integrations/event-to-entry.test.ts`
  - happy path: 60-min event → 1.00h, description = title, source_event_id set
  - all-day event → filtered
  - declined event → filtered
  - cross-midnight event → clipped to selected date
  - empty title → `description === ''`, suggestion still renders
  - duration rounding: 52-min event → 1.00h (nearest 15 min), 7-min event → 0.25h
- `tests/schema/entry-v2-migration.test.ts`
  - v1 file without `source_event_id` parses; validator produces v2-shaped result with `null`
  - v2 file with explicit `source_event_id` parses unchanged
  - validator rejects a v2 file with wrong-typed `source_event_id` (e.g. number)
- `tests/calc/hash-v2.test.ts`
  - v1 entries hash identically before and after the change (guards against golden drift)
  - entries with `source_event_id: null` hash identically to entries missing the field
  - entries with `source_event_id: "abc"` hash differently from the above

### 10.2 Integration tests (mocked fetch)

- `tests/integrations/calendar-api.test.ts`
  - `listEvents` with a fixture response returns typed DTOs
  - 401 triggers a single silent re-token retry via an injected callback spy
  - non-401 errors propagate

### 10.3 Golden-file regression

- `npm run test:golden` passes unchanged. This is the critical guard.

### 10.4 Property tests

- `canonicalizeEntriesForHashing` stays deterministic across arbitrary mixes of v1 and v2 entries.
- Conservation invariants (`billable + non_billable + needs_review === total`) still hold with arbitrary `source_event_id` values.

### 10.5 Manual verification checklist

1. Connect flow (Settings) — consent screen appears, one-time.
2. Calendars list populates in Settings; checkboxes persist across reload.
3. Events appear on Log right column for today; time/title/duration correct.
4. Click card → form prefilled (date, hours, description, source_event_id carried through).
5. Save → entry appears in Entries. Commit message includes `[calendar]`.
6. Refetch suggestions for same date → `✓ logged` pill on the clicked card.
7. Disconnect in Settings → Log right column returns to CTA. localStorage cleared.
8. Reload after ~1 hr → first events fetch 401 → silent re-token → events show. No visible flash.
9. Revoke in Google Account settings → refresh → right column shows "Calendar disconnected — reconnect".
10. Log a manual (non-calendar) entry → `source_event_id: null`. No `[calendar]` suffix.

### 10.6 Not testing

- Browser-level E2E. Manual script + unit coverage is enough.
- GIS library internals — mocked at the API-fetch seam.

## 11. Dependencies and no-go rules

No new npm deps. Google Identity Services is loaded as a `<script>` from `accounts.google.com` — the official way. All `fetch` calls are plain `fetch`, no extra library.

Invariants still enforced exactly as in the base spec (§11):

- Integer-math-only for `_cents` / `_hundredths`. Calendar integration is read-only into Entry; the write path still goes through `src/calc/int.ts` helpers for rate and hours.
- Schema validation before every write — new `calendar.json` and the v2 Entry schema both validate.
- Structured commit messages — new `[calendar]` suffix documented in `src/data/commit-messages.ts`.
- Partner-first branding, SapienEx in footer only. Nothing in this spec affects that.
- Token (Google + GitHub) confined to `src/auth/` + `src/store/` + `src/integrations/google/`. No other module reads localStorage directly.

## 12. Known constraints

- **GIS silent-refresh requires an active Google session in the browser.** If the user is signed out of Google entirely, every token request shows the prompt. This is the price of having no refresh token.
- **Google Calendar API rate limits.** Default 500 QPS per project; way more than we need. A full Log visit that fetches 5 calendars is 5 requests. react-query caches for 2 minutes.
- **Consent-screen testing mode caps at 100 users.** If we cross that, we publish and go through verification.
- **Origin allow-list.** New deploy targets need the origin added in Google Cloud. Document in the setup playbook.

## 13. Resolved decisions

| # | Question | Resolution |
|---|---|---|
| 1 | Provider | Google Calendar only. |
| 2 | Auth | GIS token flow, `calendar.readonly`, shared Web Client ID. |
| 3 | Calendars to read | Multi-calendar, user-selected list in Settings. |
| 4 | Matching to projects | None. User picks project after prefill. |
| 5 | Dedupe | Persistent via new `source_event_id` on Entry. Schema bump 1→2. |
| 6 | Empty/connect state | Persistent CTA on Log right column + canonical toggle in Settings. |
| 7 | Event filtering | Skip declined, skip all-day, nothing else. |
| 8 | Rounding | Nearest 15 min (25 hundredths). |
| 9 | Fetch window | Selected date only, react-query 2-min stale. |

## 14. What this spec does NOT cover

- Google Cloud project provisioning — lives in `docs/architecture/google-calendar-setup.md` (created in the plan, not this spec).
- Retrospective backfill of `source_event_id` for March 2026 entries. Out of scope — v1 history stays v1 on disk.
- Outlook / ICS integration. Interface is designed to accommodate, no impl here.
- Offline queue. Unrelated; see backlog medium-term.

## 15. Sequencing

Implementation happens in one combined plan because the UI redesign is useless without the calendar data, and the calendar integration needs somewhere to render. Inside the plan, tasks are ordered so:

1. Schema bump + validator + hash guards land first (everything else depends on it).
2. Google auth + `calendar-api.ts` next (the data source).
3. UI integration last (Suggestions panel, form prefill, Settings section).

That way each task leaves the repo in a green, committable state.
