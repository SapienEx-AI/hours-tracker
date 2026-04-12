import { describe, it, expect, beforeEach } from 'vitest';
import { applyPartnerTheme } from '@/partner/apply-theme';
import type { Partner } from '@/schema/types';

const sectorGrowth: Partner = {
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
  fonts: {
    display: "'Space Grotesk', sans-serif",
    body: "'Inter', sans-serif",
    mono: "'JetBrains Mono', monospace",
    google_fonts_link:
      'https://fonts.googleapis.com/css2?family=Inter&family=Space+Grotesk&family=JetBrains+Mono',
  },
  assets: {
    logo: 'logo.webp',
    logo_alt_text: 'Sector Growth',
    logo_dark_filter: 'invert(1) hue-rotate(180deg) brightness(1.05)',
    favicon: 'favicon.png',
  },
  enabled: true,
};

describe('applyPartnerTheme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style');
    document.title = '';
    document.querySelectorAll('link[rel="icon"]').forEach((el) => el.remove());
    document.querySelectorAll('link[data-partner-fonts]').forEach((el) => el.remove());
    document.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.remove());
  });

  it('sets CSS custom properties on :root for every theme key', () => {
    applyPartnerTheme(sectorGrowth);
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--partner-bg-deep')).toBe('#0A1628');
    expect(root.style.getPropertyValue('--partner-bg-darker')).toBe('#050B16');
    expect(root.style.getPropertyValue('--partner-accent-cyan')).toBe('#6BCFEE');
    expect(root.style.getPropertyValue('--partner-text-primary')).toBe('#F5F7FA');
  });

  it('sets font CSS custom properties from partner.fonts', () => {
    applyPartnerTheme(sectorGrowth);
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--partner-font-display')).toContain('Space Grotesk');
    expect(root.style.getPropertyValue('--partner-font-body')).toContain('Inter');
    expect(root.style.getPropertyValue('--partner-font-mono')).toContain('JetBrains Mono');
  });

  it('updates document.title to "Hours · <partner display_name>"', () => {
    applyPartnerTheme(sectorGrowth);
    expect(document.title).toBe('Hours · Sector Growth');
  });

  it('injects a Google Fonts stylesheet link when google_fonts_link is set', () => {
    applyPartnerTheme(sectorGrowth);
    const link = document.querySelector('link[data-partner-fonts]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toContain('Space+Grotesk');
  });

  it('is idempotent — calling twice produces exactly one favicon and one fonts link', () => {
    applyPartnerTheme(sectorGrowth);
    applyPartnerTheme(sectorGrowth);
    expect(document.querySelectorAll('link[data-partner-favicon]').length).toBe(1);
    expect(document.querySelectorAll('link[data-partner-fonts]').length).toBe(1);
  });

  it('sets meta theme-color to partner.theme.bg_deep', () => {
    applyPartnerTheme(sectorGrowth);
    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe('#0A1628');
  });
});
