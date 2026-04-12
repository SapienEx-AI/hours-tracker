# Hours Tracker — Design Spec

**Status:** Draft for review (v2 — partner model + AI-native workflow added)
**Author:** Prash + Claude (brainstorming)
**Date:** 2026-04-11
**Project:** `sapienEx-AI/hours-tracker` (app) + `sapienEx-AI/hours-data-<partner>-<consultant>` (data, one per consultant)

---

## 0. Platform context — SapienEx hosts, Partners consume

Hours Tracker is a **SapienEx platform product** offered to partner organizations. SapienEx owns and maintains the app; each partner (e.g., Sector Growth) is a tenant whose branding and configuration sit on top of the same static deployment. Sector Growth is the first partner; more will onboard later.

This creates **two levels of tenancy**:

1. **Partner** (e.g., Sector Growth, future partners) — owns branding, theme, currency, logo, tagline, list of consultant data repos. Partner config is a JSON file + asset folder committed to the app repo. Adding a new partner = one PR.
2. **Consultant within a partner** (e.g., Prash at Sector Growth) — owns a private data repo containing their entries, projects, rates, and snapshots.

**Branding rules:**
- **Partner branding is front and center.** The partner logo is the primary mark in the top-left nav. Partner colors drive the theme. Page titles, favicon, and meta tags reflect the partner.
- **SapienEx branding is subtle.** A small "Powered by SapienEx" wordmark in the footer, muted color, no logo fanfare. One-line attribution, not a co-brand.
- **Partner palette, fonts, and logo are served from `public/partners/<partner-id>/`.** No per-partner code. Theme is applied via CSS custom properties at the `:root` level so every component inherits without conditionals.

**First-run flow:**
1. Consultant lands on `https://sapienex-ai.github.io/hours-tracker/`.
2. App shows "Select your organization" screen with a dropdown populated from `public/partners/index.json`.
3. Consultant picks their partner (e.g., Sector Growth).
4. Partner theme applies immediately — logo, colors, fonts swap in.
5. App shows the PAT setup flow (see §6.1), pre-filling the GitHub URL with the partner's data-repo prefix (`sapienEx-AI/hours-data-sector-growth-<your-slug>`).
6. Consultant pastes PAT. App validates, loads consultant's data, lands on Dashboard.
7. Partner + consultant slug + token persist in localStorage. Subsequent visits skip straight to the Dashboard.

Adding a new partner is a mechanical change to the app repo — exactly the kind of change a Claude Code subagent can make in one PR given a logo file and a color palette.

---

## 1. Purpose

A personal consulting-hours tracker for Prash (and later, other Sector Growth consultants) that replaces ad-hoc tracking in Apple Notes. Hours are logged throughout the day or at end of day, classified by project, billable status, and optional project hour bucket, and rolled up into a monthly invoice total billed to Sector Growth.

Data integrity is the overriding concern. Every logged hour is precious; no write may silently corrupt or drop data. Historical data is editable but never silently mutated, and prior monthly invoice computations are preserved verbatim.

---

## 2. Non-goals

- **Not a multi-user shared workspace.** Each consultant gets their own private data repo. No cross-user views, no comments, no notifications.
- **Not an invoicing system.** The app computes totals and exports CSV/JSON; actual invoices are created outside it.
- **Not a time-tracking timer.** Entries are manual (hours + description), not start/stop clocks.
- **Not a client-facing portal.** Only the consultant logs into their own data.
- **Not PDF generation** (for MVP). JSON and CSV exports only.
- **Not a general project management tool.** Projects and buckets exist only to categorize hours.

---

## 3. Architecture decisions (locked from brainstorming)

| # | Decision | Choice |
|---|---|---|
| 1 | Hosting & auth model | **Pure static site on GitHub Pages + GitHub auth via fine-grained PAT.** No backend, no servers, no databases. |
| 2 | Multi-tenancy | **Two levels.** Partner configs in app repo (`public/partners/<partner-id>/`); one private data repo per consultant (`sapienEx-AI/hours-data-<partner>-<consultant>`). Access control = GitHub repo permissions. |
| 3 | Branding | **Partner-dominant, SapienEx subtle.** Partner logo, colors, fonts, favicon at the forefront. SapienEx appears only as "Powered by SapienEx" in the footer. |
| 4 | Rate model | **Global default + optional per-project default + optional per-entry override.** Actual rate is *snapshotted* onto every entry at log time. Changing the default only affects future logs by construction. |
| 5 | Currency | **Per-partner** (stored in partner config). Sector Growth = CAD. All amounts in a consultant's data repo are in that partner's currency. No FX conversion for MVP. |
| 6 | Data format | **JSON**, per-month entry files. Human-readable, git-diffable, machine-parseable. |
| 7 | Bucket model | **Projects own 0..N buckets.** Bucket types: `hour_block` / `discovery` / `arch_tl` / `dev` / `custom`. Each bucket has its own budgeted hours and optional rate override. Entries are either unbucketed (general billable) or linked to exactly one bucket. |
| 8 | Snapshots | **Manual "close month"** writes an immutable JSON snapshot + git tag. Editing historical entries is allowed freely; the app surfaces *drift* between the snapshot and current source. |
| 9 | Rate change | Forward-only by default; explicit "Bulk rate update" tool with preview for retroactive changes. |
| 10 | Closed-month editing | **No hard lock** — edit freely, drift indicator warns. |
| 11 | Dashboard | Three-line totals: Billable / Non-billable / Needs review. |
| 12 | Export | JSON (raw source) + CSV (flattened) for any month or filtered set. |
| 13 | AI-native workflow | **First-class requirement.** CLAUDE.md at root, per-module READMEs, small focused files, tests as docs, no clever abstractions. See §15. |

---

## 4. Repo layout

### 4.1 `sapienEx-AI/hours-tracker` (app repo, public, Pages enabled project-scoped)

