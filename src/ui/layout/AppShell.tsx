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
 * Top-level app shell (spec §8.1).
 *
 * Partner logo top-left (always primary). Consultant slug + sign-out top-right.
 * Left nav. Footer with muted "Powered by SapienEx" attribution.
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
    height: '40px',
    width: 'auto',
    ...(partner.theme.mode === 'dark' && partner.assets.logo_dark_filter
      ? { filter: partner.assets.logo_dark_filter }
      : {}),
  };

  return (
    <div className="min-h-screen flex flex-col bg-partner-bg-darker text-partner-text font-body">
      <header className="flex items-center justify-between px-6 py-4 border-b border-partner-border-subtle">
        <a
          href={partner.website ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={partner.display_name}
        >
          <img
            src={`${base}partners/${partner.id}/${partner.assets.logo}`}
            alt={partner.assets.logo_alt_text}
            width={partner.assets.logo_width ?? 180}
            height={partner.assets.logo_height ?? 40}
            style={logoStyle}
          />
        </a>
        <div className="flex items-center gap-4">
          <span className="font-body text-sm text-partner-muted">{consultantDisplayName}</span>
          <button
            type="button"
            onClick={onSignOut}
            className="font-body text-xs font-medium uppercase tracking-wide text-partner-muted hover:text-partner-cyan transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="flex-1 flex">
        <LeftNav active={route} onNavigate={onNavigate} />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
