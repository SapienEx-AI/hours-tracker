import { useState } from 'react';
import { detectEnv, useVersionInfo, type Release } from '@/data/version';

function ReleaseCard({ release }: { release: Release }): JSX.Element {
  return (
    <div className="text-xs text-slate-700">
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-slate-800">v{release.version}</span>
        <span className="font-mono text-[10px] text-slate-400">{release.released_at}</span>
      </div>
      <div className="text-[11px] text-slate-600 mb-2 leading-snug">{release.summary}</div>
      {release.changes.length > 0 && (
        <ul className="text-[11px] space-y-0.5 list-disc list-inside text-slate-600">
          {release.changes.map((c, i) => (
            <li key={i} className="leading-snug">
              {c}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 font-mono text-[10px] text-slate-400">commit {release.commit}</div>
    </div>
  );
}

export function VersionBadge(): JSX.Element | null {
  const env = detectEnv();
  const { data } = useVersionInfo();
  const [hover, setHover] = useState(false);

  if (env === 'local') {
    return (
      <span className="font-mono text-[11px] font-bold text-red-600 select-none">
        v0.0.0-local
      </span>
    );
  }

  if (!data) return null;

  const label = `v${data.app.version}-prod`;
  const current = data.releases[0];

  return (
    <span
      className="relative font-mono text-[11px] text-white/60 cursor-help select-none"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {label}
      {hover && current && (
        <div
          className="absolute bottom-full left-0 mb-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl p-3 z-50 font-sans"
          role="tooltip"
        >
          <ReleaseCard release={current} />
          {data.releases.length > 1 && (
            <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
              {data.releases.length - 1} prior release{data.releases.length > 2 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
