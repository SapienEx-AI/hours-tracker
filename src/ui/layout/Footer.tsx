import { useAuthStore } from '@/store/auth-store';

const APP_VERSION = '0.0.1';

/**
 * Footer bar in the gradient border — app info left, SapienEx icon right.
 */
export function Footer(): JSX.Element {
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const base = typeof import.meta !== 'undefined'
    ? (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
    : '/';

  return (
    <div className="flex items-center justify-between px-4 py-1.5 shrink-0">
      <div className="flex items-center gap-3 text-[11px] text-white/35">
        <span className="font-medium text-white/50">SapienEx Hours</span>
        <span>v{APP_VERSION}</span>
        {dataRepo && (
          <>
            <span className="text-white/20">·</span>
            <span className="font-mono">{dataRepo}</span>
          </>
        )}
      </div>
      <img
        src={`${base}partners/sapienex/icon.png`}
        alt="SapienEx"
        className="h-7 opacity-40 hover:opacity-70 transition-opacity"
        style={{ aspectRatio: '0.85' }}
      />
    </div>
  );
}
