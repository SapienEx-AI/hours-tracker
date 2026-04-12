import type { SelectHTMLAttributes, ReactNode } from 'react';

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
};

export function Select({ className = '', children, ...rest }: Props): JSX.Element {
  return (
    <select
      className={`w-full px-4 py-2.5 rounded-xl glass-input text-slate-800 font-body text-sm transition-all duration-300 focus:outline-none ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}
