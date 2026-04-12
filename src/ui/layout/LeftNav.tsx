import type { Route } from '@/ui/Router';

const SECTIONS: Array<{ id: Route; label: string }> = [
  { id: 'log', label: 'Log' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'entries', label: 'Entries' },
  { id: 'projects', label: 'Projects' },
  { id: 'rates', label: 'Rates' },
  { id: 'snapshots', label: 'Snapshots' },
  { id: 'settings', label: 'Settings' },
];

type Props = {
  active: Route;
  onNavigate: (id: Route) => void;
};

export function LeftNav({ active, onNavigate }: Props): JSX.Element {
  return (
    <nav className="w-48 p-4 border-r border-black/5">
      <ul className="flex flex-col gap-1.5">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onNavigate(s.id)}
              className={`w-full text-left px-3 py-2 rounded-lg font-body text-sm font-medium transition-all duration-200 ${
                s.id === active
                  ? 'glass-strong text-partner-deep glow-cyan'
                  : 'text-partner-muted hover:text-partner-text hover:bg-white/40'
              }`}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