```
hours-tracker/
├── CLAUDE.md                  # AI-native workflow guide (see §15)
├── README.md                  # Human onboarding
├── LICENSE
├── src/
│   ├── calc/                  # Pure calculation module (see §7)
│   │   ├── README.md
│   │   ├── int.ts             # Integer-math helpers (cents, hundredths)
│   │   ├── rates.ts           # resolveRateAtLogTime, rate history walk
│   │   ├── totals.ts          # computeMonthTotals, per-project, per-bucket
│   │   ├── hash.ts            # canonicalizeEntriesForHashing, hashEntries
│   │   └── index.ts           # Public re-exports
│   ├── data/                  # Data access layer (GitHub API ↔ JSON files)
│   │   ├── README.md
│   │   ├── octokit-client.ts
│   │   ├── entries-repo.ts
│   │   ├── projects-repo.ts
│   │   ├── rates-repo.ts
│   │   ├── snapshots-repo.ts
│   │   └── commit-messages.ts
│   ├── schema/                # JSON schemas + validators
│   │   ├── README.md
│   │   └── validators.ts      # ajv-compiled validators, re-exported
│   ├── partner/               # Partner loading + theme application
│   │   ├── README.md
│   │   ├── load-partner.ts
│   │   └── apply-theme.ts
│   ├── auth/                  # Token provider abstraction + PAT impl
│   │   ├── README.md
│   │   ├── token-provider.ts  # Interface — future-proofs for OAuth swap
│   │   └── pat-provider.ts    # Concrete PAT implementation
│   ├── store/                 # Zustand stores
│   │   ├── README.md
│   │   ├── auth-store.ts
│   │   ├── partner-store.ts
│   │   └── ui-store.ts
│   ├── ui/                    # React components
│   │   ├── README.md
│   │   ├── components/        # Small shared primitives (Button, Input, etc.)
│   │   ├── screens/
│   │   │   ├── FirstRun.tsx
│   │   │   ├── QuickLog.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Entries.tsx
│   │   │   ├── ProjectsAndBuckets.tsx
│   │   │   ├── Rates.tsx
│   │   │   ├── Snapshots.tsx
│   │   │   └── Settings.tsx
│   │   └── layout/
│   │       ├── AppShell.tsx   # Header with partner logo, nav, footer with SapienEx mark
│   │       └── Footer.tsx
│   ├── format/                # Display formatting (cents → $X,XXX.XX CAD, hundredths → "4.25h")
│   │   ├── README.md
│   │   └── format.ts
│   └── main.tsx
├── public/
│   ├── partners/              # PARTNER CONFIGS — one folder per partner
│   │   ├── index.json         # List of all partners (id, name, enabled)
│   │   ├── sector-growth/
│   │   │   ├── partner.json   # Theme, currency, display name, data repo prefix
│   │   │   ├── logo.webp      # Primary logo (dark-bg-ready)
│   │   │   └── favicon.png
│   │   └── sapienex/          # Attribution assets (small wordmark for footer)
│   │       └── wordmark.svg
│   └── fonts/                 # Self-hosted fonts (optional — may use Google Fonts link)
├── tests/
│   ├── calc/
│   │   ├── unit.test.ts
│   │   ├── property.test.ts
│   │   └── golden.test.ts
│   ├── fixtures/
│   │   ├── 2026-03-golden.json
│   │   └── 2026-03-expected.json
│   └── integration/
├── schemas/                   # JSON Schemas — single source of truth
│   ├── entries.schema.json
│   ├── projects.schema.json
│   ├── rates.schema.json
│   ├── snapshot.schema.json
│   ├── profile.schema.json
│   └── partner.schema.json
├── scripts/
│   ├── import-march-2026.ts   # One-time Apple Notes import (see §9)
│   └── new-partner.ts         # Interactive CLI to scaffold a new partner folder
├── .github/workflows/
│   ├── ci.yml                 # Lint, type check, unit + property + golden tests
│   └── deploy.yml             # Build and deploy to Pages
├── docs/
│   ├── superpowers/specs/
│   │   └── 2026-04-11-hours-tracker-design.md   ← this file
│   └── architecture/
│       ├── data-flow.md
│       ├── calc-invariants.md
│       └── partner-onboarding.md
├── .eslintrc.cjs              # Includes custom integer-math rule
├── .prettierrc
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
└── AGENTS.md → CLAUDE.md      # Symlink so Cursor/Aider/Codex also pick it up
```

### 4.2 `sapienEx-AI/hours-data-sector-growth-prash` (data repo, private)

Naming convention: `hours-data-<partner-id>-<consultant-slug>`. The partner prefix is enforced at first-run (the app rejects a data repo whose name doesn't start with the selected partner's prefix). This makes the partner→consultant ownership chain visible at the org level and trivially listable.

```
hours-data-sector-growth-prash/
├── config/
│   ├── profile.json            # partner_id, consultant display name, currency (inherited), etc.
│   ├── projects.json           # project list + buckets (see §5.3)
│   └── rates.json              # rate history (see §5.4)
├── data/
│   ├── entries/
│   │   ├── 2026-03.json        # March entries (see §5.2)
│   │   ├── 2026-04.json
│   │   └── ...
│   └── snapshots/
│       ├── 2026-03.json        # closed month snapshot (see §5.5)
│       └── ...
├── exports/                    # gitignored — CSV/JSON outputs from the app
├── schemas/                    # frozen copies of JSON schemas this data was written against
│   ├── entries.schema.json
│   ├── projects.schema.json
│   ├── rates.schema.json
│   ├── snapshot.schema.json
│   └── profile.schema.json
├── .github/workflows/
│   └── validate.yml            # runs ajv on every push, fails on schema violation
├── .gitignore
└── README.md                   # "This repo is consumed by hours-tracker — do not edit by hand unless you know what you're doing"
```

**Why `schemas/` lives in both repos:** the app publishes the canonical schema, and each data repo keeps a frozen copy matching the `schema_version` of its files. The data-repo CI validates against the frozen copy so that upgrades to the app never break old data by accident — schema bumps are a deliberate, reviewed event.

---

## 5. Data model

All money is stored as **integer cents**. All hours are stored as **integer hundredths** (`0.25h` → `25`). This eliminates floating-point drift across all computation. Display-layer converts to `$1,234.56 CAD` and `0.25h` at the edge, using the partner-level currency code.

### 5.1 Partner config — `public/partners/<partner-id>/partner.json` (committed to app repo)

