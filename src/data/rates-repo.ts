import type { Octokit } from '@octokit/rest';
import type { RatesConfig } from '@/schema/types';
import { validateRates, formatValidationErrors } from '@/schema/validators';
import { readJsonFile, writeJsonFileWithRetry, FileNotFoundError } from './github-file';

const PATH = 'config/rates.json';

export async function loadRates(
  octokit: Octokit,
  args: { owner: string; repo: string },
): Promise<{ data: RatesConfig; sha: string | null }> {
  try {
    const read = await readJsonFile<RatesConfig>(octokit, {
      owner: args.owner,
      repo: args.repo,
      path: PATH,
    });
    const v = validateRates(read.data);
    if (!v.ok) {
      throw new Error(
        `Rates file failed validation:\n${formatValidationErrors(v.errors)}`,
      );
    }
    return { data: v.value, sha: read.sha };
  } catch (e) {
    if (e instanceof FileNotFoundError) {
      // An empty rates history is INVALID by schema. Return a minimal
      // fallback seeded with the spec §13 default rate.
      return {
        data: {
          schema_version: 1,
          default_rate_history: [
            {
              effective_from: '2026-04-11',
              rate_cents: 12500,
              note: 'Initial rate — seeded by app fallback',
            },
          ],
        },
        sha: null,
      };
    }
    throw e;
  }
}

export async function writeRates(
  octokit: Octokit,
  args: { owner: string; repo: string; message: string; data: RatesConfig },
): Promise<void> {
  const v = validateRates(args.data);
  if (!v.ok) {
    throw new Error(`Rates file failed validation:\n${formatValidationErrors(v.errors)}`);
  }
  await writeJsonFileWithRetry<RatesConfig>(octokit, {
    owner: args.owner,
    repo: args.repo,
    path: PATH,
    message: args.message,
    transform: () => args.data,
  });
}
