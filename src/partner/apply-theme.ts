import type { Partner } from '@/schema/types';

/**
 * Apply partner theme tokens to the DOM at runtime.
 *
 * Sets CSS custom properties on :root so Tailwind utilities (`bg-partner-*`)
 * and plain CSS (`var(--partner-...)`) pick up the active partner.
 *
 * Idempotent: calling twice produces exactly one favicon link, one fonts link,
 * and overwrites existing properties in place.
 *
 * Spec references: §0, §5.1, §8.1 branding placement rules.
 */
export function applyPartnerTheme(partner: Partner): void {
  applyCssCustomProperties(partner);
  updateTitle(partner);
  updateFavicon(partner);
  injectFontsLink(partner);
  updateMetaThemeColor(partner);
}

function applyCssCustomProperties(partner: Partner): void {
  const root = document.documentElement;
  const t = partner.theme;
  root.style.setProperty('--partner-bg-deep', t.bg_deep);
  root.style.setProperty('--partner-bg-darker', t.bg_darker);
  root.style.setProperty('--partner-accent-cyan', t.accent_cyan);
  root.style.setProperty('--partner-accent-mid', t.accent_mid);
  root.style.setProperty('--partner-accent-deep', t.accent_deep);
  root.style.setProperty('--partner-text-primary', t.text_primary);
  root.style.setProperty('--partner-text-muted', t.text_muted);
  root.style.setProperty('--partner-border-subtle', t.border_subtle);
  root.style.setProperty('--partner-border-strong', t.border_strong);
  root.style.setProperty('--partner-font-display', partner.fonts.display);
  root.style.setProperty('--partner-font-body', partner.fonts.body);
  root.style.setProperty('--partner-font-mono', partner.fonts.mono);
}

function updateTitle(partner: Partner): void {
  document.title = `Hours · ${partner.display_name}`;
}

function baseUrl(): string {
  const env = (import.meta as { env?: { BASE_URL?: string } }).env;
  return env?.BASE_URL ?? '/';
}

function updateFavicon(partner: Partner): void {
  // Remove any existing partner-managed favicon and any static favicon
  // placed by index.html at build time.
  document
    .querySelectorAll('link[data-partner-favicon]')
    .forEach((el) => el.remove());
  const staticFavicon = document.querySelector(
    'link[rel="icon"]:not([data-partner-favicon])',
  );
  if (staticFavicon) staticFavicon.remove();

  const link = document.createElement('link');
  link.setAttribute('rel', 'icon');
  link.setAttribute('data-partner-favicon', '');
  link.setAttribute(
    'href',
    `${baseUrl()}partners/${partner.id}/${partner.assets.favicon}`,
  );
  document.head.appendChild(link);
}

function injectFontsLink(partner: Partner): void {
  if (!partner.fonts.google_fonts_link) return;
  document
    .querySelectorAll('link[data-partner-fonts]')
    .forEach((el) => el.remove());

  const link = document.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('data-partner-fonts', '');
  link.setAttribute('href', partner.fonts.google_fonts_link);
  document.head.appendChild(link);
}

function updateMetaThemeColor(partner: Partner): void {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', partner.theme.bg_deep);
}
