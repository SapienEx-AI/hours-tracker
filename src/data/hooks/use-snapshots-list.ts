import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { listSnapshots } from '@/data/snapshots-list';
import { splitRepoPath } from '@/data/octokit-client';
import { qk } from '@/data/query-keys';
import { useOctokit } from './use-octokit';

export function useSnapshotsList() {
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);

  return useQuery({
    queryKey: qk.snapshotsList(dataRepo ?? 'none'),
    enabled: !!octokit && !!dataRepo,
    staleTime: 30_000,
    queryFn: async () => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      const { owner, repo } = splitRepoPath(dataRepo);
      return listSnapshots(octokit, { owner, repo });
    },
  });
}
