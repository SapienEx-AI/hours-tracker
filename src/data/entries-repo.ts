import type { Octokit } from '@octokit/rest';
import type { Entry, EntriesFile } from '@/schema/types';
import { validateEntries, formatValidationErrors } from '@/schema/validators';
import { readJsonFile, writeJsonFileWithRetry, FileNotFoundError } from './github-file';
import { logMessage } from './commit-messages';

function entriesPath(month: string): string {
  return `data/entries/${month}.json`;
}

export type LoadMonthEntriesArgs = {
  owner: string;
  repo: string;
  month: string;
};

export type LoadMonthEntriesResult = {
  data: EntriesFile;
  sha: string | null;
};

export async function loadMonthEntries(
  octokit: Octokit,
  args: LoadMonthEntriesArgs,
): Promise<LoadMonthEntriesResult> {
  const path = entriesPath(args.month);
  try {
    const read = await readJsonFile<EntriesFile>(octokit, {
      owner: args.owner,
      repo: args.repo,
      path,
    });
    const result = validateEntries(read.data);
    if (!result.ok) {
      throw new Error(
        `Entries file ${path} failed validation:\n${formatValidationErrors(result.errors)}`,
      );
    }
    return { data: result.value, sha: read.sha };
  } catch (e) {
    if (e instanceof FileNotFoundError) {
      return {
        data: { schema_version: 1, month: args.month, entries: [] },
        sha: null,
      };
    }
    throw e;
  }
}

/**
 * Load ALL entries across every month file in the data repo.
 * Used for computing all-time bucket consumption (buckets span months).
 */
export async function loadAllEntries(
  octokit: Octokit,
  args: { owner: string; repo: string },
): Promise<Entry[]> {
  // List data/entries/ directory to discover which months have files.
  let files: Array<{ name: string }>;
  try {
    const res = await octokit.rest.repos.getContent({
      owner: args.owner,
      repo: args.repo,
      path: 'data/entries',
    });
    if (!Array.isArray(res.data)) return [];
    files = (res.data as Array<{ name: string; type: string }>).filter(
      (f) => f.type === 'file' && f.name.endsWith('.json'),
    );
  } catch (e) {
    if ((e as { status?: number }).status === 404) return [];
    throw e;
  }

  // Load each month file and flatten into one array.
  const allEntries: Entry[] = [];
  for (const file of files) {
    const month = file.name.replace('.json', '');
    const result = await loadMonthEntries(octokit, {
      owner: args.owner,
      repo: args.repo,
      month,
    });
    allEntries.push(...result.data.entries);
  }
  return allEntries;
}

export type AddEntryArgs = {
  owner: string;
  repo: string;
  entry: Entry;
};

export async function addEntry(octokit: Octokit, args: AddEntryArgs): Promise<void> {
  const month = args.entry.date.slice(0, 7);
  const path = entriesPath(month);

  // Validate the full entry first as a standalone file (one entry).
  const probe: EntriesFile = { schema_version: 1, month, entries: [args.entry] };
  const validation = validateEntries(probe);
  if (!validation.ok) {
    throw new Error(`Entry failed validation:\n${formatValidationErrors(validation.errors)}`);
  }

  await writeJsonFileWithRetry<EntriesFile>(octokit, {
    owner: args.owner,
    repo: args.repo,
    path,
    message: logMessage({
      project: args.entry.project,
      date: args.entry.date,
      hours_hundredths: args.entry.hours_hundredths,
      rate_cents: args.entry.rate_cents,
      description: args.entry.description,
    }),
    transform: (current) => {
      const base: EntriesFile = current ?? {
        schema_version: 1,
        month,
        entries: [],
      };
      if (base.entries.some((e) => e.id === args.entry.id)) {
        throw new Error(`Duplicate entry id ${args.entry.id} — refusing to overwrite.`);
      }
      return {
        ...base,
        entries: [...base.entries, args.entry],
      };
    },
  });
}

export type UpdateEntryArgs = {
  owner: string;
  repo: string;
  entry: Entry;
  message: string;
};

export async function updateEntry(
  octokit: Octokit,
  args: UpdateEntryArgs,
): Promise<void> {
  const month = args.entry.date.slice(0, 7);
  const path = entriesPath(month);

  await writeJsonFileWithRetry<EntriesFile>(octokit, {
    owner: args.owner,
    repo: args.repo,
    path,
    message: args.message,
    transform: (current) => {
      if (!current) {
        throw new Error(`Cannot update entry in missing month file: ${path}`);
      }
      const idx = current.entries.findIndex((e) => e.id === args.entry.id);
      if (idx < 0) {
        throw new Error(`Entry id ${args.entry.id} not found in ${path}`);
      }
      const next = [...current.entries];
      next[idx] = { ...args.entry, updated_at: new Date().toISOString() };
      const updated: EntriesFile = { ...current, entries: next };
      const v = validateEntries(updated);
      if (!v.ok) {
        throw new Error(
          `Updated entries file failed validation:\n${formatValidationErrors(v.errors)}`,
        );
      }
      return updated;
    },
  });
}

export type DeleteEntryArgs = {
  owner: string;
  repo: string;
  month: string;
  entryId: string;
  message: string;
};

export async function deleteEntry(
  octokit: Octokit,
  args: DeleteEntryArgs,
): Promise<void> {
  const path = entriesPath(args.month);
  await writeJsonFileWithRetry<EntriesFile>(octokit, {
    owner: args.owner,
    repo: args.repo,
    path,
    message: args.message,
    transform: (current) => {
      if (!current) throw new Error(`Cannot delete from missing file ${path}`);
      return {
        ...current,
        entries: current.entries.filter((e) => e.id !== args.entryId),
      };
    },
  });
}
