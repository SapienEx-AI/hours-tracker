import type { Octokit } from '@octokit/rest';
import type { Profile } from '@/schema/types';
import { validateProfile, formatValidationErrors } from '@/schema/validators';
import { readJsonFile, writeJsonFile, writeJsonFileWithRetry, FileNotFoundError } from './github-file';

const PATH = 'config/profile.json';

export async function loadProfile(
  octokit: Octokit,
  args: { owner: string; repo: string },
): Promise<Profile | null> {
  try {
    const read = await readJsonFile<Profile>(octokit, {
      owner: args.owner,
      repo: args.repo,
      path: PATH,
    });
    const v = validateProfile(read.data);
    if (!v.ok) {
      throw new Error(
        `Profile file failed validation:\n${formatValidationErrors(v.errors)}`,
      );
    }
    return v.value;
  } catch (e) {
    if (e instanceof FileNotFoundError) return null;
    throw e;
  }
}

export async function createProfile(
  octokit: Octokit,
  args: { owner: string; repo: string; profile: Profile },
): Promise<void> {
  const v = validateProfile(args.profile);
  if (!v.ok) {
    throw new Error(`Profile failed validation:\n${formatValidationErrors(v.errors)}`);
  }
  await writeJsonFile(octokit, {
    owner: args.owner,
    repo: args.repo,
    path: PATH,
    content: args.profile,
    message: `config: init profile for ${args.profile.consultant_id}`,
  });
}

export async function updateProfile(
  octokit: Octokit,
  args: { owner: string; repo: string; profile: Profile },
): Promise<void> {
  const v = validateProfile(args.profile);
  if (!v.ok) {
    throw new Error(`Profile failed validation:\n${formatValidationErrors(v.errors)}`);
  }
  await writeJsonFileWithRetry<Profile>(octokit, {
    owner: args.owner,
    repo: args.repo,
    path: PATH,
    message: `config: update profile for ${args.profile.consultant_id}`,
    transform: () => args.profile,
  });
}
