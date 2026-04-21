import { useQuery } from '@tanstack/react-query';

export type Release = {
  readonly version: string;
  readonly released_at: string;
  readonly commit: string;
  readonly summary: string;
  readonly changes: readonly string[];
};

export type VersionInfo = {
  readonly app: {
    readonly version: string;
    readonly repo: string;
    readonly repo_url: string;
  };
  readonly data: {
    readonly repo_convention: string;
    readonly schema_versions: Readonly<Record<string, number>>;
  };
  readonly releases: readonly Release[];
};

export type RuntimeEnv = 'local' | 'prod';

export function detectEnv(): RuntimeEnv {
  return import.meta.env.DEV ? 'local' : 'prod';
}

export function useVersionInfo(): ReturnType<typeof useQuery<VersionInfo>> {
  const env = detectEnv();
  return useQuery<VersionInfo>({
    queryKey: ['version-info'],
    enabled: env === 'prod',
    staleTime: Infinity,
    queryFn: async () => {
      const base = import.meta.env.BASE_URL;
      const res = await fetch(`${base}version.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`version.json fetch failed: ${res.status}`);
      return (await res.json()) as VersionInfo;
    },
  });
}
