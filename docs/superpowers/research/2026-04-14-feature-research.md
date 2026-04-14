# Hours Tracker — Feature Research

**Date:** 2026-04-14
**Status:** Exploration (not a spec). Use this to pick one or more features to take through the normal brainstorm → design → plan flow.
**Input:** "Research different ways to make this application more useful for performance and hours tracking, for tenants (agencies like Sector Growth) that hire contractors, plus AI-centric ideas that use our data in unique ways."

> **Update 2026-04-14 (revision 2):** Reconciled against recently-shipped Phase A (CSV export, ⌘K, needs-review queue, bucket CRUD, bulk rate, snapshot list+drift) and Phase B+C (Log screen 2-column redesign + Google Calendar integration with schema v2 `source_event_id`). Items affected are marked **[SHIPPED]** or **[PARTIAL]** inline. The Calendar integration is now the architectural precedent for any external-data-source suggestion feature, including the desktop activity agent.

## 1. Context & constraints

**What we have in the schema today:**

- **Entries** — per-consultant, per-month: date, hours (hundredths), rate (cents), rate source, billable status, project, bucket, free-text description, review flag, timestamps.
- **Projects** — name, client, active flag, internal flag, default rate, plus **buckets** (typed as `hour_block`, `discovery`, `arch_tl`, `dev`, `custom`) with budgeted hours, status lifecycle (`active` → `closed` → `archived`), opened/closed dates, and per-bucket invoice log.
- **Rates** — global default, with history.
- **Snapshots** — immutable monthly closeouts with totals, per-project, per-bucket consumed vs budgeted, and the set of entry IDs.
- **Partner config** — agency branding, theme, partner_id validated on every load.

**Architectural reality today:** Each consultant owns a private data repo. The agency (partner) provides branding and rates but has no visibility into consultant data. The app is static, runs from GH Pages, writes directly to GitHub via Octokit.

**User's stated openness (Option C):** Any architecture is on the table, including a backend, an aggregation layer, new repos, or MCP servers — as long as the idea is compelling enough.

## 2. Three lenses

Every idea below is tagged with the audience it primarily serves:

- **[C] Contractor** — makes the individual consultant more effective or happier.
- **[A] Agency** — gives the tenant (Sector Growth, etc.) visibility, control, or revenue lift.
- **[AI] AI-native** — uses accumulated data in ways that need an LLM or ML model.

Effort is **S / M / L / XL** (eyeball estimate, not a commitment). Architecture impact is **in-scope** (fits current model), **aggregation-needed** (requires cross-repo roll-up), or **backend-needed** (breaks static model).

---

## 3. Contractor-facing features [C]

These sharpen the individual experience. Most fit the current architecture.

### 3.1 Self-insight & performance

| # | Idea | Value | Effort | Arch |
|---|---|---|---|---|
| C1 | **Utilization dashboard** | Billable vs non-billable ratio by week/month with a goal line (e.g. "75% billable target"). The most-asked-for freelancer metric. | S | in-scope |
| C2 | **Effective hourly rate per project** | Account for non-billable overhead attributable to a client (admin, follow-up). Reveals which clients are actually profitable. | M | in-scope |
| C3 | **Bucket burn runway** | Per bucket: "at your 14-day velocity, budget runs out April 28". More actionable than a percent-consumed bar. | S | in-scope |
| C4 | **Context-switching heatmap** | Count project switches per day. Research says switch-cost is ~20-40% of productive time; making it visible changes behavior. | S | in-scope |
| C5 | **Energy pattern analyzer** | What hour-of-day and day-of-week do you log most deeply (long sessions, billable work)? Helps schedule deep work. | M | in-scope |
| C6 | **Goal tracker** | Annual/quarterly revenue and hours targets with progress bars and pacing signals. | S | in-scope |
| C7 | **Tax & reserve ledger** | Auto-compute estimated tax set-aside per billable entry (configurable %) and show running reserve balance. Huge for 1099s. | M | in-scope |
| C8 | **"What-if" rate modeling** | Slider: "what if my default rate was $X" — re-cost last 90 days. Informs rate conversations. | S | in-scope |

