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
    'px-4 py-2.5 rounded-xl font-body text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants: Record<NonNullable<Props['variant']>, string> = {
    primary:
      'bg-gradient-to-r from-partner-deep to-partner-mid text-white btn-glow hover:btn-glow-hover hover:-translate-y-0.5',
    secondary:
      'glass text-partner-text hover:glass-strong hover:glow-cyan',
    danger:
      'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:-translate-y-0.5',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