```json
{
  "schema_version": 1,
  "id": "sector-growth",
  "display_name": "Sector Growth",
  "tagline": "Consulting hours for Sector Growth",
  "website": "https://sectorgrowth.com",
  "currency": "CAD",
  "currency_symbol": "$",
  "currency_display_suffix": "CAD",
  "data_repo_prefix": "hours-data-sector-growth-",
  "theme": {
    "mode": "dark",
    "bg_deep":      "#0A1628",
    "bg_darker":    "#050B16",
    "accent_cyan":  "#6BCFEE",
    "accent_mid":   "#2A85C4",
    "accent_deep":  "#1E4DA8",
    "text_primary": "#F5F7FA",
    "text_muted":   "#94A3B8",
    "border_subtle":"rgba(255,255,255,0.08)",
    "border_strong":"rgba(255,255,255,0.16)"
  },
  "fonts": {
    "display": "'Space Grotesk', system-ui, sans-serif",
    "body":    "'Inter', system-ui, sans-serif",
    "mono":    "'JetBrains Mono', ui-monospace, monospace",
    "google_fonts_link": "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
  },
  "assets": {
    "logo": "logo.webp",
    "logo_alt_text": "Sector Growth",
    "logo_width": 180,
    "logo_height": 48,
    "logo_dark_filter": "invert(1) hue-rotate(180deg) brightness(1.05)",
    "favicon": "favicon.png"
  },
  "enabled": true
}
```

Partner configs are **immutable per deployment** — changing one requires an app repo commit + redeploy. The `public/partners/index.json` file is a simple manifest:

```json
{
  "schema_version": 1,
  "partners": [
    { "id": "sector-growth", "display_name": "Sector Growth", "enabled": true }
  ]
}
```

**CSS theming:** `partner/apply-theme.ts` sets every theme key as a CSS custom property on `:root`, so a CSS rule like `color: var(--text-primary)` automatically picks the active partner's value. Tailwind config references these same custom properties under `colors.partner.primary`, etc., so Tailwind utilities like `bg-partner-deep` also inherit partner colors.

**Typography loading:** if `fonts.google_fonts_link` is set, the app injects a `<link rel="stylesheet">` at runtime. Self-hosted fallback is supported via `public/fonts/` if a partner wants to avoid Google Fonts.

**Logo rendering:** `logo_dark_filter` is applied as a CSS `filter` on the `<img>` when the theme is in dark mode. This matches the trick in the booking-site CSS that flips a black wordmark with a cyan accent to white-on-dark without needing a separate dark logo file.

### 5.2 Consultant profile — `config/profile.json` (in data repo)

```json
{
  "schema_version": 1,
  "partner_id": "sector-growth",
  "consultant_id": "prash",
  "display_name": "Prash",
  "email": "prash@sectorgrowth.com",
  "timezone": "America/Toronto",
  "created_at": "2026-04-11T00:00:00Z"
}
```

**Why `partner_id` lives here:** when the app connects to a data repo, it reads `profile.json` and verifies that `partner_id` matches the partner the user selected at first-run AND that the repo name starts with that partner's `data_repo_prefix`. Mismatch → hard error, refuse to load. This prevents a Sector Growth user from accidentally pointing at a different partner's data repo.

**Currency is NOT stored on the profile** — it's always inherited from the partner config at render time. This keeps currency a partner-level property and avoids drift if a partner ever rebases.

### 5.3 Entries file — `data/entries/YYYY-MM.json`

```json
{
  "schema_version": 1,
  "month": "2026-03",
  "entries": [
    {
      "id": "2026-03-25-sprosty-a3f9c1",
      "project": "sprosty",
      "date": "2026-03-25",
      "hours_hundredths": 400,
      "rate_cents": 2000,
      "rate_source": "entry_override",
      "billable_status": "billable",
      "bucket_id": null,
      "description": "skyvia HS + companies configs",
      "review_flag": false,
      "created_at": "2026-03-25T22:15:04Z",
      "updated_at": "2026-03-25T22:15:04Z"
    }
  ]
}
```

**Field contract:**

| Field | Type | Notes |
|---|---|---|
| `id` | string | `YYYY-MM-DD-<project-slug>-<6-hex>`. Unique, stable, human-scannable. |
| `project` | string | Foreign key → `config/projects.json:projects[].id`. Validated on write. |
| `date` | string | ISO date `YYYY-MM-DD`. Must fall within the file's month (validated). |
| `hours_hundredths` | integer | Hours × 100. `0.25h` = `25`. Range `[1, 2400]` (max 24h/day). |
| `rate_cents` | integer | Rate × 100 in cents. Snapshotted at log time. |
| `rate_source` | enum | `entry_override` \| `project_default` \| `global_default`. Audit trail for where the rate came from. |
| `billable_status` | enum | `billable` \| `non_billable` \| `needs_review`. |
| `bucket_id` | string \| null | Foreign key → bucket in `config/projects.json`. If set, `billable_status` must be `billable`. |
| `description` | string | Free text, max 500 chars. |
| `review_flag` | boolean | User-set "revisit this" flag, independent of `needs_review` status. |
| `created_at` | string | RFC3339 UTC. Never changes after creation. |
| `updated_at` | string | RFC3339 UTC. Updated on every edit. |

**Invariants (validated on every write):**
- `bucket_id != null` ⟹ `billable_status == "billable"`
- `date` falls inside `month`
- `project` exists in current `projects.json`
- If `bucket_id != null`, bucket exists in the referenced project
- `rate_cents > 0` when `billable_status == "billable"` (allowed to be 0 otherwise)
- `hours_hundredths >= 1` (no zero-hour entries)

### 5.4 Projects file — `config/projects.json`

```json
{
  "schema_version": 1,
  "projects": [
    {
      "id": "sprosty",
      "name": "Sprosty",
      "client": "Sprosty",
      "active": true,
      "is_internal": false,
      "default_rate_cents": null,
      "buckets": [
        {
          "id": "sprosty-skyvia-dev",
          "type": "dev",
          "name": "Skyvia Implementation — Dev",
          "budgeted_hours_hundredths": 2000,
          "rate_cents": 2000,
          "status": "active",
          "opened_at": "2026-03-25",
          "closed_at": null,
          "notes": ""
        }
      ]
    },
    {
      "id": "internal",
      "name": "Internal",
      "client": null,
      "active": true,
      "is_internal": true,
      "default_rate_cents": null,
      "buckets": []
    }
  ]
}
```

**Project field contract:**

| Field | Type | Notes |
|---|---|---|
| `id` | string | Slug, `^[a-z0-9-]+$`. Immutable once created (renaming the project only changes `name`). |
| `name` | string | Display name. |
| `client` | string \| null | Optional grouping tag. Free text for MVP. |
| `active` | boolean | Inactive projects hide from Quick Log dropdown but remain for history. |
| `is_internal` | boolean | Cosmetic hint — internal projects default to `non_billable` on new entries. |
| `default_rate_cents` | integer \| null | Per-project default. `null` means "use global". |
| `buckets` | array | 0..N buckets per project. |

