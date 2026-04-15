import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { loadProfile } from '@/data/profile-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { qk } from '@/data/query-keys';
import { useOctokit } from './use-octokit';

export function useProfile() {
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);

  return useQuery({
    queryKey: qk.profile(dataRepo ?? 'none'),
    enabled: !!octokit && !!dataRepo,
    queryFn: async () => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      const { owner, repo } = splitRepoPath(dataRepo);
      return loadProfile(octokit, { owner, repo });
    },
  });
}