### 3.2 Logging ergonomics

| # | Idea | Value | Effort | Arch |
|---|---|---|---|---|
| C9 | **Timer mode** | Start/stop timer that becomes an entry (Pomodoro optional). Captures time that would otherwise get lost to reconstruction. | S | in-scope |
| C10 | **Calendar-import suggestions** **[SHIPPED]** | Read Google Calendar events, suggest pre-filled entries. User accepts/edits/rejects. Shipped Phase C: browser-native OAuth (GIS), multi-calendar support, click-to-prefill on Log screen, persistent dedupe via Entry `source_event_id` (schema v2). Establishes the pattern every future external-source suggestion feature should mirror. | — | in-scope |
| C11 | **Git activity import** | Infer hours from commits and PR activity across linked repos. Guardrails: suggestions, not auto-log. | M | in-scope (GitHub only) |
| C12 | **End-of-day catch-up prompt** | At a configured time, show "you have X unlogged hours today — here's a draft from your calendar + git + activity agent". | S | builds on C10 (shipped) + C11 + activity agent |
| C13 | **Voice entries** | PWA mic button → Whisper (or browser SR) → parsed entry. Kills the friction of typing on mobile. | M | requires LLM; can be free-tier |
| C14 | **Bulk entry editor** **[PARTIAL]** | Spreadsheet-style edit across a range of dates/projects. Note: Phase-A bulk *rate* update exists (filter + preview + apply, one `bulk-edit:` commit per affected month); bulk *entry* editing still unbuilt but now has a UI precedent. | M | in-scope |
| C15 | **Recurring-work templates** | "Every Monday 9-10am, log 1h Sector Growth standup" — generate stub entries that need confirmation. | S | in-scope |
| C16 | **Missing-day detector** | Flag dates with no entry in configured working windows. Surface as a badge on a dashboard calendar view. (Feeds the dashboard-calendar feature user picked.) | S | in-scope |

### 3.3 Financial & tax-season utilities

| # | Idea | Value | Effort | Arch |
|---|---|---|---|---|
| C17 | **Year-end 1099 summary** | Per-client billable totals + hours, formatted for tax prep. (Generic CSV export shipped Phase A; 1099-specific preset still unbuilt.) | S | in-scope |
| C18 | **Retainer balance ledger** | For hour-block buckets pre-paid by clients: show remaining balance, burn history, refill alerts. | S | in-scope (we already have invoices per bucket) |
| C19 | **Late-invoice detector** | Invoices recorded against bucket but no payment logged → aging report. Requires a payment/paid field addition. | M | schema change |

---

## 4. Agency / partner features [A]

This is where the tenant-value story lives. **Most of these need aggregation across consultant repos** — either via shared read access, opt-in snapshot pushes to an agency repo, or a real backend. Pick an architecture early; it gates everything below.

### 4.1 Aggregation architecture options (prerequisite)

Before any [A] feature is real, one of these has to be chosen:

- **Option A — Shared-read GitHub org.** Agency owns a GitHub org, consultant repos live inside with org members having read. Aggregation is a browser-side fan-out: read N repos, compute. **Pros:** no backend. **Cons:** slow at scale (10+ consultants means 10+ API calls per dashboard load), rate limits, consultant feels less in control.
- **Option B — Opt-in snapshot push.** Each consultant's monthly snapshot is also pushed (via GH Action or manual publish) to an agency-owned repo. Agency app reads a single repo. **Pros:** static, simple, real-time-ish. **Cons:** agency sees only closed months unless we also push live summaries.
- **Option C — Lightweight backend.** A small server (Cloudflare Worker + KV, or a single Postgres) that agency-authorized consultants sync to. Agency gets real-time aggregation. **Pros:** unlocks everything. **Cons:** breaks pure-static, introduces infra + auth.
- **Option D — Hybrid.** Keep writes static (per-consultant repos), add a read-only indexer (Cloudflare Worker cron) that pulls snapshots + live summary files and exposes a single JSON for the agency dashboard. Best of A and B with less pain than C.