**Bucket field contract:**

| Field | Type | Notes |
|---|---|---|
| `id` | string | Slug, unique within the project. |
| `type` | enum | `hour_block` \| `discovery` \| `arch_tl` \| `dev` \| `custom`. |
| `name` | string | Display name. |
| `budgeted_hours_hundredths` | integer | Budget in hundredths of an hour. |
| `rate_cents` | integer \| null | `null` means inherit project/global. |
| `status` | enum | `active` \| `closed` \| `archived`. `closed` warns on new entries; `archived` hides from UI. |
| `opened_at` | string | ISO date. |
| `closed_at` | string \| null | ISO date when moved to `closed`. |
| `notes` | string | Free text. |

**Invariants:**
- Project `id` uniqueness
- Bucket `id` uniqueness within a project
- `budgeted_hours_hundredths > 0`

### 5.5 Rates file — `config/rates.json`

```json
{
  "schema_version": 1,
  "default_rate_history": [
    {
      "effective_from": "2026-04-11",
      "rate_cents": 12500,
      "note": "Initial rate — $125 CAD/hr"
    }
  ]
}
```

Rate amounts inherit the currency from the partner config (§5.1); the `rate_cents` field is expressed in minor units of that currency. For Sector Growth this means `12500` = `$125.00 CAD`.

