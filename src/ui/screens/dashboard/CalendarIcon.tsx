import { Button } from '@/ui/components/Button';

type Props = {
  onClick: () => void;
  disabled?: boolean;
};

export function CalendarIcon({ onClick, disabled }: Props): JSX.Element {
  return (
    <Button
      variant="secondary"
      onClick={onClick}
      disabled={disabled}
      className="!py-2 !px-4 flex items-center gap-2"
    >
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      <span>Calendar view</span>
    </Button>
  );
}
