import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
  children: ReactNode;
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: Props): JSX.Element {
  const base =
    'px-5 py-2.5 rounded-xl font-body text-sm font-semibold transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none';
  const variants: Record<NonNullable<Props['variant']>, string> = {
    primary:
      'bg-gradient-to-br from-partner-deep via-partner-mid to-partner-cyan/70 text-white btn-glow hover:btn-glow-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
    secondary:
      'glass text-slate-700 font-medium hover:glass-strong hover:glow-cyan hover:-translate-y-0.5 active:translate-y-0',
    danger:
      'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/30 hover:shadow-red-500/50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
