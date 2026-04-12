import type { SelectHTMLAttributes, ReactNode } from 'react';

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
};

export function Select({ className = '', children, ...rest }: Props): JSX.Element {
  return (
    <select
      className={`w-full px-3 py-2 rounded bg-partner-bg-deep border border-partner-border-subtle text-partner-text font-mono text-sm focus:outline-none focus:border-partner-cyan ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}
