# Effort source integrations — design

Spec for automatically capturing effort signals from Slack, Gmail, and Calendar (extended beyond meetings) into the existing Entry model. Introduces a common `EffortSourceAdapter` interface that the current Google Calendar integration is refactored onto, plus two new concrete adapters.

## 1. Purpose

Effort tracking v0 (shipped 2026-04-14) added `effort_kind` + `effort_count` to the Entry schema, with the expectation that every entry is logged manually. For a HubSpot lead generating 20–40 Slack threads, 5–10 sent emails, and 2–4 meetings per day, manual logging has a poor capture rate — the activities are too granular to be worth a Log form per item, and too numerous to remember at end-of-day.

This spec auto-captures those activities, groups them into a small daily digest, and lets the user confirm the whole day in a handful of clicks. Each accepted digest row becomes exactly one Entry with `effort_kind` + `effort_count` set and `hours_hundredths` pre-filled from a per-kind heuristic.

**Primary user:** HubSpot leads whose day is dominated by client_async (Slack/email) and meeting activity. Effort v0 made those loggable; this spec makes them capturable at scale.

**Secondary user:** hourly consultants, who gain a low-friction way to tag their meetings and comms. Their existing hours-first workflow is untouched when they disable all integrations.

## 2. Non-goals

- **No Outlook / Microsoft Graph email adapter.** Gmail only in v1 (shares the Google Cloud project that calendar already uses). Outlook mirrors the Gmail pattern once the adapter interface is stable.
- **No Jira / Linear / Zendesk / Intercom.** Each deserves its own spec → plan → implementation cycle.
- **No AI classification of ambiguous rows.** User picks the kind and project when rules don't match. Deferred until there's signal to train on.
- **No per-thread drill-down UI in v1.** Digest rows show counts only. `DigestRow.items[]` is retained in memory for a future drill-down feature but not surfaced in v1.
- **No first-class form UI for `integrations.json`.** v1 ships a read-write JSON editor in Settings. Form UI deferred.
- **No multi-workspace Slack per consultant in v1.** One workspace per consultant. Multi-workspace mirrors the calendar multi-calendar pattern in a follow-up.
- **No historical backfill.** Users who install the feature today only see today-forward activity. A "scan last 30 days" tool is deferred.
- **No background / scheduled refresh.** Adapters fetch on Log-screen mount only, matching calendar today. No Service Workers, no crons.
- **No Cloudflare Worker for Slack OAuth code exchange in v1.** Slack uses a BYO bot-token flow mirroring the existing GitHub PAT pattern. Worker-backed OAuth is a parked backlog item.
- **No silent background writes.** Every source-generated entry flows through the digest panel's per-row Accept. No auto-log.
- **No `partner.integrations_enabled` kill switch.** Partners who don't want integrations enabled can simply not deploy an `integrations.json` to their consultants' data repos.

## 3. Architecture decisions (locked from brainstorming)

| # | Decision | Why |
|---|---|---|
| 1 | Daily digest, not per-activity suggestions | 30+ per-thread cards would drown the Assist panel; a bulk-review digest matches how HubSpot leads actually think about their day. |
| 2 | Direction-based classification (client / internal / ambiguous) | The adapter does the easy classification (channel prefix, email domain, attendee list); the user picks when rules don't match. Matches user mental model without requiring heavy per-project config. |
| 3 | One Entry per digest row, user-confirmed hours | Respects invariant 8 (`hours_hundredths ≥ 1`) without contortion. `effort_count` captures objective volume; `hours_hundredths` captures subjective duration. |
| 4 | Heuristic hours pre-fill from per-kind constants | Slack=2 min/thread client, 1 min/thread internal; Email=3/1; Calendar=actual duration. User overrides. Not configurable in v1. |
| 5 | Single v1 spec covering interface + all three sources | Three concrete implementations validate the interface in one pass; splitting into sub-phases delays value. |
| 6 | Schema bump v4 → v5 | Additive enum widening of `source_ref.kind` is semantically a schema change. Per CLAUDE.md, schema changes stop-and-ask; user approved. Migration is trivial (no backfills). |
| 7 | Slack uses BYO bot-token (GitHub PAT-style) in v1 | Preserves the "pure-static GitHub Pages app" principle. Cloudflare Worker OAuth exchange is a backlog item. |
| 8 | Gmail reuses Google Cloud project + adds `gmail.readonly` scope | Same client ID, same token key, same TokenProvider — users re-consent once. |
| 9 | Calendar-extended keeps per-event rows for substantive events | Events ≥ 30 min or classified as `workshop` / `client_training` stay individually actionable. Short meetings batch into one row. |
| 10 | `DigestRow` is memory-only | Only the produced Entry persists. Rehydration on next Log mount re-fetches from sources. Keeps the data model clean. |

