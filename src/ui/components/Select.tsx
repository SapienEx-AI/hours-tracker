import { forwardRef, type SelectHTMLAttributes, type ReactNode } from 'react';

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
};

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { className = '', children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={`w-full px-4 py-2.5 rounded-xl glass-input text-slate-800 font-body text-sm transition-all duration-300 focus:outline-none ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
});
