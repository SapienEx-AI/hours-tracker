/**
 * Footer — SapienEx icon as a small tab in the bottom-right corner,
 * sitting in the gradient border area just below the content panel.
 */
export function Footer(): JSX.Element {
  const base = typeof import.meta !== 'undefined'
    ? (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
    : '/';

  return (
    <div className="absolute bottom-0 right-4 translate-y-full px-2 pt-1">
      <img
        src={`${base}partners/sapienex/icon.png`}
        alt="SapienEx"
        className="h-7 opacity-40 hover:opacity-70 transition-opacity"
        style={{ aspectRatio: '0.85' }}
      />
    </div>
  );
}