## 4. Data model

### 4.1 Entry schema bump v4 → v5

`schemas/entries.schema.json`:

- Title: `"Monthly entries file (v5)"`
- `schema_version` enum: `[1, 2, 3, 4, 5]`
- `source_ref.kind` enum: `["calendar", "timer", "slack", "gmail"]`

No changes to any other field. Additive enum widening only. No entry-level backfill.

**Writer upgrade path** (extends the existing chain in `src/data/entries-repo.ts`):

| File's `schema_version` | Writer behavior |
|---|---|
| `1` | Upgrade to v5; commit suffix `[schema v1→v5]`. |
| `2` | Upgrade to v5; commit suffix `[schema v2→v5]`. |
| `3` | Upgrade to v5; commit suffix `[schema v3→v5]`. |
| `4` | Upgrade to v5; commit suffix `[schema v4→v5]`. |
| `5` | No suffix. |

Reader behavior: validator accepts all of v1/v2/v3/v4/v5 on the wire; returned shape is always v5.

### 4.2 New `source_ref` kinds

| kind | `id` shape | Example |
|---|---|---|
| `slack` | `daily:YYYY-MM-DD:<direction>:<workspace-id>:<project-id>` | `daily:2026-04-15:client:T012AB:acme` |
| `gmail` | `daily:YYYY-MM-DD:<direction>:<project-id>` | `daily:2026-04-15:client:acme` |
| `calendar` | unchanged — event id for individual events; for short-meeting batches: `daily:YYYY-MM-DD:short-meetings:<project-id>` | — |

Dedupe guarantee: `addEntry` already refuses any entry whose `source_ref` matches an existing row in the month file. This stops double-accepting the same digest row.

### 4.3 New `config/integrations.json`

Lives in the consultant's data repo. Validated via new `schemas/integrations.schema.json`.

```jsonc
{
  "schema_version": 1,
  "slack": {
    "enabled": true,
    "workspaces": [
      { "id": "T012AB", "name": "Acme Workspace" }
    ],
    "client_channel_prefixes": ["#client-", "#acme-"],
    "internal_channel_prefixes": ["#team-", "#internal-"],
    "project_by_workspace": { "T012AB": "acme" },
    "project_by_channel_prefix": { "#acme-": "acme" }
  },
  "gmail": {
    "enabled": true,
    "client_domains": ["acme.com", "bigco.com"],
    "internal_domains": ["sapienex.com"],
    "project_by_domain": { "acme.com": "acme", "bigco.com": "bigco" }
  },
  "calendar": {
    "workshop_min_duration_minutes": 120,
    "client_training_title_keywords": ["training", "workshop", "enablement"],
    "internal_only_attendee_domains": ["sapienex.com"]
  }
}
```

All fields optional. Missing source → disabled. Empty classifier lists → every row falls to `direction: 'ambiguous'`.

### 4.4 `DigestRow` (memory-only)

