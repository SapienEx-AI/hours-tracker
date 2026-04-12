import type { ReactNode } from 'react';

type Props = {
  label: string;
  hint?: string;
  children: ReactNode;
};

export function FieldLabel({ label, hint, children }: Props): JSX.Element {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-body text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
      {hint && <span className="font-body text-xs text-slate-400">{hint}</span>}
    </label>
  );
}
