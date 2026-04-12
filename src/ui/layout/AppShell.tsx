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
  const gradientBg = `linear-gradient(135deg, ${partner.theme.bg_deep} 0%, ${partner.theme.accent_deep} 40%, ${partner.theme.accent_mid} 70%, ${partner.theme.bg_deep} 100%)`;

  return (
    <div
      className="min-h-screen flex flex-col font-body text-slate-800 animated-gradient p-1.5"
      style={{ background: gradientBg }}
    >
      {/* ── Single-line header: logo | nav tabs | user ── */}
      <header className="flex items-center px-4 py-2 shrink-0">
        <a
          href={partner.website ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={partner.display_name}
          className="hover:opacity-90 transition-opacity shrink-0"
        >
          <img
            src={`${base}partners/${partner.id}/${partner.assets.logo}`}
            alt={partner.assets.logo_alt_text}
            width={partner.assets.logo_width ?? 180}
            height={partner.assets.logo_height ?? 40}
            style={{ height: '26px', width: 'auto', filter: logoFilter }}
          />
        </a>

        <nav className="flex-1 flex justify-center gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === route;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`px-3.5 py-1 rounded-md text-[12px] font-semibold transition-all duration-300 ${
                  isActive
                    ? 'text-white bg-white/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2),0_0_12px_rgba(107,207,238,0.12)]'
                    : 'text-white/45 hover:text-white/90 hover:bg-white/[0.06]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[12px] text-white/60 font-medium">{consultantDisplayName}</span>
          <button
            type="button"
            onClick={onSignOut}
            className="text-[10px] font-semibold uppercase tracking-wider text-white/30 hover:text-white/80 transition-all duration-300"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ── Content frame: light interior inside the gradient border ── */}
      <div className="flex-1 flex flex-col rounded-xl overflow-hidden bg-gradient-to-br from-[#eef2ff] via-[#f0f9ff] to-[#faf5ff] shadow-inner shadow-black/5">
        <main className="flex-1 p-6 overflow-y-auto">
          <div key={route} className="page-enter">
            {children}
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
