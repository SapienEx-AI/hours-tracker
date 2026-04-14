import type { Octokit } from '@octokit/rest';
import type { Entry, EntriesFile } from '@/schema/types';
import { writeJsonFileWithRetry } from './github-file';
import { validateEntries, formatValidationErrors } from '@/schema/validators';
import { bulkEditMessage } from './commit-messages';

export type ApplyBulkRateArgs = {
  owner: string;
  repo: string;
  matched: Entry[];
  newRateCents: number;
  filterDescription: string;
};

function entriesPath(month: string): string {
  return `data/entries/${month}.json`;
}

export async function applyBulkRateUpdate(
  octokit: Octokit,
  args: ApplyBulkRateArgs,
): Promise<void> {
  const byMonth = new Map<string, Set<string>>();
  for (const e of args.matched) {
    const m = e.date.slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, new Set());
    byMonth.get(m)!.add(e.id);
  }
  const message = bulkEditMessage({
    rate_cents: args.newRateCents,
    count: args.matched.length,
    filter: args.filterDescription,
  });
  const now = new Date().toISOString();
  for (const [month, ids] of byMonth) {
    await writeJsonFileWithRetry<EntriesFile>(octokit, {
      owner: args.owner,
      repo: args.repo,
      path: entriesPath(month),
      message,
      transform: (current) => {
        if (!current) throw new Error(`Cannot bulk-update missing file ${entriesPath(month)}`);
        const next: EntriesFile = {
          ...current,
          entries: current.entries.map((e) =>
            ids.has(e.id)
              ? {
                  ...e,
                  rate_cents: args.newRateCents,
                  rate_source: 'entry_override' as const,
                  updated_at: now,
                }
              : e,
          ),
        };
        const v = validateEntries(next);
        if (!v.ok) throw new Error(`Bulk update failed validation:\n${formatValidationErrors(v.errors)}`);
        return next;
      },
    });
  }
}
