/**
 * Footer — subtle SapienEx icon in the bottom-right corner on a dark pill.
 */
export function Footer(): JSX.Element {
  const base = typeof import.meta !== 'undefined'
    ? (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
    : '/';

  return (
    <footer className="flex justify-end px-3 py-1.5">
      <div className="bg-slate-800/80 rounded-lg p-1.5 hover:bg-slate-700/80 transition-colors">
        <img
          src={`${base}partners/sapienex/icon.png`}
          alt="SapienEx"
          className="h-5 w-5 opacity-70 hover:opacity-100 transition-opacity"
        />
      </div>
    </footer>
  );
}
