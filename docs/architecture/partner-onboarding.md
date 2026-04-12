# Adding a new partner

Full recipe for onboarding a new partner (e.g., "Acme Consulting") to Hours Tracker.

## Prerequisites

- Partner name, display name, brand colors (primary, accent, bg, muted)
- Partner logo file (SVG or WebP preferred) and favicon
- Currency (ISO 4217 code, e.g., `USD`, `CAD`, `EUR`)
- Partner website URL

## Steps

1. **Create the partner folder.**
   ```sh
   mkdir public/partners/acme
   ```
2. **Copy logo + favicon** into the folder. Supported formats: `.webp`, `.png`, `.svg`.
3. **Write `public/partners/acme/partner.json`** following `schemas/partner.schema.json`. Use `public/partners/sector-growth/partner.json` as a template. Pay attention to:
   - `data_repo_prefix`: MUST match pattern `hours-data-<partner-id>-` (e.g., `hours-data-acme-`)
   - `theme.mode`: dark or light
   - `assets.logo_dark_filter`: CSS filter string if the logo needs inversion on dark bg; omit for light themes
4. **Register the partner** in `public/partners/index.json`:
   ```json
   {
     "schema_version": 1,
     "partners": [
       { "id": "sector-growth", "display_name": "Sector Growth", "enabled": true },
       { "id": "acme", "display_name": "Acme Consulting", "enabled": true }
     ]
   }
   ```
5. **Validate locally** before committing:
   ```sh
   npx tsx -e "
     import { validatePartner, formatValidationErrors } from './src/schema/validators';
     import { readFileSync } from 'node:fs';
     const data = JSON.parse(readFileSync('public/partners/acme/partner.json', 'utf8'));
     const r = validatePartner(data);
     if (r.ok) console.log('OK');
     else { console.error(formatValidationErrors(r.errors)); process.exit(1); }
   "
   ```
6. **Test in the dev server.** `npm run dev`. Open first-run flow. Verify Acme appears in the dropdown. Select it. Verify branding applies (logo, colors, fonts, title, favicon).
7. **Commit** with message: `partner: onboard Acme Consulting`.
8. **Create the first consultant data repo** under `sapienEx-AI/hours-data-acme-<consultant-slug>`. Use `scripts/scaffold-data-repo.sh` after editing the SLUGS and seed project list for the new partner.

## Checklist

- [ ] Partner folder created with logo + favicon
- [ ] `partner.json` written and schema-validated
- [ ] `index.json` updated
- [ ] Dev-server smoke test passed
- [ ] Sector Growth branding still unchanged (no regression)
- [ ] Committed with structured message
