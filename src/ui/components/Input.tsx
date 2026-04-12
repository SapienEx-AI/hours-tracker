import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = '', ...rest }: Props): JSX.Element {
  return (
    <input
      className={`w-full px-3.5 py-2.5 rounded-xl glass-input text-partner-text font-body text-sm transition-all duration-200 focus:outline-none focus:border-partner-cyan/50 focus:glass-strong focus:glow-focus placeholder:text-partner-muted/60 ${className}`}
      {...rest}
    />
  );
}
