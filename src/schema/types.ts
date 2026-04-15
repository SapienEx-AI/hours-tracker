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

export type LoggingMode = 'hours' | 'effort' | 'both';

export type Profile = {
  schema_version: 1;
  partner_id: string;
  consultant_id: string;
  display_name: string;
  email?: string;
  timezone?: string;
  created_at: string;
  logging_mode?: LoggingMode;
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

export type BucketInvoice = {
  date: string;
  hours_hundredths: number;
  amount_cents: number;
  note: string;
};

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
  invoices?: BucketInvoice[];
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

export type SourceRef =
  | { kind: 'calendar'; id: string }
  | { kind: 'timer'; id: string }
  | { kind: 'slack'; id: string }
  | { kind: 'gmail'; id: string }
  | null;

export type EffortKind =
  | 'workshop' | 'meeting' | 'client_training'
  | 'config_work' | 'build' | 'integration' | 'data_work' | 'reporting' | 'qa'
  | 'slack' | 'email' | 'async_video' | 'ticket'
  | 'internal_sync' | 'documentation' | 'peer_review'
  | 'learning' | 'scoping'
  | 'other';

export type EffortCategory =
  | 'client_sync'
  | 'technical'
  | 'client_async'
  | 'internal'
  | 'enablement';

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
  source_ref: SourceRef;
  effort_kind: EffortKind | null;
  effort_count: number | null;
};

export type EntriesFile = {
  schema_version: 1 | 2 | 3 | 4 | 5;
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

// ─── Calendar integration ───

export type CalendarConfig = {
  schema_version: 1;
  provider: 'google';
  enabled_calendars: string[];
  last_connected_at?: string;
};

// ─── Effort source integrations ───

export type IntegrationsConfig = {
  schema_version: 1;
  slack?: {
    enabled?: boolean;
    workspaces?: Array<{ id: string; name: string }>;
    client_channel_prefixes?: string[];
    internal_channel_prefixes?: string[];
    project_by_workspace?: Record<string, string>;
    project_by_channel_prefix?: Record<string, string>;
  };
  gmail?: {
    enabled?: boolean;
    client_domains?: string[];
    internal_domains?: string[];
    project_by_domain?: Record<string, string>;
  };
  calendar?: {
    workshop_min_duration_minutes?: number;
    client_training_title_keywords?: string[];
    internal_only_attendee_domains?: string[];
  };
};
