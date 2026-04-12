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
    <nav className="w-52 p-5 border-r border-black/[0.04]">
      <ul className="flex flex-col gap-1">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onNavigate(s.id)}
              className={`w-full text-left px-4 py-2.5 rounded-xl font-body text-[13px] font-semibold transition-all duration-300 ${
                s.id === active
                  ? 'glass-strong text-slate-800 glow-cyan'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
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
