import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = '', ...rest }: Props): JSX.Element {
  return (
    <input
      className={`w-full px-4 py-2.5 rounded-xl glass-input text-slate-800 font-body text-sm transition-all duration-300 focus:outline-none placeholder:text-slate-400 ${className}`}
      {...rest}
    />
  );
}
