import type { Octokit } from '@octokit/rest';
import type { Entry, EntriesFile } from '@/schema/types';
import { validateEntries, formatValidationErrors } from '@/schema/validators';
import { readJsonFile, writeJsonFileWithRetry, FileNotFoundError } from './github-file';
import { logMessage } from './commit-messages';

function entriesPath(month: string): string {
  return `data/entries/${month}.json`;
}

/**
 * Upgrade a v1 or v2 file to v3. The validator has already lifted any legacy
 * source_event_id into source_ref on read, so file.entries are already v3
 * shape in memory — we just bump the version on the wire and ensure source_ref
 * is set.
 *
 * Returns the input file unchanged when it is already v3.
 */
export function upgradeEntriesFileToV3(file: EntriesFile): EntriesFile {
  if (file.schema_version === 3) return file;
  return {
    ...file,
    schema_version: 3,
    entries: file.entries.map((e) => ({ ...e, source_ref: e.source_ref ?? null })),
  };
}

function schemaUpgradeSuffix(fromVersion: EntriesFile['schema_version']): string {
  if (fromVersion === 3) return '';
  return ` [schema v${fromVersion}→v3]`;
}

function sourceTag(entry: Entry): 'calendar' | 'timer' | undefined {
  if (entry.source_ref === null) return undefined;
  return entry.source_ref.kind;
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

  const probe: EntriesFile = { schema_version: 3, month, entries: [args.entry] };
  const validation = validateEntries(probe);
  if (!validation.ok) {
    throw new Error(`Entry failed validation:\n${formatValidationErrors(validation.errors)}`);
  }

  let upgradeFrom: EntriesFile['schema_version'] = 3;
  const src = sourceTag(args.entry);

  await writeJsonFileWithRetry<EntriesFile>(octokit, {
    owner: args.owner,
    repo: args.repo,
    path,
    message:
      logMessage(
        src !== undefined
          ? {
              project: args.entry.project,
              date: args.entry.date,
              hours_hundredths: args.entry.hours_hundredths,
              rate_cents: args.entry.rate_cents,
              description: args.entry.description,
              source: src,
            }
          : {
              project: args.entry.project,
              date: args.entry.date,
              hours_hundredths: args.entry.hours_hundredths,
              rate_cents: args.entry.rate_cents,
              description: args.entry.description,
            },
      ) + schemaUpgradeSuffix(upgradeFrom),
    transform: (current) => {
      const base: EntriesFile = current ?? {
        schema_version: 3,
        month,
        entries: [],
      };
      upgradeFrom = base.schema_version;
      if (base.entries.some((e) => e.id === args.entry.id)) {
        throw new Error(`Duplicate entry id ${args.entry.id} — refusing to overwrite.`);
      }
      const upgraded = upgradeEntriesFileToV3(base);
      return {
        ...upgraded,
        entries: [...upgraded.entries, args.entry],
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
      const upgraded = upgradeEntriesFileToV3(current);
      const idx = upgraded.entries.findIndex((e) => e.id === args.entry.id);
      if (idx < 0) {
        throw new Error(`Entry id ${args.entry.id} not found in ${path}`);
      }
      const next = [...upgraded.entries];
      next[idx] = { ...args.entry, updated_at: new Date().toISOString() };
      const updated: EntriesFile = { ...upgraded, entries: next };
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
      const upgraded = upgradeEntriesFileToV3(current);
      return {
        ...upgraded,
        entries: upgraded.entries.filter((e) => e.id !== args.entryId),
      };
    },
  });
}
