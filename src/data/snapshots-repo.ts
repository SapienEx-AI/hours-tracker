import type { Octokit } from '@octokit/rest';
import type { Snapshot } from '@/schema/types';
import { validateSnapshot, formatValidationErrors } from '@/schema/validators';
import { readJsonFile, writeJsonFile, FileNotFoundError } from './github-file';
import { snapshotCloseMessage } from './commit-messages';

function snapshotPath(month: string): string {
  return `data/snapshots/${month}.json`;
}

export async function loadSnapshot(
  octokit: Octokit,
  args: { owner: string; repo: string; month: string },
): Promise<Snapshot | null> {
  try {
    const read = await readJsonFile<Snapshot>(octokit, {
      owner: args.owner,
      repo: args.repo,
      path: snapshotPath(args.month),
    });
    const v = validateSnapshot(read.data);
    if (!v.ok) {
      throw new Error(
        `Snapshot file failed validation:\n${formatValidationErrors(v.errors)}`,
      );
    }
    return v.value;
  } catch (e) {
    if (e instanceof FileNotFoundError) return null;
    throw e;
  }
}

export async function writeSnapshot(
  octokit: Octokit,
  args: { owner: string; repo: string; snapshot: Snapshot },
): Promise<void> {
  const v = validateSnapshot(args.snapshot);
  if (!v.ok) {
    throw new Error(`Snapshot failed validation:\n${formatValidationErrors(v.errors)}`);
  }
  await writeJsonFile(octokit, {
    owner: args.owner,
    repo: args.repo,
    path: snapshotPath(args.snapshot.month),
    content: args.snapshot,
    message: snapshotCloseMessage({
      month: args.snapshot.month,
      billable_hours_hundredths: args.snapshot.totals.billable_hours_hundredths,
      non_billable_hours_hundredths: args.snapshot.totals.non_billable_hours_hundredths,
      billable_amount_cents: args.snapshot.totals.billable_amount_cents,
    }),
  });
}
