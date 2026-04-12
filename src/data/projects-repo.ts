import type { Octokit } from '@octokit/rest';
import type { ProjectsConfig } from '@/schema/types';
import { validateProjects, formatValidationErrors } from '@/schema/validators';
import { readJsonFile, writeJsonFileWithRetry, FileNotFoundError } from './github-file';

const PATH = 'config/projects.json';

export async function loadProjects(
  octokit: Octokit,
  args: { owner: string; repo: string },
): Promise<{ data: ProjectsConfig; sha: string | null }> {
  try {
    const read = await readJsonFile<ProjectsConfig>(octokit, {
      owner: args.owner,
      repo: args.repo,
      path: PATH,
    });
    const v = validateProjects(read.data);
    if (!v.ok) {
      throw new Error(
        `Projects file failed validation:\n${formatValidationErrors(v.errors)}`,
      );
    }
    return { data: v.value, sha: read.sha };
  } catch (e) {
    if (e instanceof FileNotFoundError) {
      return { data: { schema_version: 1, projects: [] }, sha: null };
    }
    throw e;
  }
}

export async function writeProjects(
  octokit: Octokit,
  args: { owner: string; repo: string; message: string; data: ProjectsConfig },
): Promise<void> {
  const v = validateProjects(args.data);
  if (!v.ok) {
    throw new Error(`Projects file failed validation:\n${formatValidationErrors(v.errors)}`);
  }
  await writeJsonFileWithRetry<ProjectsConfig>(octokit, {
    owner: args.owner,
    repo: args.repo,
    path: PATH,
    message: args.message,
    transform: () => args.data,
  });
}
