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
   /path/to/hours-tracker/scripts/scaffold-data-repo.sh <your-slug> "<Display Name>"
   ```
   This writes:
   - `config/profile.json` — `partner_id=sector-growth`, your slug, display name, Toronto timezone
   - `config/projects.json` — seeded from spec §13 project list
   - `config/rates.json` — seeded with $125 CAD effective 2026-04-11
   - `.gitignore` (ignores `_schemas/` — fetched fresh by CI)
   - `.github/workflows/validate.yml` — fetches schemas from the app repo on every run, then ajv-validates
   - `README.md`
4. **Review, commit, and push.**
5. **Generate a fine-grained PAT** at `github.com/settings/personal-access-tokens/new`:
   - Repo access: only this data repo
   - Contents: Read and write
   - Expiration: up to 1 year
6. **Open** `https://sapienex-ai.github.io/hours-tracker/`, complete the first-run flow, paste the PAT.

## What lives in the data repo

See spec §4.2 for the full layout. In short:
- `config/` — profile, projects, rates, calendar
- `data/entries/YYYY-MM.json` — monthly entries (the hot data)
- `data/snapshots/YYYY-MM.json` — immutable closed-month snapshots
- `.github/workflows/validate.yml` — fetches schemas from the app repo and ajv-validates every push

The data repo deliberately does NOT carry its own copy of `schemas/*.json` — the app repo at `SapienEx-AI/hours-tracker` is the single source of truth, and the validate workflow pulls fresh schemas on each run via unauthenticated `raw.githubusercontent.com` access.

## Migrating an existing data repo to fetched schemas

If your data repo was scaffolded before the schemas-are-fetched-at-CI-time change, it has a stale local `schemas/` dir and a validate workflow that references it. To sync:

1. In the data repo, delete the local schemas dir:
   ```sh
   git rm -r schemas/
   ```
2. Replace `.github/workflows/validate.yml` with the current version — easiest is to re-run the scaffold script into a temporary directory and copy the generated workflow:
   ```sh
   mkdir -p /tmp/scaffold-tmp && cd /tmp/scaffold-tmp
   /path/to/hours-tracker/scripts/scaffold-data-repo.sh dummy "Dummy"
   cp .github/workflows/validate.yml /path/to/data-repo/.github/workflows/validate.yml
   cd /path/to/data-repo
   ```
3. Append `_schemas/` to `.gitignore` so the fetched schemas don't get committed:
   ```sh
   printf '\n# Schemas are fetched fresh by CI; never commit.\n_schemas/\n' >> .gitignore
   ```
4. Commit and push:
   ```sh
   git add -A && git commit -m "ci: fetch schemas from app repo instead of stale local copies" && git push
   ```

The next push triggers the new workflow; it fetches schemas, validates, and goes green. No schema drift possible from this point forward.
