import type { ReactNode } from 'react';

type Props = {
  label: string;
  hint?: string;
  children: ReactNode;
};

export function FieldLabel({ label, hint, children }: Props): JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-body text-xs font-semibold uppercase tracking-wide text-partner-muted">
        {label}
      </span>
      {children}
      {hint && <span className="font-body text-xs text-partner-muted">{hint}</span>}
    </label>
  );
}
