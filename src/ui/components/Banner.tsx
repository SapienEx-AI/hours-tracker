import type { ReactNode } from 'react';

type Variant = 'info' | 'warning' | 'error' | 'success';

type Props = {
  variant: Variant;
  children: ReactNode;
};

const COLORS: Record<Variant, string> = {
  info: 'bg-blue-50/80 border-partner-mid text-partner-text backdrop-blur-sm',
  warning: 'bg-amber-50/80 border-amber-500 text-amber-900 backdrop-blur-sm',
  error: 'bg-red-50/80 border-red-500 text-red-900 backdrop-blur-sm',
  success: 'bg-emerald-50/80 border-emerald-500 text-emerald-900 backdrop-blur-sm',
};

export function Banner({ variant, children }: Props): JSX.Element {
  return (
    <div className={`px-4 py-3 rounded-xl border-l-4 ${COLORS[variant]}`} role="alert">
      {children}
    </div>
  );
}
