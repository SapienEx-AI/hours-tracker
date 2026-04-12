# Scaffolding a new data repo

Each consultant has their own private data repo at `sapienEx-AI/hours-data-<partner-id>-<consultant-slug>`. This is a short guide to creating one.

## One-time setup (per consultant)

1. **Create the repo** under the `sapienEx-AI` org.
   - Name: `hours-data-sector-growth-<your-slug>`
   - **Private** visibility
   - Initialize with README
2. **Clone locally:**
   ```sh
   git clone git@github.com:sapienEx-AI/hours-data-sector-growth-<you>.git
   ```
3. **Scaffold initial files** using `scripts/scaffold-data-repo.sh` (from the hours-tracker repo):
   ```sh
   HOURS_TRACKER_REPO=/path/to/hours-tracker ./scripts/scaffold-data-repo.sh <your-slug> "<Display Name>"
   ```
   This writes:
   - `config/profile.json` — `partner_id=sector-growth`, your slug, display name, Toronto timezone
   - `config/projects.json` — seeded from spec §13 project list
   - `config/rates.json` — seeded with $125 CAD effective 2026-04-11
   - `.gitignore`
   - `schemas/*.json` — frozen copies
   - `.github/workflows/validate.yml` — ajv validation on every push
   - `README.md`
4. **Review, commit, and push.**
5. **Generate a fine-grained PAT** at `github.com/settings/personal-access-tokens/new`:
   - Repo access: only this data repo
   - Contents: Read and write
   - Expiration: up to 1 year
6. **Open** `https://sapienex-ai.github.io/hours-tracker/`, complete the first-run flow, paste the PAT.

## What lives in the data repo

See spec §4.2 for the full layout. In short:
- `config/` — profile, projects, rates
- `data/entries/YYYY-MM.json` — monthly entries (the hot data)
- `data/snapshots/YYYY-MM.json` — immutable closed-month snapshots
- `schemas/` — frozen schema copies from the app repo
- `.github/workflows/validate.yml` — ajv validation on every push
