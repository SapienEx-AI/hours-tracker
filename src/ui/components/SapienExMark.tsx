/**
 * A subtle "powered by SapienEx" attribution mark for use anywhere the app
 * surfaces AI, integrations, or other SapienEx-provided smart features.
 *
 * Renders the SapienEx icon at low opacity with a tiny "SapienEx" label.
 * Designed to sit inline in section headers without stealing focus.
 */

type Props = {
  /** Label visibility: 'show' renders the text, 'hide' is icon-only. Default 'hide'. */
  label?: 'show' | 'hide';
  /** 'light' for use on light backgrounds, 'dark' for dark panels. Default 'light'. */
  variant?: 'light' | 'dark';
  /** Icon size. 'sm' = 16px, 'md' = 20px, 'lg' = 28px. Default 'sm'. */
  size?: 'sm' | 'md' | 'lg';
  /**
   * 'trailing' aligns the mark to the end of the parent (ml-auto).
   * 'inline' renders it inline, no auto-margin. Default 'trailing'.
   */
  position?: 'trailing' | 'inline';
  className?: string;
};

const SIZE_CLASS: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-4',
  md: 'h-5',
  lg: 'h-7',
};

export function SapienExMark({
  label = 'hide',
  variant = 'light',
  size = 'sm',
  position = 'trailing',
  className = '',
}: Props): JSX.Element {
  const base =
    typeof import.meta !== 'undefined'
      ? (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
      : '/';

  const labelColor = variant === 'dark' ? 'text-white/60' : 'text-slate-600';
  const align = position === 'trailing' ? 'ml-auto' : '';

  // The icon's natural rendering is light strokes on transparent — invisible on
  // a light glass background. On 'light' variant, render it inside a dark
  // partner-gradient badge so the icon's strokes pop. On 'dark' variant, render
  // the icon directly with full opacity since the dark surroundings already
  // provide contrast.
  const padForBadge: Record<NonNullable<Props['size']>, string> = {
    sm: 'h-6 w-6',
    md: 'h-7 w-7',
    lg: 'h-9 w-9',
  };
  const iconSizeInBadge: Record<NonNullable<Props['size']>, string> = {
    sm: 'h-4',
    md: 'h-5',
    lg: 'h-6',
  };

  const iconNode =
    variant === 'light' ? (
      <span
        className={`
          inline-flex items-center justify-center rounded-md
          ${padForBadge[size]}
          bg-[#0A1628]
          shadow-[0_1px_4px_rgba(0,0,0,0.15)]
        `}
      >
        <img
          src={`${base}partners/sapienex/icon.png`}
          alt="SapienEx"
          className={`${iconSizeInBadge[size]} w-auto`}
          style={{ aspectRatio: '0.85' }}
        />
      </span>
    ) : (
      <img
        src={`${base}partners/sapienex/icon.png`}
        alt="SapienEx"
        className={`${SIZE_CLASS[size]} w-auto opacity-90`}
        style={{ aspectRatio: '0.85' }}
      />
    );

  return (
    <span
      title="Powered by SapienEx"
      className={`${align} inline-flex items-center gap-1.5 hover:opacity-100 transition-opacity select-none ${className}`}
    >
      {label === 'show' && (
        <span className={`text-[9px] font-mono uppercase tracking-widest ${labelColor}`}>
          SapienEx
        </span>
      )}
      {iconNode}
    </span>
  );
}
