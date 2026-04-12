import type { ReactNode } from 'react';
import type { Partner } from '@/schema/types';
import type { Route } from '@/ui/Router';
import { LeftNav } from './LeftNav';
import { Footer } from './Footer';

type Props = {
  partner: Partner;
  consultantDisplayName: string;
  onSignOut: () => void;
  route: Route;
  onNavigate: (r: Route) => void;
  children: ReactNode;
};

/**
 * Top-level app shell — Glass + Glow design.
 *
 * Header: dark SG-branded gradient (partner colors, ONLY branded area).
 * Body: light gradient workspace with glass panels.
 * Footer: subtle SapienEx attribution.
 */
export function AppShell({
  partner,
  consultantDisplayName,
  onSignOut,
  route,
  onNavigate,
  children,
}: Props): JSX.Element {
  const base = import.meta.env.BASE_URL;
  const logoStyle: React.CSSProperties = {
    height: '36px',
    width: 'auto',
    // Header is always dark → always apply the dark filter for the logo
    ...(partner.assets.logo_dark_filter
      ? { filter: partner.assets.logo_dark_filter }
      : {}),
  };

  return (
    <div className="min-h-screen flex flex-col font-body text-slate-800">
      {/* ── Partner-branded header (ONLY dark area in the app) ── */}
      <header
        className="flex items-center justify-between px-6 py-3.5 shadow-lg shadow-black/10"
        style={{
          background: `linear-gradient(135deg, ${partner.theme.bg_deep} 0%, ${partner.theme.accent_deep} 80%, ${partner.theme.accent_mid} 100%)`,
        }}
      >
        <a
          href={partner.website ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={partner.display_name}
          className="hover:opacity-90 transition-opacity"
        >
          <img
            src={`${base}partners/${partner.id}/${partner.assets.logo}`}
            alt={partner.assets.logo_alt_text}
            width={partner.assets.logo_width ?? 180}
            height={partner.assets.logo_height ?? 40}
            style={logoStyle}
          />
        </a>
        <div className="flex items-center gap-5">
          <span className="font-body text-sm text-white/80 font-medium">{consultantDisplayName}</span>
          <button
            type="button"
            onClick={onSignOut}
            className="font-body text-xs font-semibold uppercase tracking-wider text-white/40 hover:text-white transition-all duration-300 hover:tracking-widest"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ── Light workspace ── */}
      <div className="flex-1 flex">
        <LeftNav active={route} onNavigate={onNavigate} />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