```ts
export type SourceKind = 'calendar' | 'slack' | 'gmail';
export type DigestDirection = 'client' | 'internal' | 'ambiguous';

export interface DigestItem {
  timestamp: string;     // ISO
  label: string;         // "Re: Acme onboarding" or "Meeting: Acme sync"
  externalId: string;    // Slack thread_ts / Gmail thread id / calendar event id
}

export interface DigestRow {
  source: SourceKind;
  direction: DigestDirection;
  count: number;
  heuristicHoursHundredths: number;
  suggestedKind: EffortKind;
  suggestedProjectId: string | null;    // null → user must pick
  batchId: string;                        // becomes source_ref.id
  items: DigestItem[];                    // retained for future drill-down
  label: string;                          // "Slack → Acme (12 threads)"
}
```

`DigestRow` never hits disk. Only the produced Entry persists, with `batchId` in `source_ref.id` for audit + dedupe.

## 5. Auth

### 5.1 Calendar — unchanged

Refactored into `src/integrations/adapters/calendar-adapter.ts`. OAuth path identical to today: Google Cloud project `hours-tracker`, client ID in `src/integrations/google/client-id.ts`, scope `.../auth/calendar.readonly`, token at `hours-tracker.google-token`.

### 5.2 Gmail — extends Google auth

Two console steps in the existing Google Cloud project:

1. Add `https://www.googleapis.com/auth/gmail.readonly` to the OAuth consent screen scopes.
2. No new credentials; the existing Web client handles both scopes.

Runtime behavior: users who previously consented to calendar-only get a fresh consent prompt the first time a Gmail scope is requested. GIS handles this with `prompt: 'consent'` on the re-request. Token is stored under the same `hours-tracker.google-token` key, now carrying both scopes.

### 5.3 Slack — BYO bot token (GitHub PAT pattern)

SapienEx-owned Slack app named **Hours Tracker**. Read-only bot scopes:

| Scope | Why |
|---|---|
| `channels:history` | Public channel messages |
| `groups:history` | Private channel messages (where the bot is added) |
| `im:history` | Direct messages |
| `users:read` | Resolve user ids → emails for domain-based classification |

Flow in v1:

1. Consultant is given (or self-installs) the Hours Tracker Slack app to their workspace.
2. They copy the bot token from Slack's admin UI (format `xoxb-...`).
3. They paste it into Settings → Integrations → Slack.
4. App stores the token + workspace id in localStorage under `hours-tracker.slack-token` and `hours-tracker.slack-workspace`.
5. All Slack API calls authenticate with this bearer token.

A "Create the app" link in the Slack connect modal deep-links to Slack's admin UI with the scope list pre-filled.

**Not in v1:** a Cloudflare Worker that would hold `client_secret` and do a proper OAuth code exchange. Deferred per Section 3 decision 7.

### 5.4 Token storage keys

| Key | Purpose |
|---|---|
| `hours-tracker.google-token` | Google scope bundle (calendar + gmail) |
| `hours-tracker.slack-token` | Slack bot token |
| `hours-tracker.slack-workspace` | Slack workspace id (single workspace in v1) |

All go through the existing `src/auth/` TokenProvider abstraction.

## 6. Classification rules

Every fetched activity maps to one of `{ client, internal, ambiguous }`. Only confident directions get a `suggestedKind`; ambiguous rows force user picks.

### 6.1 Slack

**Channel messages:**

- Channel name has a prefix in `slack.client_channel_prefixes[]` → `client`, `suggestedKind: 'slack'`.
- Channel name has a prefix in `slack.internal_channel_prefixes[]` → `internal`, `suggestedKind: 'internal_sync'`.
- Neither → `ambiguous`.

**Direct messages:**

- Any DM participant's email domain in `gmail.client_domains[]` → `client`, `suggestedKind: 'slack'`.
- All DM participants' email domains in `gmail.internal_domains[]` → `internal`, `suggestedKind: 'internal_sync'`.
- Else → `ambiguous`.

Slack DM classification intentionally reuses `gmail.client_domains` / `gmail.internal_domains` as the single source of truth for "who counts as a client domain." Consultants edit one list instead of two.

**Count rule:** one activity per `thread_ts`, not per message. Dedupe threads inside the adapter before emitting rows. A thread with 8 replies = 1 activity.

### 6.2 Gmail

