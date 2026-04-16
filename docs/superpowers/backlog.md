# Hours Tracker — post-MVP backlog

Tracked features deferred from MVP (Phases 1–11). Each item references the spec section that motivates it.

## Shipped

- **Edit modal for entries** — click a row in Entries to open the Quick Log form pre-filled (spec §8.4). Shipped pre-Phase-A.
- **CSV export** — Export CSV button on Entries exports the currently-filtered rows (spec §3 row 12). Phase A.
- **Keyboard shortcut `⌘/Ctrl+K`** — focuses Quick Log project select from any screen (spec §8.1). Phase A.
- **Needs-review queue on dashboard** — clickable banner links to Entries with a needs-review status filter prefilled (spec §8.3). Phase A.
- **Bucket CRUD (edit)** — inline edit name, budgeted hours, rate, status, and notes from Projects & Buckets (spec §8.5). Phase A.
- **Bulk rate update tool** — filter + preview + apply dialog on Rates; commits one `bulk-edit:` per affected month (spec §7 row 9, §8.6). Phase A.
- **Snapshot list + drift indicator + diff** — Snapshots screen lists every closed month, shows drift badge on expand, and surfaces added / removed / possibly-changed entry ids (spec §5.6, §8.7). Phase A.
- **Log screen 2-column layout + date at top** — form left, calendar suggestions right. Phase B.
- **Google Calendar integration (read-only)** — browser-native OAuth via GIS, multi-calendar support, click-to-prefill form, persistent dedupe via Entry `source_event_id` (schema v2). Phase C.
- **Dashboard calendar view** — month-grid modal launched from a calendar icon on the Dashboard header. Per-day billable / non-billable / needs-review stacked bars, heatmap tint, today ring, muted weekends, week totals column, click-day side panel with entry list, click-entry → existing EditEntryModal. Mobile list fallback below `lg`.
- **Dashboard this-month Project Builds table** — bucket-level table for the selected month, styled like Monthly Invoice. Uses the same project-builds stream definition as the existing summary card.
- **Effort tracking v0 (per-consultant).** Schema v4 adds optional `effort_kind` + `effort_count`. 19-kind taxonomy across 5 categories. Quick Activity card in the Assist panel. `profile.logging_mode` (hours/effort/both) controls the LogForm layout for HubSpot-lead consultants. Dashboard `EffortSummaryCard` + per-project effort column + calendar modal daily row. CSV export gains two trailing columns. Agency-wide roll-up, auto-pull integrations, and AI features are deferred to later specs.
- **Effort source integrations (v1, per-consultant).** `EffortSourceAdapter` interface with three concrete adapters: Calendar (extended beyond `meeting` → `workshop` / `client_training` / `internal_sync`), Gmail (sent-folder digest, classification by recipient domain), Slack (BYO bot-token, classification by channel prefix + DM domain). Daily-digest UX groups rows into CLIENT / INTERNAL / AMBIGUOUS. One Entry per accepted row with heuristic hours pre-fill. Schema v5 (additive enum widening on `source_ref.kind`). New `config/integrations.json`. JSON editor in Settings. Live QuickLog wiring (replacing SuggestionsPanel) deferred as a follow-up commit.

## Near-term

- **DigestPanel live wiring on Log screen** — mount below the form, composed adapters with real Google + Slack tokens, per-row Accept calling `addEntry`.
- **Outlook / Microsoft Graph email adapter** — mirrors Gmail pattern, new OAuth provider.
- **Jira / Linear adapter** — ticket activity.
- **Zendesk / Intercom adapter** — support activity.
- **Cloudflare Worker OAuth exchange** — replaces Slack BYO bot-token with proper OAuth.
- **Slack multi-workspace per consultant** — mirror calendar multi-calendar pattern.
- **Historical backfill** — "scan last 30 days" tool for Slack / Gmail.
- **First-class form UI for `integrations.json`** — per-field editors replacing the JSON textarea.

## Medium-term

- **Offline logging with replay queue** (spec §12 known constraint).
- **PDF invoice export** (spec §2 non-goal for MVP — revisit if asked).
- **Multi-device sync conflict UX** — full conflict banner with 3-way merge option.
- **Partner-level config editing from UI** — for partner admins. MVP requires a PR.
- **Rate history editing** (currently append-only via UI; backend allows it).

## Speculative

- **OAuth device flow** to replace PAT (spec §6.1 "Future upgrade path"). Requires a tiny Cloudflare Worker.
- **Additional partners** onboarded (see `docs/architecture/partner-onboarding.md`).
- **Mobile PWA** with offline-first entry.