**Recommendation if you go here:** **Option D** is the lowest-risk unlock. Snapshot+summary files are already immutable, so the indexer is stateless and cheap.

### 4.2 Team visibility

| # | Idea | Value | Effort | Arch |
|---|---|---|---|---|
| A1 | **Agency dashboard** | Team roster with billable/non-billable % per consultant, current-month hours, utilization. The baseline agency view. | M | aggregation-needed |
| A2 | **Live project view** | Across all consultants on a project: real-time bucket consumption, who's logging what, budget health. | M | aggregation-needed |
| A3 | **Bench / capacity planner** | For each consultant: current committed hours next 4 weeks vs. target. Who has bandwidth for the next project? | M | aggregation + consultant-side capacity signal |
| A4 | **Budget alerting** | Webhook/email/Slack when a bucket crosses 75% / 90% / 100%. | S | any aggregation option |
| A5 | **Stale-entry alerts** | Consultant hasn't logged in N days → nudge. Works either as consultant self-nudge or agency signal. | S | aggregation-needed for agency view |

### 4.3 Billing & client-facing

| # | Idea | Value | Effort | Arch |
|---|---|---|---|---|
| A6 | **Invoice generator** | From bucket state + entries, generate a branded PDF invoice. One-click to mark invoiced in the invoice log. | L | in-scope (per-consultant) or aggregation (agency-level) |
| A7 | **Client portal** | Read-only branded view for the client: their projects, budgets, progress, recent activity, with agency branding. | L | backend or signed-URL static export |
| A8 | **Monthly client report** | Branded PDF: hours by bucket, highlights, budget status, optional AI narrative (see AI13). | M | in-scope per-consultant; aggregation for multi-consultant projects |
| A9 | **Approval workflow** | Consultant submits month-end → agency approves → locked snapshot → invoice. Maps neatly onto current snapshot concept. | M | aggregation-needed |
| A10 | **Margin dashboard** | If agency also stores cost rate per consultant, show revenue − cost per project/consultant/month. | M | schema + aggregation |

### 4.4 Onboarding & operations

| # | Idea | Value | Effort | Arch |
|---|---|---|---|---|
| A11 | **One-click consultant onboarding** | Agency admin invites a consultant → scaffolds their data repo, pre-seeds partner config, emails setup link. Removes the most painful friction today. | M | needs an agency admin surface |
| A12 | **Multi-partner consultants** | A contractor works for both Sector Growth and Acme. Their single data repo carries per-partner tags on entries/projects. | M | schema change |
| A13 | **Rate-book management** | Agency defines rate cards (bucket type × seniority tier × client). Consultants' default rate pulls from it. | M | in-scope + schema |
| A14 | **Policy packs** | Agency-configured policies: "require description >20 chars", "non-billable categories must be one of [admin, BD, learning]", etc. Enforced client-side. | S | schema/partner config |

### 4.5 Performance & people

| # | Idea | Value | Effort | Arch |
|---|---|---|---|---|
| A15 | **Quarterly review pack** | One-click: consultant's Q-by-Q hours, billable %, project mix, client feedback (if captured), shipped artifacts. | M | aggregation-needed |
| A16 | **Skill mix map** | Classify entries by work type (design, dev, PM, QA) via description; show each consultant's work-type histogram. Reveals hidden specialties. | L | needs AI (see AI8) |
| A17 | **PTO & unavailability** | Contractor marks planned off-time. Folds into A3 capacity and A9 forecasting. | S | schema addition |

---

## 5. AI-native features [AI]

The most differentiated ideas. Grouped by what kind of AI work is needed, ordered roughly by value-to-effort.

