/**
 * TypeScript types that mirror the JSON Schemas in /schemas/*.json.
 *
 * These are the in-memory representation. The schemas are the serialization
 * contract; types + ajv validators must stay in sync. Bumping schema_version
 * is a reviewed event (spec §15.5 `adding-a-field.md` playbook).
 */

// ─── Partner ───

export type PartnerTheme = {
  mode: 'dark' | 'light';
  bg_deep: string;
  bg_darker: string;
  accent_cyan: string;
  accent_mid: string;
  accent_deep: string;
  text_primary: string;
  text_muted: string;
  border_subtle: string;
  border_strong: string;
};

export type PartnerFonts = {
  display: string;
  body: string;
  mono: string;
  google_fonts_link?: string;
};

export type PartnerAssets = {
  logo: string;
  logo_alt_text: string;
  logo_width?: number;
  logo_height?: number;
  logo_dark_filter?: string;
  favicon: string;
};

export type Partner = {
  schema_version: 1;
  id: string;
  display_name: string;
  tagline?: string;
  website?: string;
  currency: string;
  currency_symbol: string;
  currency_display_suffix: string;
  data_repo_prefix: string;
  theme: PartnerTheme;
  fonts: PartnerFonts;
  assets: PartnerAssets;
  enabled: boolean;
};

export type PartnersIndex = {
  schema_version: 1;
  partners: Array<{ id: string; display_name: string; enabled: boolean }>;
};

// ─── Profile ───

export type Profile = {
  schema_version: 1;
  partner_id: string;
  consultant_id: string;
  display_name: string;
  email?: string;
  timezone?: string;
  created_at: string;
};

// ─── Rates ───

export type RateHistoryEntry = {
  effective_from: string;
  rate_cents: number;
  note?: string;
};

export type RatesConfig = {
  schema_version: 1;
  default_rate_history: RateHistoryEntry[];
};

// ─── Projects ───

export type BucketType = 'hour_block' | 'discovery' | 'arch_tl' | 'dev' | 'custom';
export type BucketStatus = 'active' | 'closed' | 'archived';

export type Bucket = {
  id: string;
  type: BucketType;
  name: string;
  budgeted_hours_hundredths: number;
  rate_cents: number | null;
  status: BucketStatus;
  opened_at: string;
  closed_at: string | null;
  notes: string;
};

export type Project = {
  id: string;
  name: string;
  client: string | null;
  active: boolean;
  is_internal: boolean;
  default_rate_cents: number | null;
  buckets: Bucket[];
};

export type ProjectsConfig = {
  schema_version: 1;
  projects: Project[];
};

// ─── Entries ───

export type RateSource = 'entry_override' | 'project_default' | 'global_default';
export type BillableStatus = 'billable' | 'non_billable' | 'needs_review';

export type Entry = {
  id: string;
  project: string;
  date: string;
  hours_hundredths: number;
  rate_cents: number;
  rate_source: RateSource;
  billable_status: BillableStatus;
  bucket_id: string | null;
  description: string;
  review_flag: boolean;
  created_at: string;
  updated_at: string;
};

export type EntriesFile = {
  schema_version: 1;
  month: string;
  entries: Entry[];
};

// ─── Totals (calc outputs) ───

export type BucketConsumption = {
  bucket_id: string;
  consumed_hours_hundredths: number;
  budgeted_hours_hundredths: number;
  amount_cents: number;
};

export type ProjectTotals = {
  project: string;
  billable_hours_hundredths: number;
  billable_amount_cents: number;
  non_billable_hours_hundredths: number;
  needs_review_hours_hundredths: number;
  by_bucket: BucketConsumption[];
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

// ─── Snapshot ───

export type Snapshot = {
  schema_version: 1;
  month: string;
  closed_at: string;
  closed_at_commit_sha: string;
  source_hash: string;
  totals: {
    total_hours_hundredths: number;
    billable_hours_hundredths: number;
    non_billable_hours_hundredths: number;
    needs_review_hours_hundredths: number;
    billable_amount_cents: number;
  };
  per_project: ProjectTotals[];
  entry_ids: string[];
};
