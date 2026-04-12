import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadPartnersIndex, loadPartner } from '@/partner/load-partner';

describe('loadPartnersIndex', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches partners index.json and returns the parsed list', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        schema_version: 1,
        partners: [{ id: 'sector-growth', display_name: 'Sector Growth', enabled: true }],
      }),
    });
    const result = await loadPartnersIndex();
    expect(result.partners).toHaveLength(1);
    expect(result.partners[0]?.id).toBe('sector-growth');
  });

  it('throws when the fetch returns non-ok', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
    });
    await expect(loadPartnersIndex()).rejects.toThrow();
  });
});

describe('loadPartner', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches a partner.json by id and validates it against the schema', async () => {
    const valid = {
      schema_version: 1,
      id: 'sector-growth',
      display_name: 'Sector Growth',
      currency: 'CAD',
      currency_symbol: '$',
      currency_display_suffix: 'CAD',
      data_repo_prefix: 'hours-data-sector-growth-',
      theme: {
        mode: 'dark',
        bg_deep: '#0A1628',
        bg_darker: '#050B16',
        accent_cyan: '#6BCFEE',
        accent_mid: '#2A85C4',
        accent_deep: '#1E4DA8',
        text_primary: '#F5F7FA',
        text_muted: '#94A3B8',
        border_subtle: 'rgba(255,255,255,0.08)',
        border_strong: 'rgba(255,255,255,0.16)',
      },
      fonts: { display: 's', body: 's', mono: 'm' },
      assets: { logo: 'logo.webp', logo_alt_text: 'Sector Growth', favicon: 'favicon.png' },
      enabled: true,
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => valid,
    });
    const result = await loadPartner('sector-growth');
    expect(result.id).toBe('sector-growth');
    expect(result.currency).toBe('CAD');
  });

  it('throws a descriptive error when the partner.json fails schema validation', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ schema_version: 1, id: 'bad' }),
    });
    await expect(loadPartner('bad')).rejects.toThrow(/validation/i);
  });
});
