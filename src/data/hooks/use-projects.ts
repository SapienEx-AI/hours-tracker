import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { loadProjects } from '@/data/projects-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { qk } from '@/data/query-keys';
import { useOctokit } from './use-octokit';

export function useProjects() {
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);

  return useQuery({
    queryKey: qk.projects(dataRepo ?? 'none'),
    enabled: !!octokit && !!dataRepo,
    queryFn: async () => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      const { owner, repo } = splitRepoPath(dataRepo);
      const result = await loadProjects(octokit, { owner, repo });
      return result.data;
    },
  });
}
