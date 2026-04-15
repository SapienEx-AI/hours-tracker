#!/usr/bin/env bash
set -euo pipefail

SLUG="${1:-}"
DISPLAY="${2:-}"
if [[ -z "$SLUG" || -z "$DISPLAY" ]]; then
  echo "Usage: $0 <slug> <display-name>"
  echo "Example: $0 prash \"Prash\""
  exit 1
fi

mkdir -p config data/entries data/snapshots .github/workflows

# profile.json
cat > config/profile.json <<EOF
{
  "schema_version": 1,
  "partner_id": "sector-growth",
  "consultant_id": "$SLUG",
  "display_name": "$DISPLAY",
  "timezone": "America/Toronto",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# projects.json (seeded from spec §13)
cat > config/projects.json <<'EOF'
{
  "schema_version": 1,
  "projects": [
    {"id":"sprosty","name":"Sprosty","client":null,"active":true,"is_internal":false,"default_rate_cents":null,"buckets":[]},
    {"id":"internal","name":"Internal","client":null,"active":true,"is_internal":true,"default_rate_cents":null,"buckets":[]},
    {"id":"shannex","name":"Shannex","client":null,"active":true,"is_internal":false,"default_rate_cents":null,"buckets":[]},
    {"id":"axiom","name":"Axiom","client":null,"active":true,"is_internal":false,"default_rate_cents":null,"buckets":[]},
    {"id":"bayard","name":"Bayard","client":null,"active":true,"is_internal":false,"default_rate_cents":null,"buckets":[]},
    {"id":"truvista","name":"TruVista","client":null,"active":true,"is_internal":false,"default_rate_cents":null,"buckets":[]},
    {"id":"pickleplex","name":"Pickleplex","client":null,"active":true,"is_internal":false,"default_rate_cents":null,"buckets":[]},
    {"id":"sparc-bc","name":"Sparc BC","client":null,"active":true,"is_internal":false,"default_rate_cents":null,"buckets":[]},
    {"id":"sterling","name":"Sterling","client":null,"active":true,"is_internal":false,"default_rate_cents":null,"buckets":[]},
    {"id":"tech-lead","name":"Tech Lead","client":null,"active":true,"is_internal":true,"default_rate_cents":null,"buckets":[]},
    {"id":"bluej-legal","name":"BlueJ Legal","client":null,"active":true,"is_internal":false,"default_rate_cents":null,"buckets":[]},
    {"id":"pre-sales","name":"Pre-sales","client":null,"active":true,"is_internal":true,"default_rate_cents":null,"buckets":[]},
    {"id":"image-lift","name":"ImageLift","client":null,"active":true,"is_internal":false,"default_rate_cents":null,"buckets":[]}
  ]
}
EOF

# rates.json
cat > config/rates.json <<'EOF'
{
  "schema_version": 1,
  "default_rate_history": [
    { "effective_from": "2026-04-11", "rate_cents": 12500, "note": "Initial rate — $125 CAD/hr" }
  ]
}
EOF

# .gitignore
cat > .gitignore <<'EOF'
exports/
*.local
.DS_Store
EOF

# validate.yml — fetches fresh schemas from the app repo on every run so the
# data repo never carries a stale local copy. The app repo is public; no auth.
cat > .github/workflows/validate.yml <<'EOF'
name: Validate JSON

on:
  push:
  pull_request:
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - name: Fetch schemas from app repo
        run: |
          mkdir -p _schemas
          for s in partner profile rates projects entries snapshot calendar-config; do
            curl -fsSL \
              "https://raw.githubusercontent.com/SapienEx-AI/hours-tracker/main/schemas/${s}.schema.json" \
              -o "_schemas/${s}.schema.json"
          done
      - name: Install validator
        run: |
          npm init -y > /dev/null
          npm install ajv@8 ajv-formats@3 --save > /dev/null
      - name: Validate
        run: |
          node -e "
            const Ajv = require('ajv').default;
            const addFormats = require('ajv-formats').default;
            const fs = require('fs');
            const path = require('path');
            const ajv = new Ajv({ allErrors: true, strict: false });
            addFormats(ajv);
            const schemas = {
              profile: require('./_schemas/profile.schema.json'),
              projects: require('./_schemas/projects.schema.json'),
              rates: require('./_schemas/rates.schema.json'),
              entries: require('./_schemas/entries.schema.json'),
              snapshot: require('./_schemas/snapshot.schema.json'),
              calendar: require('./_schemas/calendar-config.schema.json'),
            };
            const validate = Object.fromEntries(
              Object.entries(schemas).map(([k, s]) => [k, ajv.compile(s)]),
            );
            const check = (file, kind) => {
              const data = JSON.parse(fs.readFileSync(file, 'utf8'));
              if (!validate[kind](data)) {
                console.error(file + ' FAILED:', JSON.stringify(validate[kind].errors, null, 2));
                process.exit(1);
              }
            };
            if (fs.existsSync('config/profile.json')) check('config/profile.json', 'profile');
            if (fs.existsSync('config/projects.json')) check('config/projects.json', 'projects');
            if (fs.existsSync('config/rates.json')) check('config/rates.json', 'rates');
            if (fs.existsSync('config/calendar.json')) check('config/calendar.json', 'calendar');
            if (fs.existsSync('data/entries')) {
              for (const f of fs.readdirSync('data/entries').filter((f) => f.endsWith('.json'))) {
                check(path.join('data/entries', f), 'entries');
              }
            }
            if (fs.existsSync('data/snapshots')) {
              for (const f of fs.readdirSync('data/snapshots').filter((f) => f.endsWith('.json'))) {
                check(path.join('data/snapshots', f), 'snapshot');
              }
            }
            console.log('All files valid against app-repo schemas.');
          "
EOF

# .gitignore addition for the ephemeral fetched schemas dir.
printf '\n# Schemas are fetched fresh by CI; never commit.\n_schemas/\n' >> .gitignore

# README
cat > README.md <<EOF
# hours-data-sector-growth-$SLUG

Private data repo consumed by \`sapienEx-AI/hours-tracker\`.
Do not edit by hand unless you know what you're doing.

See \`sapienEx-AI/hours-tracker/docs/architecture/data-repo-scaffold.md\` for the full setup guide.
EOF

echo "Scaffolded. Review, commit, push."