### 5.1 Input/capture (make logging disappear)

| # | Idea | What it does | Effort | Model class |
|---|---|---|---|---|
| AI1 | **Natural-language entry** | "Spent the morning on the Sector Growth architecture doc" → parses project, estimated hours, bucket, billable. Confirm-before-commit. | M | small LLM (Haiku) |
| AI2 | **Smart autocomplete** | As you type a description, show "usual completion" based on embeddings of past entries for the same project/bucket. | M | embeddings + retrieval |
| AI3 | **Day reconstructor** | Given calendar (shipped) + git activity + activity-agent + a rough text, AI drafts the full day's entries. Foundation partly built: Log screen's suggestion column + schema-v2 `source_event_id` already model "external-source-derived entry". Agent adds one more provider to the same pipeline. | L | LLM + tool use |
| AI4 | **Description quality coach** | Rate description specificity on commit. "`worked on stuff` gives your future self nothing — how about `drafted the /users POST endpoint spec`?" Inline, non-blocking. | S | LLM |
| AI5 | **Description normalizer** | Expand abbreviations, fix typos, keep voice intact. Applied on save, fully reversible. | S | LLM |

### 5.2 Insight (the data you already have, made legible)

| # | Idea | What it does | Effort | Model class |
|---|---|---|---|---|
| AI6 | **Weekly/monthly narrative** | "Last week: 27h across 3 projects. You shipped X and Y on Sector Growth. Non-billable crept up to 35% — mostly internal meetings. Target for next week: cap admin at 10%." Ships as a digest. | M | LLM over snapshots |
| AI7 | **Anomaly detector** | 14h day, three project-switches on a Sunday, a description that doesn't semantically match the project it was logged under. Flagged for review, not blocked. | M | rules + embeddings |
| AI8 | **Work-type classification** | Cluster entries by what the work actually is: design, build, meeting, QA, admin, learning, BD. Reveals the invisible overhead. Feeds A16 and C-level insights. | M | LLM classifier + caching |
| AI9 | **Semantic search** | "When did I work on the migration script?" / "All entries mentioning OAuth." Works across months and projects. | M | embeddings + vector index (can be static, precomputed) |
| AI10 | **Effective-rate explainer** | Not just "your ER on this project is $X" but *why*: "Meetings pulled it down 18%; you logged 4h of free scope negotiation on April 3-5." Prose, with sources. | M | LLM + calc |
| AI11 | **Meeting-to-making ratio** | Classify descriptions as "meeting/call/sync" vs "made/built/wrote/designed". If the ratio inverts for a project, flag it. | S | LLM or even rules |

### 5.3 Forecasting & planning

| # | Idea | What it does | Effort | Model class |
|---|---|---|---|---|
| AI12 | **Burn-rate forecaster** | Better than linear: accounts for day-of-week seasonality, project phase (discovery burns slower than dev), upcoming PTO, bucket lifecycle. | M | small ML or LLM-as-judge |
| AI13 | **Project-scope planner** | "New project like this (brief paste)?" AI retrieves similar past projects from your history, suggests bucket structure + budget. Calibrated on your actual deliveries. | L | embeddings + retrieval + LLM |
| AI14 | **Staffing recommender (agency)** | Given a new engagement description: who on the team has capacity and has done this kind of work before? Uses AI8 skill mix + A3 capacity. | L | retrieval + scoring |
| AI15 | **Revenue forecasting** | Expected next-30-days revenue given pipeline + current velocity + historical close-out patterns. | M | ML |

### 5.4 Output & delivery

