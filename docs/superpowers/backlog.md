# Hours Tracker — post-MVP backlog

Tracked features deferred from MVP (Phases 1–11). Each item references the spec section that motivates it.

## Near-term

- **Bucket CRUD** — edit/close/archive buckets from the UI (spec §8.5). MVP only supports creating projects.
- **Edit modal for entries** — click a row in Entries to open Quick Log form pre-filled (spec §8.4). MVP supports delete only.
- **Snapshot list + drift diff** — full Snapshots screen with drift indicator and diff view (spec §8.7). MVP supports close only.
- **Bulk rate update tool** — preview + filter + apply (spec §7 row 9, decision 9). MVP uses manual per-entry edits.
- **CSV export** — export any month or filtered set as CSV (spec §3 row 12).
- **Keyboard shortcut `⌘/Ctrl+K`** to focus Quick Log from any screen (spec §8.1).
- **Needs-review queue on dashboard** — clickable, review-all (spec §8.3).
- **Drift indicator on snapshots** — `source_hash` comparison on snapshot load (spec §5.6).

## Medium-term

- **Offline logging with replay queue** (spec §12 known constraint).
- **PDF invoice export** (spec §2 non-goal for MVP — revisit if asked).
- **Multi-device sync conflict UX** — full conflict banner with 3-way merge option.
- **Partner-level config editing from UI** — for partner admins. MVP requires a PR.
- **Rate history editing** (currently append-only via UI; backend allows it).

## Speculative

- **OAuth device flow** to replace PAT (spec §6.1 "Future upgrade path"). Requires a tiny Cloudflare Worker.
- **Additional partners** onboarded (see `docs/architecture/partner-onboarding.md`).
- **Calendar integration** — log from Google Calendar events.
- **Mobile PWA** with offline-first entry.
