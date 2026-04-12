import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { loadRates } from '@/data/rates-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { qk } from '@/data/query-keys';
import { useOctokit } from './use-octokit';

export function useRates() {
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);

  return useQuery({
    queryKey: qk.rates(dataRepo ?? 'none'),
    enabled: !!octokit && !!dataRepo,
    queryFn: async () => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      const { owner, repo } = splitRepoPath(dataRepo);
      const result = await loadRates(octokit, { owner, repo });
      return result.data;
    },
  });
}
