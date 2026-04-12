import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { loadAllEntries } from '@/data/entries-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { qk } from '@/data/query-keys';
import { useOctokit } from './use-octokit';

/**
 * Load ALL entries across every month in the data repo.
 * Used for computing all-time bucket consumption.
 *
 * Cached aggressively — invalidated when any month's entries change.
 */
export function useAllEntries() {
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);

  return useQuery({
    queryKey: [...qk.all, 'all-entries', dataRepo ?? 'none'] as const,
    enabled: !!octokit && !!dataRepo,
    staleTime: 30_000,
    queryFn: async () => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      const { owner, repo } = splitRepoPath(dataRepo);
      return loadAllEntries(octokit, { owner, repo });
    },
  });
}
