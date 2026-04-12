import { describe, it, expect } from 'vitest';
import {
  validatePartner,
  validateProfile,
  validateProjects,
  validateRates,
  validateEntries,
  validateSnapshot,
} from '@/schema/validators';

const validPartner = {
  schema_version: 1,
  id: 'test-partner',
  display_name: 'Test Partner',
  currency: 'USD',
  currency_symbol: '$',
  currency_display_suffix: 'USD',
  data_repo_prefix: 'hours-data-test-partner-',
  theme: {
    mode: 'dark',
    bg_deep: '#000',
    bg_darker: '#000',
    accent_cyan: '#fff',
    accent_mid: '#fff',
    accent_deep: '#fff',
    text_primary: '#fff',
    text_muted: '#ccc',
    border_subtle: 'rgba(0,0,0,0)',
    border_strong: 'rgba(0,0,0,0)',
  },
  fonts: { display: 'sans', body: 'sans', mono: 'mono' },
  assets: { logo: 'logo.png', logo_alt_text: 'Test', favicon: 'f.png' },
  enabled: true,
};

describe('schema validators', () => {
  it('validatePartner accepts a minimal valid partner config', () => {
    expect(validatePartner(validPartner).ok).toBe(true);
  });

  it('validatePartner rejects a partner whose data_repo_prefix is malformed', () => {
    const bad = { ...validPartner, data_repo_prefix: 'wrong-prefix' };
    expect(validatePartner(bad).ok).toBe(false);
  });

  it('validateEntries rejects an entry with hours_hundredths of 0', () => {
    const bad = {
      schema_version: 1,
      month: '2026-04',
      entries: [
        {
          id: '2026-04-11-sprosty-abcdef',
          project: 'sprosty',
          date: '2026-04-11',
          hours_hundredths: 0,
          rate_cents: 12500,
          rate_source: 'global_default',
          billable_status: 'billable',
          bucket_id: null,
          description: 'test',
          review_flag: false,
          created_at: '2026-04-11T00:00:00Z',
          updated_at: '2026-04-11T00:00:00Z',
        },
      ],
    };
    expect(validateEntries(bad).ok).toBe(false);
  });

  it('validateEntries rejects an entry with hours_hundredths over 2400 (more than 24h/day)', () => {
    const bad = {
      schema_version: 1,
      month: '2026-04',
      entries: [
        {
          id: '2026-04-11-sprosty-abcdef',
          project: 'sprosty',
          date: '2026-04-11',
          hours_hundredths: 2500,
          rate_cents: 12500,
          rate_source: 'global_default',
          billable_status: 'billable',
          bucket_id: null,
          description: 'test',
          review_flag: false,
          created_at: '2026-04-11T00:00:00Z',
          updated_at: '2026-04-11T00:00:00Z',
        },
      ],
    };
    expect(validateEntries(bad).ok).toBe(false);
  });

  it('validateRates rejects an empty history', () => {
    expect(validateRates({ schema_version: 1, default_rate_history: [] }).ok).toBe(false);
  });

  it('validateProjects rejects a project whose id has spaces', () => {
    const bad = {
      schema_version: 1,
      projects: [
        {
          id: 'Has Spaces',
          name: 'Bad',
          client: null,
          active: true,
          is_internal: false,
          default_rate_cents: null,
          buckets: [],
        },
      ],
    };
    expect(validateProjects(bad).ok).toBe(false);
  });

  it('validateProfile accepts a minimal valid profile', () => {
    expect(
      validateProfile({
        schema_version: 1,
        partner_id: 'sector-growth',
        consultant_id: 'prash',
        display_name: 'Prash',
        created_at: '2026-04-11T00:00:00Z',
      }).ok,
    ).toBe(true);
  });

  it('validateSnapshot accepts a minimal valid snapshot', () => {
    expect(
      validateSnapshot({
        schema_version: 1,
        month: '2026-03',
        closed_at: '2026-04-03T10:14:22Z',
        closed_at_commit_sha: 'a3f9c1b',
        source_hash: 'sha256:' + 'a'.repeat(64),
        totals: {
          total_hours_hundredths: 0,
          billable_hours_hundredths: 0,
          non_billable_hours_hundredths: 0,
          needs_review_hours_hundredths: 0,
          billable_amount_cents: 0,
        },
        per_project: [],
        entry_ids: [],
      }).ok,
    ).toBe(true);
  });
});
