import type { Octokit } from '@octokit/rest';
import { readJsonFile, writeJsonFileWithRetry, FileNotFoundError } from './github-file';
import { validateIntegrationsConfig, formatValidationErrors } from '@/schema/validators';
import type { IntegrationsConfig } from '@/schema/types';

const CONFIG_PATH = 'config/integrations.json';

export type LoadArgs = { owner: string; repo: string };

export async function loadIntegrationsConfig(
  octokit: Octokit,
  args: LoadArgs,
): Promise<IntegrationsConfig | null> {
  try {
    const read = await readJsonFile<unknown>(octokit, {
      owner: args.owner,
      repo: args.repo,
      path: CONFIG_PATH,
    });
    const result = validateIntegrationsConfig(read.data);
    if (!result.ok) {
      throw new Error(
        `config/integrations.json failed validation:\n${formatValidationErrors(result.errors)}`,
      );
    }
    return result.value;
  } catch (err) {
    if (err instanceof FileNotFoundError) return null;
    throw err;
  }
}

export type SaveArgs = LoadArgs & {
  config: IntegrationsConfig;
  message: string;
};

export async function saveIntegrationsConfig(
  octokit: Octokit,
  args: SaveArgs,
): Promise<void> {
  const result = validateIntegrationsConfig(args.config);
  if (!result.ok) {
    throw new Error(
      `Cannot save invalid integrations.json:\n${formatValidationErrors(result.errors)}`,
    );
  }
  await writeJsonFileWithRetry<IntegrationsConfig>(octokit, {
    owner: args.owner,
    repo: args.repo,
    path: CONFIG_PATH,
    message: args.message,
    transform: () => result.value,
  });
}
