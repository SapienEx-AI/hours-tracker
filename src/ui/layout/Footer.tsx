/**
 * Footer — SapienEx icon as a tab extending from the gradient border,
 * bottom-right corner. No separate background — the icon lives directly
 * in the gradient border area.
 */
export function Footer(): JSX.Element {
  const base = typeof import.meta !== 'undefined'
    ? (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
    : '/';

  return (
    <div className="flex justify-end pr-1 -mt-1">
      <div className="px-2.5 pt-1 pb-0.5">
        <img
          src={`${base}partners/sapienex/icon.png`}
          alt="SapienEx"
          className="h-7 opacity-40 hover:opacity-70 transition-opacity"
          style={{ aspectRatio: '0.85' }}
        />
      </div>
    </div>
  );
}
