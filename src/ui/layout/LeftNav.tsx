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
    <nav className="w-48 border-r border-partner-border-subtle p-4">
      <ul className="flex flex-col gap-2">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onNavigate(s.id)}
              className={`w-full text-left px-3 py-2 rounded font-mono text-sm transition-colors ${
                s.id === active
                  ? 'bg-partner-deep text-partner-text'
                  : 'text-partner-muted hover:text-partner-cyan'
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