Entries in `default_rate_history` are **append-only by convention** (the UI only appends). Direct edits are supported (it's just a JSON file in git) but not encouraged. The UI shows the history as a read-only table and offers "Add new rate effective from ___".

**Determining the global default at a moment in time:** walk the history in descending order, pick the first entry with `effective_from <= target_date`.

### 5.6 Snapshot file — `data/snapshots/YYYY-MM.json`

```json
{
  "schema_version": 1,
  "month": "2026-03",
  "closed_at": "2026-04-03T10:14:22Z",
  "closed_at_commit_sha": "a3f9c1b2...",
  "source_hash": "sha256:7d8e9f...",
  "totals": {
    "total_hours_hundredths": 12350,
    "billable_hours_hundredths": 8750,
    "non_billable_hours_hundredths": 2900,
    "needs_review_hours_hundredths": 700,
    "billable_amount_cents": 1312500
  },
  "per_project": [
    {
      "project": "sprosty",
      "billable_hours_hundredths": 2500,
      "billable_amount_cents": 225000,
      "non_billable_hours_hundredths": 0,
      "needs_review_hours_hundredths": 0,
      "by_bucket": [
        {
          "bucket_id": "sprosty-skyvia-dev",
          "consumed_hours_hundredths": 900,
          "budgeted_hours_hundredths": 2000,
          "amount_cents": 18000
        }
      ]
    }
  ],
  "entry_ids": ["2026-03-25-sprosty-a3f9c1", "2026-03-30-sprosty-..."]
}
```

- `source_hash` is the SHA-256 of the canonical-serialized `entries/2026-03.json` at close time. On subsequent loads, the app recomputes the hash of the current file; if different, it shows the **drift indicator** and offers a diff view.
- `closed_at_commit_sha` pins the snapshot to a precise git commit for audit.
- The snapshot is **never rewritten** by the app after creation. The file is immutable by convention and CI.

---

## 6. Auth and GitHub API access

### 6.1 Auth mechanism — **Fine-grained Personal Access Token (PAT)**

The honest constraint of a pure-static GitHub-Pages architecture: completing a GitHub OAuth web flow from browser JavaScript requires a server-side step to exchange the code for a token (client secret handling, CORS). We ruled out servers. The clean alternative is a fine-grained PAT.

**Setup flow (first-time use, per consultant):** see §8.1.1 First Run screen for the full UX. The key technical steps are:
1. After selecting a partner, consultant is guided to `github.com/settings/personal-access-tokens/new` with a pre-filled link.
2. The numbered setup checklist: name = `hours-tracker`, repository access = "Only select" → the computed data repo, permissions = Contents (read + write) + Metadata (read, auto-granted), expiration up to 1 year.
3. Consultant pastes token. App validates by calling `GET /repos/sapienEx-AI/<computed-repo>` and `GET /user`. Rejects with a specific error message on failure (404 = repo missing, 403 = permissions wrong, 401 = token invalid).
4. Token stored in `window.localStorage` under an app-scoped key. Never sent anywhere except `api.github.com`.
5. Data repo name, partner id, and consultant slug stored alongside.

**Re-auth:** If a token expires or is revoked, the app detects the 401/403 on the next API call and prompts for a new token. No silent failures.

**Security posture:**
- The token's blast radius is scoped to a single data repo (fine-grained PAT, not classic PAT).
- localStorage is accessible only to the same-origin app (no cross-site exposure).
- The app is open source, so users can read the code and confirm the token is never exfiltrated.
- The app never sends the token anywhere except `api.github.com`.

**Future upgrade path:** If we ever add a tiny backend (e.g., Cloudflare Worker), we can replace PAT with OAuth device flow. The `auth/` module is designed to abstract the token source, so this swap touches only one file.

### 6.2 GitHub API client — **Octokit**

All GitHub API calls go through the `@octokit/rest` client. We use:
- `GET /repos/{owner}/{repo}/contents/{path}` to read JSON files.
- `PUT /repos/{owner}/{repo}/contents/{path}` to create or update files (with `sha` for updates).
- `GET /repos/{owner}/{repo}/git/refs/tags` + `POST /repos/{owner}/{repo}/git/refs` to create snapshot tags.
- `GET /repos/{owner}/{repo}/commits` for drift detection and history views.

### 6.3 Commit message convention

All commits produced by the app use a structured prefix so `git log --oneline` is instantly scannable:

```
log: sprosty 2026-03-25 4.0h @ $20 (skyvia HS + companies configs)
edit: 2026-03-25-sprosty-a3f9c1 — changed hours 4.0 → 4.5
delete: 2026-03-25-sprosty-a3f9c1 — no longer applies
bulk-edit: apply $175 rate to 22 entries matching {project: Sprosty, date: >= 2026-04-01}
config: add project "Shannex"
config: add bucket sprosty-skyvia-dev to sprosty
config: add rate $175 effective 2026-04-01
snapshot: close 2026-03 — 87.5h billable, 18h non-billable, $13,125
```

Destructive actions (delete, bulk-edit) always include the affected count and the filter criteria in the message for after-the-fact forensics.

### 6.4 Concurrency and write safety

Because each data repo has exactly one writer (one consultant), conflicts are extremely rare. Still, we protect against them:
- Every write includes the file's current `sha` (GitHub API returns 409 on mismatch).
- On 409, the app refreshes the local view, re-applies the intended change in memory, and retries once.
- If the retry also fails, the app shows a visible conflict banner with the server's current state and asks the user to confirm.
- The app never silently discards a user's write.

---

## 7. Calculation module — the most scrutinized code

All billing math lives in `src/calc/` as pure, side-effect-free, I/O-free functions. No DOM, no Octokit, no state — inputs in, numbers out. This is the module that gets obsessed over.

### 7.1 Public API

```ts
// All money in cents, all hours in hundredths — no floats anywhere.

export type CalcInput = {
  entries: Entry[];
  projects: ProjectsConfig;
  rates: RatesConfig;
};

export type MonthTotals = {
  month: string;
  total_hours_hundredths: number;
  billable_hours_hundredths: number;
  non_billable_hours_hundredths: number;
  needs_review_hours_hundredths: number;
  billable_amount_cents: number;
  per_project: ProjectTotals[];
};

export function computeMonthTotals(input: CalcInput, month: string): MonthTotals;
export function computeProjectTotals(input: CalcInput, month: string, project_id: string): ProjectTotals;
export function computeBucketConsumption(input: CalcInput, project_id: string, bucket_id: string): BucketConsumption;
export function resolveRateAtLogTime(
  project_id: string,
  date: string,
  projects: ProjectsConfig,
  rates: RatesConfig,
): { rate_cents: number; source: RateSource };
export function canonicalizeEntriesForHashing(entries: Entry[]): string;
export function hashEntries(entries: Entry[]): string;  // sha256 of canonicalized form
```

### 7.2 Verification layers

**Layer 1 — Unit tests** (`tests/calc/unit.test.ts`): one test per public function, hand-crafted inputs and expected outputs. Easy to read, easy to debug.

**Layer 2 — Property-based tests** (`tests/calc/property.test.ts`) using `fast-check`. Invariants:
- **Conservation:** `billable + non_billable + needs_review === total` for any input.
- **Additivity:** `sum(per_project[i].billable) === global.billable` for any project partition.
- **Rate snapshotting:** changing `rates.json` never changes totals for entries already dated in the past.
- **Bulk rate edit preserves hours:** after a bulk rate change, total hours unchanged; only amounts change.
- **Hash stability:** `hashEntries(X) === hashEntries(Y)` iff `X` and `Y` are deep-equal (modulo key order).
- **Hash determinism:** `hashEntries(X) === hashEntries(X)` always.
- **No double-counting:** every entry contributes to exactly one cell in every rollup.
- **Monotonicity under insertion:** adding a billable entry can only increase `billable_amount_cents`, never decrease.

**Layer 3 — Golden-file tests** (`tests/calc/golden.test.ts`): your March 2026 notes → parsed into `tests/fixtures/2026-03-golden.json`. Expected totals hand-computed and verified by you, stored as `tests/fixtures/2026-03-expected.json`. Every build runs `computeMonthTotals(golden) === expected`. Any drift fails CI loudly.

**Layer 4 — Multi-agent review gates.** At three points in implementation, 2–3 independent subagents review the calc code against this spec and the requirements. Gates:
- **Gate A — after calc module is written** (before any UI work): agents verify pure/no-side-effects, correctness of rate resolution, conservation invariants coded into tests, absence of floating-point usage.
- **Gate B — after UI integration** (before import of March data): agents verify UI numbers match calc numbers for the golden fixture, no computation drift across render paths.
- **Gate C — before the first snapshot** (before closing March): agents replay the full March import, compare to hand-computed expected totals, and must all agree to pass.
At each gate, all reviewing agents must independently agree. Any disagreement blocks progress until resolved.

**Layer 5 — Runtime invariant checks.** Every render of a totals view computes the same number via two redundant paths (e.g., sum-by-project and sum-by-date) and throws if they disagree. An error banner surfaces the discrepancy instead of silently displaying wrong numbers.

**Layer 6 — Integer math enforcement.** A lint rule (or custom ESLint) forbids `number` arithmetic on fields ending in `_cents` or `_hundredths` except through explicit helpers in `src/calc/int.ts`. This prevents a drive-by `Math.round(x * 1.5)` from sneaking in.

---

## 8. UX

### 8.1 Information architecture

Eight screens: a one-time First Run + seven authenticated screens. Left-nav layout with partner branding top-left, consultant profile top-right, SapienEx attribution in the footer:

```
┌─────────────────────────────────────────────────────────────┐
│ [Sector Growth logo]                prash ▾    [Sign out]  │ ← partner branding dominant
├─────────┬───────────────────────────────────────────────────┤
│ Log     │                                                   │
│ Dash    │                                                   │
│ Entries │               (main content area)                 │
│ Projects│                                                   │
│ Rates   │                                                   │
│ Snap.   │                                                   │
│ Settings│                                                   │
├─────────┴───────────────────────────────────────────────────┤
│                                   Powered by SapienEx ·     │ ← subtle, muted footer
└─────────────────────────────────────────────────────────────┘
```

**Branding placement rules:**
- **Top-left:** partner logo, linked to partner's website, using `logo_dark_filter` if the theme mode is dark. Height 40px, width auto. Alt text = partner name.
- **Top-right:** consultant display name dropdown (opens Settings shortcuts). No SapienEx mark.
- **Footer:** right-aligned, small, muted text color: `Powered by SapienEx`. Font: body at 11px, color `var(--text-muted)`. No logo. One line, zero visual weight.
- **`<title>` tag:** `Hours · {partner display_name}` (e.g., `Hours · Sector Growth`). No "SapienEx" in the title.
- **Favicon:** loaded from `public/partners/<partner-id>/favicon.png` dynamically at partner-load time via `<link rel="icon">` replacement.
- **Meta theme-color:** `partner.theme.bg_deep`.

**Log** is the default landing screen after first-run. Pressing `⌘/Ctrl+K` anywhere in the app focuses the Log form.

### 8.1.1 First Run screen — one-time setup

A single-column flow with three steps. No navigation chrome. Only partner branding once selected.

```
Step 1 — Select your organization
  ┌─────────────────────────────────────────────────┐
  │   Who are you logging hours for?                │
  │   [ Sector Growth              ▾ ]              │
  │                                                 │
  │   Don't see your org? Contact SapienEx support. │
  │                                                 │
  │                                  [ Continue → ] │
  └─────────────────────────────────────────────────┘

Step 2 — Connect your data repo (after Sector Growth theme applies)
  ┌─────────────────────────────────────────────────┐
  │  [Sector Growth logo]                           │
  │                                                 │
  │   Connect your GitHub data repo                 │
  │                                                 │
  │   You need a fine-grained Personal Access Token │
  │   scoped to your private data repo:             │
  │   sapienEx-AI/hours-data-sector-growth-<you>    │
  │                                                 │
  │   1. Open GitHub token settings ↗               │
  │   2. Name: hours-tracker                        │
  │   3. Repository access → only your data repo    │
  │   4. Permissions → Contents: Read and write     │
  │   5. Generate and paste below.                  │
  │                                                 │
  │   Consultant slug: [ prash                    ] │
  │   PAT:             [ github_pat_••••••••••••• ] │
  │                                                 │
  │                                  [ Connect → ]  │
  └─────────────────────────────────────────────────┘

Step 3 — First-time repo check
  - If repo is empty: app offers to scaffold profile.json + empty projects/rates files.
  - If repo has data: app loads it, lands on Dashboard.
  - If repo exists but partner_id mismatch: hard error, refuses to continue.
```

**How the data repo URL is derived:** the consultant types their slug (e.g., `prash`) and the app computes the full repo path as `sapienEx-AI/<partner.data_repo_prefix><slug>` (e.g., `sapienEx-AI/hours-data-sector-growth-prash`). The consultant never types the full path — the partner prefix is authoritative and the slug is the only degree of freedom. If the computed repo doesn't exist, the app shows a clear "Repo not found — ask your partner admin to create it" message.

**Validation at Step 2:**
1. Computed repo path matches `sapienEx-AI/<partner.data_repo_prefix><slug>`.
2. `GET /repos/{owner}/{repo}` returns 200.
3. Token has write permissions (check with a dry-run API call or permissions endpoint).
4. If `config/profile.json` exists, `profile.partner_id` matches the selected partner AND `profile.consultant_id` matches the entered slug.

**Persistence:** on success, write to localStorage:
```
sapienex:hours-tracker:partner_id = "sector-growth"
sapienex:hours-tracker:consultant_slug = "prash"
sapienex:hours-tracker:data_repo = "sapienEx-AI/hours-data-sector-growth-prash"
sapienex:hours-tracker:token = "github_pat_..."
```

### 8.2 Quick Log screen

Single column form, keyboard-first:

| Field | Default | Behavior |
|---|---|---|
| Project | last used | Searchable dropdown of active projects. Typing filters. Enter selects. |
| Date | today | Date picker, left/right arrow keys nav days. |
| Hours | empty | Number input + preset chips: `0.25 0.5 0.75 1 1.5 2 3 4`. Clicking a chip fills. |
| Bucket | none (unbucketed) | Dropdown of active buckets in the selected project, or "(none — general billable)". |
| Status | billable | Radio: Billable / Non-billable / Needs review. Auto-locks to Billable and greys out if a bucket is selected. |
| Rate | inherited from project/global | Number input. Below: small text showing `source: Sprosty default` / `Global default` / `Override`. Editing switches source to `Override` and stores the new value as a snapshot on the entry. |
| Description | empty | Multiline text, 500 char limit, visible counter. |

**Save:** `⌘↵` commits via Octokit. On success, form resets all fields *except project* and shows a toast `Logged 4.0h to Sprosty`. On failure, the form stays populated and shows an error banner with the GitHub API error.

**Validation before save:**
- Required: project, date, hours, status, description (non-empty).
- Validate against `entries.schema.json` client-side before sending to GitHub.
- Compute the entry id and ensure it's unique within the target month file.

### 8.3 Dashboard

The dashboard shows the **currently selected month** (default: current month).

```
─── April 2026 ─────────────────────── [← March] [May →]
  Billable       42.50h      $6,375.00
  Non-billable    8.25h
  Needs review    3.00h
  ──────────────────────────
  Total          53.75h

─── Per project ──────────────────────────────────────────
  Sprosty          18.0h   $1,800.00    [see buckets ▸]
  Bayard           11.5h   $1,725.00
  Shannex           8.0h   $1,200.00
  ...

─── Needs review queue ───────────────────────────────────
  3 entries flagged for review                [Review all →]
```

Clicking a project expands to show bucket consumption and a mini entry list.

### 8.4 Entries screen

A filterable, sortable table of all entries across all time. Filters: project, bucket, date range, billable status, review flag. Each row is clickable → opens an edit modal with the same form as Quick Log pre-filled. Supports bulk selection + bulk delete (with confirmation).

### 8.5 Projects & Buckets screen

List of projects. Clicking a project opens a detail view with its buckets. CRUD on both. Creating a project only requires a name and slug; all other fields have defaults. Closing a bucket requires confirmation. Deleting a project is blocked if any entries reference it (you must archive instead).

### 8.6 Rates screen

Read-only history table of `default_rate_history`. "Add rate" button prompts for rate + effective date + note, appends to the history. Bulk rate update tool lives here as a separate action — click opens a dialog with filter builder, preview (diff of changed entries + total delta), and confirm.

### 8.7 Snapshots screen

List of closed months with their totals and drift indicator. Clicking a row shows the snapshot detail + "View diff" if drifted. "Close current month" button is prominently placed and disabled if current month is today (nudges you to wait).

### 8.8 Settings screen

- Data repo path (read-only after first setup)
- Token management (update token, clear token and sign out)
- Schema version of local data vs app
- Theme (light/dark/system)
- "About" with app version and GitHub link

---

## 9. March 2026 import

A **one-time import script** (not an in-app feature) parses your Apple Notes content into `entries/2026-03.json`. Approach:

1. Script lives at `scripts/import-march-2026.ts` in the app repo. Takes the raw notes text as input.
2. Regex per line: `<project> - <date> [- <hours>hr] [(billing?)/(not billing)/(billing)] - <description>`.
3. Normalizes project names to slugs (`Sprosty` → `sprosty`, `Pickleplex` → `pickleplex`, `Internal` → `internal`, `Sparc BC`/`SparcBC` → `sparc-bc`, `Tech Lead` → `tech-lead`, `Pre-sales` → `pre-sales`, `BlueJLegal` → `bluej-legal`).
4. Maps annotations:
   - `(not billing)` → `billable_status: non_billable`
   - `(not billing?)`, `(billing?)` → `billable_status: needs_review`
   - No annotation → `billable_status: billable`
5. Parses rate overrides: `(at $20 hourly rate)` → `rate_cents: 2000`, `rate_source: entry_override`.
6. For entries without a rate override: resolves rate from project/global defaults using `resolveRateAtLogTime` at the entry's date.
7. Generates IDs: `YYYY-MM-DD-<project-slug>-<6-hex>`.
8. Sets `created_at = updated_at = 2026-04-11T00:00:00Z` (import timestamp) — the log-time is unknown.
9. Writes to a local `2026-03.json` file.
10. **User manually reviews the file in-app** before committing. The app offers an "Unpushed import preview" mode that loads the local file, shows all entries in the Entries view with an "Import" banner, and has a single "Commit to repo" button.
11. Hand-verifies a sample of entries. On approve, app commits as `import: 2026-03 from Apple Notes (N entries)`.

March import is also used as the **golden fixture** for calculation testing (§7.2). The expected totals for March are hand-computed by Prash once and stored as `tests/fixtures/2026-03-expected.json`. These never change and every build re-verifies.

---

## 10. Proposed tech stack

| Concern | Choice | Rationale |
|---|---|---|
| Build | **Vite** | Fast, simple, perfect for static deploy |
| Language | **TypeScript** (strict) | Catches data-model errors at compile time |
| UI framework | **React 18** | Largest training-data surface for subagent-driven development |
| Styling | **Tailwind CSS** | Fast iteration, elegance comes from utilities |
| State | **Zustand** | Tiny, no ceremony, plays well with Octokit |
| Data fetching | **@tanstack/react-query** | Cache GitHub API responses, optimistic updates |
| GitHub API | **@octokit/rest** | Official, well-documented |
| Schema | **ajv** + **json-schema** | Client-side + data-repo CI validation |
| Testing | **Vitest** + **fast-check** | Unit, integration, and property-based |
| Integer math | Custom `src/calc/int.ts` | No big-number library needed; hundredths + cents are small integers |
| Linting | **ESLint** + custom rule for integer math | Enforces §7 layer 6 |

*All dependencies are pinned to exact versions. Renovate/Dependabot is configured but auto-merge is off — every bump is reviewed.*

---

## 11. Data integrity — the defense-in-depth summary

A summary of the overlapping guards on data integrity. Any one of these would be meaningful; together they make corruption extremely unlikely without at least one failing loudly.

1. **Schema validation before every write** (client-side, ajv).
2. **Data-repo CI validation** on every push (`.github/workflows/validate.yml`).
3. **Invariants enforced in the calc module** (§7 layer 5).
4. **Property-based tests** for mathematical correctness.
5. **Golden-file tests** for real-data correctness.
6. **Multi-agent review gates** at three implementation milestones.
7. **Integer-only arithmetic** for money and hours.
8. **Snapshot hash verification** for historical drift detection.
9. **Structured commit messages** for forensic auditability.
10. **Git itself** as the underlying immutable version store — every change is reversible.
11. **Optimistic-concurrency sha checks** to prevent silent overwrites.
12. **Never-silently-discard policy** on write failures — always surface, never swallow.

---

## 12. Known constraints and trade-offs

- **No real-time sync across devices.** If you open the app on two devices simultaneously and log on both, the second write sees the updated sha from the first and retries cleanly — no data loss but occasional UI refresh. This is acceptable for one writer.
- **PAT setup is a manual step** (see §6.1). This is the price of zero backend.
- **GitHub API rate limits** (5,000 requests/hour authenticated). The app caches aggressively via `react-query` and batches where possible. Realistic use (10–50 writes/day) is nowhere near the limit.
- **First-time load performance.** Every app load fetches entries/config from GitHub. Cached in `react-query` with a `staleTime` that keeps sessions snappy, revalidates on focus.
- **No offline logging for MVP.** If GitHub API is unreachable, the app shows a banner and refuses writes. Offline queue + replay is a possible v2 feature.

---

## 13. Resolved decisions (formerly "open questions")

All initial open questions have been resolved:

| # | Question | Resolution |
|---|---|---|
| 1 | Tech stack (§10) | **Confirmed:** React + TS + Tailwind + Zustand + TanStack Query + Octokit + ajv + Vitest + fast-check. Explicitly chosen for AI-native maintainability via React's large Claude training surface. |
| 2 | Auth mechanism (§6.1) | **Confirmed:** fine-grained PAT stored in localStorage. Explained in depth to user; accepted. Clean upgrade path via `TokenProvider` interface if OAuth is added later. |
| 3 | Project slugs | **Confirmed seed set:** `sprosty`, `shannex`, `axiom`, `bayard`, `truvista`, `pickleplex`, `sparc-bc`, `sterling`, `tech-lead`, `bluej-legal`, `pre-sales`, `image-lift`, `internal`. Projects are editable in the app, so this is just the seed. |
| 4 | Default rate + currency | **Confirmed:** `$125 CAD/hr`, effective from `2026-04-11` (the project start date). Currency stored on partner config, not per-entry. |
| 5 | App URL | **Confirmed:** `https://sapienex-ai.github.io/hours-tracker/` for MVP. Custom domain deferred to post-launch. |
| 6 | Partner branding (Sector Growth) | **Confirmed:** theme colors, fonts, and logo sourced from `oh-tap/consulting/sector-growth/booking/assets/` and `template/styles.css`. Colors in §5.1. Fonts: Space Grotesk / Inter / JetBrains Mono. Dark theme default. No ambient decoration (clarity > flourish for a productivity tool). |

---

## 14. What this spec does **not** yet cover (deferred to implementation plan)

- Precise file-by-file task breakdown — that's the implementation plan's job.
- Exact React component hierarchy and prop shapes.
- Precise JSON Schema documents (field-level `$ref`s, enums, etc.) — these are mechanical from §5.
- Precise React component visual design and spacing — frontend-design skill produces this during implementation.
- Deployment workflow YAML content — standard Vite + GH Pages template.

---

## 15. AI-native workflow requirements

This project will be maintained primarily by Claude Code subagents over its lifetime. Every design decision below is optimized for that fact: code that Claude can reliably understand, edit, and extend without drifting from the spec.

### 15.1 `CLAUDE.md` at repo root (authoritative)

The root `CLAUDE.md` is the single source of truth for "how to work on this codebase". Every subagent reads it on session start. Contents:

1. **Project purpose** (one paragraph, links to this spec).
2. **Non-negotiable invariants** — pulled from §5 (data model) and §7 (calc):
   - All money in cents; all hours in hundredths; never `number` arithmetic on these fields except via `src/calc/int.ts`.
   - Every write goes through a schema validator before touching GitHub.
   - Every commit uses a structured message (§6.3).
   - Partner logo is **always** primary; SapienEx attribution is **always** footer-only.
   - `profile.partner_id` is validated against partner config on every load.
3. **Do-not-touch list** — files with high blast radius and extra review expectations:
   - `src/calc/**` (requires re-running property tests + golden tests + re-requesting calc review per §7.2 Gate policy)
   - `schemas/**` (schema changes require a `schema_version` bump and migration notes)
   - `public/partners/<partner-id>/partner.json` (partner-facing, needs partner approval)
4. **Run commands** — every command Claude might need, copy-pasteable:
   ```
   npm install              # deps
   npm run dev              # local dev server
   npm run typecheck        # tsc --noEmit
   npm run lint             # eslint + custom integer-math rule
   npm test                 # vitest: unit + property + golden
   npm run test:golden      # just the golden-file suite
   npm run build            # production build
   npm run preview          # preview the production build locally
   npm run import:march     # run the March 2026 importer
   npm run new-partner      # interactive partner scaffolder
   ```
5. **Where to find things** — quick map of key files and what they do. Mirrors the §4.1 tree.
6. **Testing expectations** — what tests must pass before any change is considered complete. Explicitly includes: property tests, golden-file tests, unit tests, lint, typecheck.
7. **Common tasks and their recipes** — the "how do I add a new field to an entry?" style playbook. See §15.5.
8. **What to ask the human** — when a subagent hits a decision that requires human judgment (schema bumps, currency changes, partner onboarding), explicitly *stop and ask*.

### 15.2 Per-module `README.md` files

Every directory under `src/` has a `README.md` answering three questions in under 200 words:

- **What does this module do?** (one paragraph)
- **What is its public API?** (bullet list of exported functions/types)
- **What are its invariants and dependencies?** (numbered list)

Example: `src/calc/README.md` states that `calc` is pure, has no I/O, depends only on types from `src/schema/`, and enumerates every invariant it enforces.

### 15.3 File size and shape discipline

- **Max file size: 300 lines.** Enforced by lint warning. Large files become harder for Claude to hold in context and edit reliably. A 400-line component is a sign it should split into 2–3 files with a clear parent.
- **Max function size: 50 lines.** Soft rule. Enforced by review, not lint.
- **Max cyclomatic complexity: 10 per function.** Enforced by `eslint-plugin-complexity`.
- **One concept per file.** A file named `rates.ts` does rate math; it does not also have date parsing helpers. Shared helpers go in dedicated utility modules.
- **Explicit exports only.** No wildcard re-exports (`export * from ...`) except at a module's `index.ts` barrel file. Wildcard exports obscure what a module offers and make it harder for Claude to reason about public API.

### 15.4 Tests as executable documentation

- **Every test name is a full sentence** describing the behavior being verified, e.g., `"computeMonthTotals returns zero for a month with no entries"` or `"a bucket-tagged entry uses the bucket's rate override when set"`. Reading the test file should read like a requirements document.
- **No shared mutable test fixtures.** Each test owns its inputs. Copy-paste over "DRY" when it helps readability.
- **No mocks for the calc module.** Calc is pure, so tests call it with real inputs. Mocks are reserved for the Octokit boundary (integration tests).
- **`tests/calc/property.test.ts` uses the exact invariant names from §7.2** as test descriptions. This creates a traceable link from spec to code.

### 15.5 `docs/architecture/` playbooks

`docs/architecture/` contains short, task-focused guides for common change types. Each guide is ≤200 lines and ends with a checklist a subagent can literally tick off:

- `data-flow.md` — end-to-end trace of a hour-log write, from form submit to commit to cache update.
- `calc-invariants.md` — the full list of calc invariants with cross-references to tests that verify each.
- `partner-onboarding.md` — step-by-step recipe for adding a new partner (create folder, write JSON, commit logo, update `partners/index.json`, test locally).
- `adding-a-field.md` — recipe for adding a new field to any schema (bump `schema_version`, update schema file in both repos, update validators, update calc if relevant, update tests, write a migration note).
- `rate-change-sop.md` — recipe for changing your default rate (forward-only) vs. bulk retroactive change.

### 15.6 `AGENTS.md` symlink

`AGENTS.md` is a symlink to `CLAUDE.md` at the repo root. Cursor, Aider, Codex, and other AI tools that look for `AGENTS.md` instead of `CLAUDE.md` automatically pick up the same guide. One source of truth, zero drift.

### 15.7 Structured commit messages (Claude-parseable)

Commit messages follow the convention in §6.3 so that `git log --oneline` is both human and machine readable. A subagent reviewing the last 50 commits can parse intent without opening diffs — e.g., `bulk-edit: apply $175 rate to 22 entries matching {project: Sprosty, date: >= 2026-04-01}` tells the story completely.

### 15.8 No metaprogramming, no magic

- No decorators, no reflection, no runtime type generation, no dynamic imports in production paths, no prototype manipulation.
- No string-keyed dispatch tables hiding control flow ("the feature is handled by a handler lookup that exists only at runtime").
- Boring, explicit, greppable code. A Claude subagent must be able to find what handles any user action in under 30 seconds of grepping.

### 15.9 Dependency discipline

- Pin exact versions in `package.json` (no `^` or `~`).
- Renovate/Dependabot configured, **auto-merge off**. Every upgrade is a human-or-subagent review.
- Minimum dependency count — if a package is under 50 lines, copy it in and own it, don't take the dep.
- No transitive dep audits skipped; `npm audit` must pass in CI.

### 15.10 Claude Code as a first-class user, not an afterthought

The acceptance criterion for this project is not just "it works for Prash" but **"a fresh Claude Code session, given only this repo and this spec, can implement a new feature correctly without human debugging."** Every doc, test, README, and comment is written with that reader in mind.