**Source:** sent folder only (`in:sent newer_than:1d`). Received mail is not counted as effort.

- Any recipient (To or CC) domain in `gmail.client_domains[]` → `client`, `suggestedKind: 'email'`.
- All recipient domains in `gmail.internal_domains[]` → `internal`, `suggestedKind: 'internal_sync'`.
- Else → `ambiguous`, `suggestedKind: 'email'`.

**Count rule:** one activity per Gmail thread id. Replying four times to the same thread = 1 activity.

### 6.3 Calendar (extended beyond `meeting`)

Per event, evaluate in priority order:

1. Title matches any `calendar.client_training_title_keywords[]` (case-insensitive) AND at least one attendee has a non-internal domain → `client`, `suggestedKind: 'client_training'`.
2. Duration ≥ `calendar.workshop_min_duration_minutes` AND at least one attendee has a non-internal domain → `client`, `suggestedKind: 'workshop'`.
3. Every attendee domain is in `calendar.internal_only_attendee_domains[]` → `internal`, `suggestedKind: 'internal_sync'`.
4. Else → `client`, `suggestedKind: 'meeting'`. Preserves v0 calendar default.

**Count rule:** one activity per event (unchanged from v0).

### 6.4 Project attribution — `suggestedProjectId`

Evaluated per source, first match wins; no match → `null`.

- **Slack (channel):** `slack.project_by_channel_prefix[matching prefix]` → else `slack.project_by_workspace[workspace id]` → else null.
- **Slack (DM):** `slack.project_by_workspace[workspace id]` → else null.
- **Gmail:** first recipient domain found in `gmail.project_by_domain[]` → else null.
- **Calendar:** existing attendee-domain → project heuristic in `src/integrations/calendar/event-to-entry.ts` (unchanged).

### 6.5 Ambiguous handling

Ambiguous rows render as a separate bottom group in the digest. User must pick project AND kind before Accept enables. No defaults. Prevents silent misclassification.

## 7. Heuristic duration pre-fills

Hard-coded constants in `src/integrations/heuristics.ts`:

| Source + direction | Minutes per unit |
|---|---|
| Slack — client | 2 per thread |
| Slack — internal | 1 per thread |
| Email — client | 3 per thread |
| Email — internal | 1 per thread |
| Calendar (any kind) | actual event duration |

Formula:

```ts
export function heuristicHoursHundredths(
  minutesPerUnit: number,
  count: number,
): number {
  return Math.max(1, Math.round((minutesPerUnit * count * 100) / 60));
}
```

Minimum `1` preserves invariant 8 (`hours_hundredths ≥ 1`).

User overrides via per-row number input in the digest. Not persisted beyond the digest; each Log-screen mount re-computes from fresh adapter data.

## 8. UX

### 8.1 Log screen — digest panel

Replaces today's `SuggestionCard` in the right column.

```
┌─ Today's activity ──────────────────────────┐
│ CLIENT                                      │
│ ─ Workshop: Acme enablement (90m)  1.50h [Accept]
│ ─ Slack → Acme (12 threads)        0.40h [Accept]
│ ─ Email → Acme (3 threads)         0.15h [Accept]
│                                             │
│ INTERNAL                                    │
│ ─ Slack internal (11 threads)      0.18h [Accept]
│                                             │
│ AMBIGUOUS — pick project + kind             │
│ ─ 2 unmatched Slack threads        0.03h [Accept]
│                                             │
│                   [ Accept all confident ]  │
└─────────────────────────────────────────────┘
```

Rows render in three groups: CLIENT, INTERNAL, AMBIGUOUS. Within a group, sort by source (calendar first, then slack, then gmail), then by descending hours.

Ambiguous rows render project and kind as red-outlined required pickers. Accept disabled until both are set.

Below the digest: collapsed "Individual calendar events" section containing the legacy per-event `SuggestionCard` flow. Preserves current UX for users who prefer single-meeting prefill.

### 8.2 Calendar batching rule

Short meetings collapse; substantive events stay individually actionable.

