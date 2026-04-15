# Effort kinds

The 19 values of `EffortKind` and their rollup categories. Adding a new kind is additive: no schema version bump required.

## Kinds by category

### Client-sync
- **workshop** — discovery, scoping, working sessions
- **meeting** — kickoff, weekly sync, status call, client 1:1
- **client_training** — structured training / enablement

### Technical
- **config_work** — portal setup, user/permissions
- **build** — custom modules, templates, workflows
- **integration** — connectors, APIs, webhooks
- **data_work** — migration, cleaning, dedup, mapping
- **reporting** — dashboards, reports
- **qa** — testing, UAT, pre-launch validation

### Client-async
- **slack** — Slack / Teams messages
- **email** — email threads
- **async_video** — Loom / recorded walkthroughs
- **ticket** — Jira / Zendesk responses

### Internal
- **internal_sync** — stand-ups, planning, retros, 1:1s
- **documentation** — runbooks, training materials
- **peer_review** — config / code / data review

### Enablement
- **learning** — certifications, new-feature research
- **scoping** — pre-sales / SOW input

### Other
- **other** — catch-all; rolls up to `enablement` for aggregation

## Adding a new kind

1. Pick the category it belongs to.
2. Extend the `EffortKind` union in `src/schema/types.ts`.
3. Add the value to the `enum` array in `schemas/entries.schema.json`.
4. Add the kind → category mapping in the `KIND_TO_CATEGORY` record in `src/calc/effort-categories.ts`.
5. Add the value to `ALL_EFFORT_KINDS` in `src/calc/effort-categories.ts` (used by `emptyByKind`).
6. Add a human label in `EFFORT_KIND_LABEL` in `src/ui/components/EffortKindSelect.tsx`.
7. Add the kind to the `GROUPS` array in the same file so it appears in the dropdown.
8. Update this doc.

No schema version bump. The golden fixture is unaffected because no existing entry can have a newly-introduced kind.
