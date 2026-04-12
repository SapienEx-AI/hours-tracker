import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = '', ...rest }: Props): JSX.Element {
  return (
    <input
      className={`w-full px-3 py-2 rounded bg-partner-bg-deep border border-partner-border-subtle text-partner-text font-body text-sm focus:outline-none focus:border-partner-cyan ${className}`}
      {...rest}
    />
  );
}
