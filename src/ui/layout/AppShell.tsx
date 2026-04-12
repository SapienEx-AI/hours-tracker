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
];

function GearIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className ?? 'w-4 h-4'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

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
      className="h-screen flex flex-col font-body text-slate-800 animated-gradient p-3"
      style={{ background: gradientBg }}
    >
      {/* ── Single-line header: logo | nav tabs | user ── */}
      <header className="flex items-center px-6 py-4 shrink-0">
        <div className="shrink-0">
          <img
            src={`${base}partners/${partner.id}/${partner.assets.logo}`}
            alt={partner.assets.logo_alt_text}
            width={partner.assets.logo_width ?? 180}
            height={partner.assets.logo_height ?? 40}
            style={{ height: '36px', width: 'auto', filter: logoFilter }}
          />
        </div>

        <nav className="flex-1 flex justify-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === route;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
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
          <span className="text-sm text-white/60 font-medium">{consultantDisplayName}</span>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className={`p-2 rounded-lg transition-all duration-300 ${
              route === 'settings'
                ? 'text-white bg-white/15'
                : 'text-white/35 hover:text-white/80 hover:bg-white/[0.06]'
            }`}
            title="Settings"
          >
            <GearIcon className="w-[18px] h-[18px]" />
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="text-xs font-semibold uppercase tracking-wider text-white/30 hover:text-white/80 transition-all duration-300"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ── Content frame: rounded light interior, scrolls internally ── */}
      <div className="flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden bg-gradient-to-br from-[#eef2ff] via-[#f0f9ff] to-[#faf5ff] shadow-[inset_0_2px_8px_rgba(0,0,0,0.08)]">
        <main className="flex-1 min-h-0 p-6 overflow-y-auto">
          <div key={route} className="page-enter">
            {children}
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