- Events with `suggestedKind` ∈ `{ workshop, client_training }` → always their own digest row with the event title as label, regardless of duration.
- All other events with duration ≥ 30 min → their own digest row with the event title as label.
- All other events with duration < 30 min → batched into a single `"Calendar → short meetings: N"` row per direction (one client row, one internal row).

### 8.3 Accept flow

- **Per-row Accept:** row disappears with a 5-second undo toast; in the background, `addEntry` runs with the built Entry.
- **"Accept all confident" button:** skips ambiguous rows, fires `Promise.all` of `addEntry` calls. Per-row failures surface as inline red banners; failed rows reappear in the digest.
- **Undo (5 s):** clicking Undo in the toast calls `deleteEntry` on the just-created Entry id.

### 8.4 States

- **Loading:** skeleton rows while adapters are fetching in parallel.
- **Empty:** "No activity captured today" with Connect buttons for any unconnected enabled source.
- **Per-source error:** inline yellow banner on that source's rows ("Slack failed to fetch — token expired"). Other sources still render.
- **Source disabled:** not rendered at all; no upsell nag.

### 8.5 Settings — Integrations section

New section on the Settings screen, below the existing Calendar card.

- **Calendar:** existing Connect/Disconnect card, reused.
- **Gmail:** Connect button fires GIS scope-request including `gmail.readonly`. If the user previously consented only to calendar, a fresh consent prompt appears.
- **Slack:** "Connect Slack workspace" opens a modal with:
  - Workspace name text input
  - Bot token (`xoxb-...`) password input
  - "Create the Hours Tracker app" link (deep-link into Slack's admin UI with the scope list pre-filled)
  - Save button (validates token by calling `auth.test` before persisting)
- **Integrations config editor:** a read-write textarea of `integrations.json`, with validation against the new schema on Save. First-class form UI for individual fields is deferred.

### 8.6 Mobile

Below `lg` breakpoint, the digest panel stacks under the Log form. Consistent with today's calendar panel behavior.

## 9. Module layout

### 9.1 New modules

```
src/integrations/
├── adapters/
│   ├── types.ts                  EffortSourceAdapter, DigestRow, DigestItem, SourceKind, DigestDirection
│   ├── calendar-adapter.ts       wraps existing src/integrations/calendar/* code
│   ├── gmail-adapter.ts          Gmail-specific fetchDailyDigest
│   ├── slack-adapter.ts          Slack-specific fetchDailyDigest
│   └── enabled-adapters.ts       getEnabledAdapters(integrationsConfig): EffortSourceAdapter[]
├── heuristics.ts                 MINUTES_PER_UNIT + heuristicHoursHundredths()
├── classification/
│   ├── slack.ts                  classifySlackActivity(activity, config): { direction, suggestedKind, suggestedProjectId }
│   ├── gmail.ts                  classifyGmailThread(thread, config): { direction, suggestedKind, suggestedProjectId }
│   └── calendar.ts               classifyCalendarEvent(event, config): { direction, suggestedKind, suggestedProjectId }
├── slack/
│   ├── client.ts                 Slack Web API wrapper (fetch, pagination, rate-limit)
│   └── auth.ts                   BYO bot-token validation + TokenProvider integration
└── google/
    ├── calendar-api.ts           (existing, unchanged)
    ├── gis-client.ts             (existing, extended for gmail scope)
    ├── client-id.ts              (existing, unchanged)
    └── gmail-api.ts              Gmail API wrapper (sent-folder query, thread grouping)
```

### 9.2 Modified files

- `src/ui/screens/QuickLog.tsx` — replace `SuggestionCard` wiring with `DigestPanel`; preserve `SuggestionCard` inside collapsed "Individual calendar events" fallback.
- `src/ui/screens/log/DigestPanel.tsx` — new. Composes and renders the digest.
- `src/ui/screens/log/DigestRow.tsx` — new. Renders a single row with per-row Accept.
- `src/ui/screens/Settings.tsx` — add Integrations section (new subcomponent).
- `src/ui/screens/settings/IntegrationsSection.tsx` — new. Per-source connect cards + config editor.
- `src/schema/types.ts` — `EntriesFile.schema_version` union gains `5`; `SourceRef.kind` union gains `'slack' | 'gmail'`; new `IntegrationsConfig` type.
- `src/schema/validators.ts` — accept v5; v5 is canonical returned shape; update JSDoc.
- `schemas/entries.schema.json` — v5 bump.
- `schemas/integrations.schema.json` — new.
- `src/data/entries-repo.ts` — `upgradeEntriesFileToV5`; suffix logic extends to v5.
- `src/data/integrations-repo.ts` — new. Load/save `config/integrations.json` via GitHub.
- `src/data/commit-messages.ts` — new `integrationsMessage()` helper.
- `src/integrations/calendar/event-to-entry.ts` — kept; now called from `calendar-adapter.ts`.

### 9.3 Nothing we touch

- `src/calc/**` — no hash change; `source_ref` canonicalization already handles any `kind`. Additive enum widening does not move any existing entry's hash.
- `src/calc/effort.ts` / `effort-categories.ts` — v0 aggregation already handles any `effort_kind`.
- `public/partners/**` — partner configs untouched.
- Existing `TokenProvider` contract — additive consumers only.

## 10. Data flow — trace of a digest-accept

```
User opens Log screen
  → DigestPanel mounts
    → getEnabledAdapters(integrationsConfig)       // calendar + slack + gmail
    → Promise.all(adapters.map(a => a.fetchDailyDigest(today)))
      → Slack: client.fetchThreads(today) → classifySlackActivity → group by (direction, project)
        → heuristicHoursHundredths per group → DigestRow[]
      → Gmail: api.fetchSentThreads(today) → classifyGmailThread → group → DigestRow[]
      → Calendar: api.fetchEvents(today) → classifyCalendarEvent
        → substantive events: one DigestRow each
        → short meetings: group by direction → DigestRow[]
    → DigestPanel renders grouped rows

User clicks Accept on "Slack → Acme (12 threads)  0.40h"
  → buildEntry {
      hours_hundredths: 40,
      effort_kind: 'slack',
      effort_count: 12,
      project: 'acme',
      bucket_id: null,
      rate_source: 'project_default' (resolved via resolveRateAtLogTime),
      billable_status: default per project,
      description: "Slack — 12 threads with Acme",
      source_ref: { kind: 'slack', id: 'daily:2026-04-15:client:T012AB:acme' },
      ...
    }
  → validateEntries (ajv + cross-field effort check)
  → addEntry → writeJsonFileWithRetry
    → current month file loads; if schema_version < 5, upgradeEntriesFileToV5 runs
    → commit: "log: slack batch for acme • 12 threads [schema v4→v5]"
  → queryClient.invalidateQueries({ queryKey: qk.monthEntries(month) })
  → Dashboard + Entries + EffortSummaryCard re-fetch
  → 5-second undo toast shown; clicking Undo calls deleteEntry
```

## 11. Error handling

| Surface | Condition | Behavior |
|---|---|---|
| Digest fetch | Slack 401 (token expired) | Per-source yellow banner; other sources still render; Settings shows "Slack token invalid" |
| Digest fetch | Gmail 403 (missing scope) | Per-source banner with "Re-connect Gmail" button |
| Digest fetch | Slack rate-limit (429) | Retry with backoff (Slack advertises `Retry-After`); one retry then give up with banner |
| Digest fetch | Network timeout | Per-source "Failed to fetch — retry" button |
| Digest accept | `addEntry` fails validation | Row reappears in digest; inline red banner under row with validation message |
| Digest accept | GitHub 409 (sha conflict) | Existing writeJsonFileWithRetry handles this; user sees no disruption |
| Digest accept | `source_ref` duplicate | `addEntry` throws; row reappears with "already logged" banner |
| Undo | `deleteEntry` fails | Toast replaced with "Undo failed — visit Entries screen" |
| Integrations config | Malformed JSON on save | Red banner with parse-error location; no write |
| Integrations config | Schema validation fails | Red banner listing failing fields; no write |

## 12. Testing expectations

### 12.1 Unit tests (pure)

- `tests/integrations/heuristics.test.ts` — per-source minutes × count → hundredths; min-1 floor; rounding to nearest hundredth.
- `tests/integrations/classification/slack.test.ts` — channel-prefix matching; DM domain matching; priority rules; ambiguous fallback.
- `tests/integrations/classification/gmail.test.ts` — recipient-domain classification; sent-only filter; multiple recipients across domains.
- `tests/integrations/classification/calendar.test.ts` — workshop / training / internal_sync priority rules; v0 default preserved.
- `tests/integrations/adapters/calendar-adapter.test.ts` — refactor produces unchanged DigestRows for today's calendar users' inputs.

### 12.2 Integration tests (mocked fetch)

- `tests/integrations/slack-client.test.ts` — `conversations.history` pagination; `Retry-After` handling; error-shape parsing.
- `tests/integrations/gmail-api.test.ts` — `in:sent newer_than:1d` query construction; thread grouping from message list.
- `tests/integrations/digest.test.ts` — three mocked adapters composed; grouping, sorting, dedupe ordering.

### 12.3 Schema tests

- `tests/schema/entry-v5-migration.test.ts` — v1/v2/v3/v4/v5 on the wire; new `source_ref.kind` values accepted; upgrade-on-write suffix correctness.
- `tests/schema/integrations-config.test.ts` — minimal config accepted; full config accepted; unknown fields rejected; schema_version enforced.

### 12.4 Property tests

- `tests/integrations/heuristics-property.test.ts` — `heuristicHoursHundredths(m, n) ≥ 1` always; non-decreasing in `n`; non-decreasing in `m`.
- `tests/calc/hash-v5.test.ts` — canonicalization of entries with `source_ref.kind: 'slack' | 'gmail'` is deterministic and reverse-insensitive (matches the existing v4 property).

### 12.5 Golden regression (Gate A)

The March 2026 golden fixture MUST remain byte-identical. `source_ref.kind` enum widening is a pure addition — no existing entry's canonicalization changes. `npm run test:golden` stays green.

### 12.6 Manual verification checklist

- [ ] Gmail re-consent flow appears once after the calendar-only state.
- [ ] Slack BYO-token paste + workspace id → Settings card shows "Connected to <workspace name>".
- [ ] Digest loads on Log-screen mount with all three sources enabled.
- [ ] CLIENT / INTERNAL / AMBIGUOUS groups render; ambiguous rows force pickers.
- [ ] Accept → entry lands with `source_ref`, `effort_kind`, `effort_count`, heuristic `hours_hundredths`.
- [ ] 5-second Undo toast → entry deleted via `deleteEntry`.
- [ ] "Accept all confident" → multiple entries written in parallel; ambiguous rows untouched.
- [ ] Per-source error banner on expired token; other sources still render.
- [ ] Disabled source absent from digest with no upsell nag.
- [ ] Dashboard `EffortSummaryCard` reflects the new entries' counts.
- [ ] Calendar-extended: a 90-min workshop shows as its own row; three 15-min meetings batch into one row.

### 12.7 Not testing

- Real Slack/Gmail API traffic. All tests use mocked fetch.
- Token expiration/refresh beyond the existing calendar integration's patterns.
- Cross-deploy-gap v5 reader behavior. Risk accepted (continuous deploy; risk window = seconds).

## 13. Dependencies and no-go rules

- No floating-point arithmetic on `hours_hundredths`. Heuristic helper does integer math.
- No silent entry writes. Every source-generated entry goes through digest Accept.
- No partner-scoped configuration in v1. `config/integrations.json` is per-consultant only.
- No new MCP server, no new JS runtime dep beyond `@slack/web-api` and (if needed) `googleapis` for Gmail. Prefer native `fetch` with typed response shapes if feasible.
- No token exposure in commits. `integrations.json` never stores tokens — tokens live only in localStorage.
- No PAT-in-URL leaks. Slack tokens in localStorage only, never query-string.

## 14. Known constraints

- **Slack workspace scope:** v1 supports one workspace per consultant. Multi-workspace mirroring the calendar multi-calendar pattern is deferred.
- **Gmail labels:** v1 counts any message in `in:sent newer_than:1d`. Per-label filtering (e.g., exclude `Promotions`) is deferred.
- **Calendar recurring events:** each instance counts as its own activity, unchanged from today's calendar behavior.
- **Time-zone for "today":** adapter uses the browser's local timezone when constructing `newer_than:1d` and `conversations.history` time ranges. Matches how the existing calendar adapter handles it.
- **Cross-month entries:** a digest accept for 2026-04-15 writes into `data/entries/2026-04.json`. Nothing new; matches existing write behavior.

## 15. Resolved decisions

Captured inline in Section 3. Every locked-in decision is cross-referenced from the section that depends on it.

## 16. What this spec does NOT cover

- **Outlook email, Jira, Linear, Zendesk, Intercom adapters.** Each a follow-up spec. The interface defined here is the contract they'll implement.
- **Cloudflare Worker OAuth exchange.** Parked as a backlog item. Swap-in point is `src/integrations/slack/auth.ts` (replace BYO-token validation with Worker-backed code-exchange; localStorage key shape unchanged).
- **Historical backfill.** Deferred.
- **First-class form UI for `integrations.json`.** JSON editor in v1; form UI deferred.
- **Partner-level kill switch.** Not needed — partners control deployment of `integrations.json` per consultant.

## 17. Sequencing

The implementation plan (written after this spec is approved) will sequence tasks so each commit is independently testable and reviewable:

1. Schema v5 bump + validator + upgrade path + tests.
2. New types (`EffortSourceAdapter`, `DigestRow`, `IntegrationsConfig`) + schema for `integrations.json` + repo module + tests.
3. `heuristics.ts` + `classification/*.ts` + unit + property tests.
4. Calendar adapter refactor onto the interface (no UX change yet).
5. Gmail adapter (API wrapper + adapter + classification wiring).
6. Slack adapter (API wrapper + BYO-token auth + adapter + classification wiring).
7. `DigestPanel` UI + per-row Accept flow + undo toast.
8. Settings Integrations section + JSON config editor.
9. Full-stack manual verification checklist (Section 12.6).
10. Docs sweep: CLAUDE.md pointer, architecture playbooks, backlog updates.

Gate A review dispatched before merge. Nothing in `src/calc/**` changes behaviorally (only consumes the widened `source_ref.kind`), but a review confirms the hash-invariance claim.

## 18. Acceptance criteria

- [ ] Schema v5 accepted by validator; every legacy version backfills cleanly.
- [ ] Hash invariance: March 2026 golden fixture byte-for-byte unchanged.
- [ ] `EffortSourceAdapter` interface defined; three adapters implement it.
- [ ] Calendar adapter produces same entries as today's code for equivalent inputs.
- [ ] Gmail adapter fetches sent-folder threads and classifies by domain.
- [ ] Slack adapter fetches channel + DM activity and classifies by channel prefix / DM domain.
- [ ] `DigestPanel` renders three groups (client / internal / ambiguous).
- [ ] Per-row Accept writes a single Entry with `effort_kind`, `effort_count`, heuristic `hours_hundredths`, and `source_ref`.
- [ ] "Accept all confident" batch-accepts confident rows in parallel; ambiguous untouched.
- [ ] 5-second undo toast deletes the entry via `deleteEntry`.
- [ ] Settings Integrations section connects each source.
- [ ] `integrations.json` loads and saves via GitHub; validated on save.
- [ ] Slack BYO-token flow validates via `auth.test` before persisting.
- [ ] Per-source error banners render independently.
- [ ] `npm run typecheck && npm run lint && npm test && npm run test:golden && npm run test:property && npm run build` all pass.
- [ ] Gate A code-reviewer dispatched and clean before merge.
- [ ] Backlog updated with deferred items per Section 2.
