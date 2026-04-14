import type { Octokit } from '@octokit/rest';
import type { Snapshot } from '@/schema/types';
import { loadSnapshot } from './snapshots-repo';

export async function listSnapshots(
  octokit: Octokit,
  args: { owner: string; repo: string },
): Promise<Snapshot[]> {
  let files: Array<{ name: string }>;
  try {
    const res = await octokit.rest.repos.getContent({
      owner: args.owner,
      repo: args.repo,
      path: 'data/snapshots',
    });
    if (!Array.isArray(res.data)) return [];
    files = (res.data as Array<{ name: string; type: string }>).filter(
      (f) => f.type === 'file' && f.name.endsWith('.json'),
    );
  } catch (e) {
    if ((e as { status?: number }).status === 404) return [];
    throw e;
  }
  const out: Snapshot[] = [];
  for (const f of files) {
    const month = f.name.replace('.json', '');
    const s = await loadSnapshot(octokit, { owner: args.owner, repo: args.repo, month });
    if (s) out.push(s);
  }
  return out.sort((a, b) => a.month.localeCompare(b.month));
}
