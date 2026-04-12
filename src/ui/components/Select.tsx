import type { SelectHTMLAttributes, ReactNode } from 'react';

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
};

export function Select({ className = '', children, ...rest }: Props): JSX.Element {
  return (
    <select
      className={`w-full px-3.5 py-2.5 rounded-xl glass-input text-partner-text font-body text-sm transition-all duration-200 focus:outline-none focus:border-partner-cyan/50 focus:glass-strong focus:glow-focus ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}
