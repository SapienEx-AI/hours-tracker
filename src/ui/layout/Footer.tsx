/**
 * Footer — subtle SapienEx icon in the bottom-right corner.
 */
export function Footer(): JSX.Element {
  const base = typeof import.meta !== 'undefined'
    ? (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
    : '/';

  return (
    <footer className="flex justify-end px-3 py-1.5">
      <img
        src={`${base}partners/sapienex/icon.png`}
        alt="SapienEx"
        className="h-5 w-5 opacity-25 hover:opacity-40 transition-opacity"
      />
    </footer>
  );
}