| # | Idea | What it does | Effort | Model class |
|---|---|---|---|---|
| AI16 | **Invoice line-item writer** | Convert raw entries to client-facing invoice descriptions: aggregate related entries, professional tone, strip internal jargon. Editable draft. | M | LLM |
| AI17 | **Client status narrative** | Monthly auto-draft: "April update — team delivered the auth migration and the admin console refresh; budget is 62% consumed on Discovery; key risk: integration slipping by 1 week." Reviewable. | M | LLM over snapshots |
| AI18 | **Project retrospective** | On bucket close: "Where did the 127h actually go? What was under/over-budgeted? What patterns repeated from past projects?" | M | LLM |
| AI19 | **Proposal draft generator** | Inbound lead description → retrieve 3 most-similar past projects → draft a scope proposal with hours estimate and bucket breakdown. | L | retrieval + LLM |

### 5.5 The "chat with your hours" play

| # | Idea | What it does | Effort | Model class |
|---|---|---|---|---|
| AI20 | **Hours Tracker MCP server** | Ship an MCP server per consultant (and optionally per agency). Consultant pops it into Claude Desktop and asks "how many hours have I billed Sector Growth this year by bucket?" in natural language. Agency MCP aggregates. | M-L | MCP SDK + static server |
| AI21 | **In-app copilot** | Side panel chat over your own data: "close out March for Sector Growth", "show me projects where my ER was below $150", "generate this month's client update". Tool-using agent. | L | Claude API with tools |
| AI22 | **Voice assistant** | "Hey Hours Tracker, log 45 minutes of Sector Growth discovery with the note 'reviewed ERD with client'." Single-turn voice. | M | Whisper + LLM + confirm |

### 5.6 Cross-tenant (if you ever go multi-agency)

| # | Idea | What it does | Effort | Model class |
|---|---|---|---|---|
| AI23 | **Anonymous rate benchmarking** | Opt-in: aggregate rates across all SapienEx-hosted agencies by bucket type + seniority. Consultants learn "arch_tl at your tenure bills $X (median)." Privacy via differential-privacy noise. | L | aggregation + privacy math |
| AI24 | **Playbook library** | "Projects tagged as 'SaaS migration' in the corpus typically use this bucket structure and hit these pitfalls." Built from patterns across agencies. | L | retrieval + LLM |
| AI25 | **Burnout early-warning** | Trend: declining hours + tersening descriptions + rising non-billable + late-night logging → flag to agency for a check-in. Ethically fraught; gate behind explicit opt-in. | M | rules + LLM + DLP-style tact |

---

## 6. Cross-cutting platform capabilities

Not features in themselves, but enabling building blocks:

- **External-source suggestion pipeline [PARTIAL].** Google Calendar integration (shipped Phase C) established the pattern: OAuth / connection UI → poll external source → render suggestions in the Log screen right column → user clicks to prefill → entry persisted with `source_event_id` for dedupe. Any future source (git, activity agent, Jira, Slack) should plug into this pipeline rather than reinvent it. Minor generalization needed: rename the attribution field to `source_ref` (or add parallel fields) so multiple sources can coexist on one entry.
- **Write-time hooks.** Make certain operations (log, close-month, open-bucket) emit webhooks. Unlocks Slack/email/automation integrations without bespoke code per destination.
- **Integration adapter interface.** One interface for Calendar (shipped), GitHub, Slack, Jira, Linear, Harvest, QuickBooks. Each adapter implements `suggestEntries(range)` + optional `exportEntries()`.
- **Mobile-first PWA pass.** The app is already static; a focused mobile log screen (add-to-home-screen, offline queue) is cheap and dramatically increases capture rate.
- **MCP server as first-class surface.** The data is already well-schema'd JSON in git. Exposing it to an LLM via MCP is a small step that unlocks AI20/21 and is a unique marketing story ("your hours tracker speaks Claude").
- **Partner admin plane.** A simple agency-side UI for A11–A14. This is its own product surface and should be designed as one.

---

## 7. Recommended "hero" bets

If I had to pick the five features that would most sharpen the product without diluting focus, these are the ones I would pitch:

