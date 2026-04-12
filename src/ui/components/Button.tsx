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
    'px-4 py-2 rounded font-mono text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const variants: Record<NonNullable<Props['variant']>, string> = {
    primary: 'bg-partner-deep text-partner-text hover:bg-partner-mid',
    secondary:
      'border border-partner-border-strong text-partner-text hover:bg-partner-deep/30',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
