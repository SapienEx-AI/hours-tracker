import type { Octokit } from '@octokit/rest';
import { loadProfile } from '@/data/profile-repo';

export type ValidateResult =
  | { ok: true; profileExists: boolean }
  | { ok: false; error: string };

/**
 * Validate that the computed data repo exists and (if profile.json is present)
 * matches the selected partner. Spec §8.1.1 Step 2.
 */
export async function validateDataRepo(
  octokit: Octokit,
  args: { owner: string; repo: string; partnerId: string },
): Promise<ValidateResult> {
  try {
    await octokit.rest.repos.get({ owner: args.owner, repo: args.repo });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 404) {
      return {
        ok: false,
        error: `Repo ${args.owner}/${args.repo} not found. Ask your partner admin to create it.`,
      };
    }
    if (status === 403) {
      return {
        ok: false,
        error: `Token lacks access to ${args.owner}/${args.repo}. Check the token's repository permissions.`,
      };
    }
    if (status === 401) {
      return { ok: false, error: 'Token invalid or expired. Generate a new one.' };
    }
    return { ok: false, error: (e as Error).message ?? 'Unknown error' };
  }

  const profile = await loadProfile(octokit, { owner: args.owner, repo: args.repo });
  if (profile && profile.partner_id !== args.partnerId) {
    return {
      ok: false,
      error: `Repo belongs to partner "${profile.partner_id}", but you selected "${args.partnerId}".`,
    };
  }
  return { ok: true, profileExists: profile !== null };
}
