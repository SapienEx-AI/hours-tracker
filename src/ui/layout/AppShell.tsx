import type { ReactNode } from 'react';
import type { Partner } from '@/schema/types';
import type { Route } from '@/ui/Router';
import { Footer } from './Footer';

const NAV_ITEMS: Array<{ id: Route; label: string }> = [
  { id: 'log', label: 'Log' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'entries', label: 'Entries' },
  { id: 'projects', label: 'Projects' },
  { id: 'rates', label: 'Rates' },
  { id: 'snapshots', label: 'Snapshots' },
  { id: 'settings', label: 'Settings' },
];

type Props = {
  partner: Partner;
  consultantDisplayName: string;
  onSignOut: () => void;
  route: Route;
  onNavigate: (r: Route) => void;
  children: ReactNode;
};

/**
 * App shell — partner-branded top bar with centered navigation,
 * animated gradient background, and page transition animations.
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
  const logoFilter = partner.assets.logo_dark_filter ?? undefined;

  return (
    <div className="min-h-screen flex flex-col font-body text-slate-800">
      {/* ── Animated gradient header with centered nav ── */}
      <header
        className="animated-gradient shadow-lg shadow-black/10 relative z-10"
        style={{
          background: `linear-gradient(135deg, ${partner.theme.bg_deep} 0%, ${partner.theme.accent_deep} 40%, ${partner.theme.accent_mid} 70%, ${partner.theme.bg_deep} 100%)`,
        }}
      >
        {/* Top row: logo + user */}
        <div className="flex items-center justify-between px-6 pt-3 pb-1">
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
              style={{ height: '30px', width: 'auto', filter: logoFilter }}
            />
          </a>
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/70 font-medium">{consultantDisplayName}</span>
            <button
              type="button"
              onClick={onSignOut}
              className="text-[11px] font-semibold uppercase tracking-wider text-white/35 hover:text-white/80 transition-all duration-300"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Nav row: centered tabs */}
        <nav className="flex justify-center gap-1 px-6 pb-2 pt-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === route;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-300 ${
                  isActive
                    ? 'text-white bg-white/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2),0_0_16px_rgba(107,207,238,0.15)]'
                    : 'text-white/50 hover:text-white/90 hover:bg-white/[0.06]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* ── Page content with enter animation ── */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div key={route} className="page-enter">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}
