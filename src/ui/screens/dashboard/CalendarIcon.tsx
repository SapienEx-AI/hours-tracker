type Props = {
  onClick: () => void;
  disabled?: boolean;
};

export function CalendarIcon({ onClick, disabled }: Props): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Open calendar view"
      className="text-slate-400 hover:text-sky-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed p-1"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    </button>
  );
}
