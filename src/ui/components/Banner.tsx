import type { ReactNode } from 'react';

type Variant = 'info' | 'warning' | 'error' | 'success';

type Props = {
  variant: Variant;
  children: ReactNode;
};

const COLORS: Record<Variant, string> = {
  info: 'bg-partner-deep/30 border-partner-cyan text-partner-text',
  warning: 'bg-yellow-900/30 border-yellow-500 text-yellow-100',
  error: 'bg-red-900/30 border-red-500 text-red-100',
  success: 'bg-green-900/30 border-green-500 text-green-100',
};

export function Banner({ variant, children }: Props): JSX.Element {
  return (
    <div className={`px-4 py-3 rounded border-l-4 ${COLORS[variant]}`} role="alert">
      {children}
    </div>
  );
}