1. **Agency dashboard over Option D (indexed snapshots + summaries)** — A1 + A2 + A4. This single deliverable turns the app from a consultant tool into an *agency product*, which is what actually gets paid for. The indexer is small; the dashboard is table stakes.
2. **Natural-language entry + day reconstructor (AI1 + AI3) + timer (C9)** — The capture side is where most time-tracking products fail. Nailing frictionless entry is the moat.
3. **Monthly narrative + client report (AI6 + AI17 + A8)** — Turn accumulated data into a *deliverable to the client*. This makes every consultant look senior and gives the agency a branded artifact nobody else ships.
4. **MCP server (AI20)** — Small effort, huge differentiation. "Your hours data, conversational." Also quietly becomes the substrate for AI21 later.
5. **Semantic search + work-type classification (AI8 + AI9)** — The foundation for most deeper analytics (effective rate, skill mix, reviews). Worth building once and reusing.

Honorable mentions: **C7 (tax reserves)** is criminally underbuilt in competitor products and 1099s love it. **A11 (one-click consultant onboarding)** is unsexy but removes the biggest friction you have today.

## 8. What I would *not* build

Light signal, high noise, or low fit:

- **Leaderboards / gamification** — proven to reduce quality-of-logging and invite gaming.
- **Pixel-level activity tracking** (RescueTime-style) — philosophically wrong for a contractor tool; the premise is trust.
- **Deep Slack presence integration** — creepy and low-signal; people Slack at 2am and that doesn't mean they're working.
- **Auto-billable classification without a confirm step** — schema correctness beats convenience here.

## 8.5 Parked — Activity Monitoring (deferred 2026-04-14)

Explored in depth during the 2026-04-14 brainstorm; deferred as too large for near-term. Decisions reached — resume from here:

- **Privacy posture model:** configurable per-agency (research §4.1 option D). Stored on partner config. Tenants pick `self_coaching`, `aggregated`, or `full_monitoring`.
- **Sector Growth** is the first `full_monitoring` tenant.
- **Capture surface:** desktop agent only (no browser extension). Accepted gap: no URL-level detail for browsers; window titles best-effort only. Contractor ships for Mac + Windows.
- **Agent captures:** active app + bundle ID + window title, idle/active transitions, keystroke counts (aggregate, not content), mouse event counts. Per-minute sampling.
- **Deliverables (three separate repos/surfaces):**
  1. Hours Tracker app extensions: entry schema v3 (`source_ref` generalizing `source_event_id`), partner config privacy posture field, Log-screen "Activity" suggestion provider (plugs into existing Calendar pipeline), Settings > Activity Agent panel, new Agency dashboard route.
  2. Desktop agent — new repo. Proposed stack: **Rust + Tauri**. Cross-platform installer, code-signing (Apple + Windows EV), auto-update, menu-bar UI with pause and transparency panel.
  3. Backend — new infra. Proposed stack: **Cloudflare Workers + D1 + R2 + Queues**. Four Workers: `ingest`, `consumer`, `query`, `enroll`. R2 for raw events, D1 for rollups, Queues to absorb ingest bursts.
- **MVP leaning:** B+C bundle (full agent + agency dashboard + contractor suggestions from the same stream). Contractor suggestions are cheap given the calendar pipeline already exists.
- **Open when we resume:**
  - Does SapienEx already have cloud accounts (AWS/GCP) that would tilt backend choice away from CF?
  - Hard compliance requirements from Sector Growth (SOC 2, data residency)?
  - Contractor-count sizing for initial cost model.
  - Consent/legal review for jurisdictions Sector Growth operates in.

## 9. Next step

Pick a feature (or a bundle) from Section 7 or anywhere above. We'll take it through the normal flow:

1. Brainstorm it into a full design.
2. Write the spec to `docs/superpowers/specs/`.
3. Write the implementation plan to `docs/superpowers/plans/`.
4. Execute.

If you want, I can also produce a second-pass deep-dive on any *category* here (e.g., "go deeper on the AI-native features" or "design the Option D aggregation layer in detail") before we commit to a feature.
