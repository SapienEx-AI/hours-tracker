# src/partner

**Purpose:** Load partner config at runtime from `public/partners/<id>/partner.json`, validate it, and apply theme tokens to the DOM.

**Public API:**
- `loadPartnersIndex() → PartnersIndex`
- `loadPartner(partnerId) → Partner` (schema-validated)
- `applyPartnerTheme(partner)` — sets CSS custom properties, updates title, favicon, fonts link

**Invariants:**
1. Every partner load goes through schema validation (spec §5.1).
2. Theme application is idempotent — calling twice with the same partner produces exactly one favicon and one fonts link.
3. Partner logo is rendered through `logo_dark_filter` when `theme.mode === 'dark'` (spec §5.1).
4. SapienEx attribution never appears in this module — that belongs to `src/ui/layout/Footer.tsx`.

**Dependencies:** `@/schema/validators`, `@/schema/types`. No data-layer or Octokit imports.
