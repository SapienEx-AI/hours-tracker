import type { Octokit } from '@octokit/rest';
import type { Entry, EntriesFile, EffortItem, EffortKind } from '@/schema/types';
import {
  validateEntries,
  formatValidationErrors,
  collapseAndSortEffort,
} from '@/schema/validators';
import { readJsonFile, writeJsonFileWithRetry, FileNotFoundError } from './github-file';
import { logMessage } from './commit-messages';

function entriesPath(month: string): string {
  return `data/entries/${month}.json`;
}

/**
 * Upgrade any legacy file (v1-v5) to v6. Strips every legacy field:
 *   - `source_event_id` (forbidden in v3+)
 *   - `effort_kind` + `effort_count` (replaced by `effort` array in v6)
 * Synthesizes `source_ref` from the legacy id when missing, and lifts the
 * v5 scalar pair into the v6 `effort` array.
 *
 * Already-v6 files still run the cleanup pass — belt-and-suspenders
 * recovery for drift from pre-fix writers.
 */
export function upgradeEntriesFileToV6(file: EntriesFile): EntriesFile {
  const entries = file.entries.map((e) => {
    const anyE = e as Entry & {
      source_event_id?: string | null;
      effort_kind?: EffortKind | null;
      effort_count?: number | null;
    };
    const legacyId = anyE.source_event_id;
    const cleaned: Record<string, unknown> = { ...anyE };
    delete cleaned.source_event_id;
    delete cleaned.effort_kind;
    delete cleaned.effort_count;
    if (cleaned.source_ref === undefined) {
      cleaned.source_ref =
        legacyId === undefined || legacyId === null
          ? null
          : { kind: 'calendar', id: legacyId };
    }
    // Lift v5 scalar pair into the v6 effort array.
    let effort: EffortItem[] = Array.isArray((anyE as Entry).effort)
      ? [...(anyE as Entry).effort]
      : [];
    if (effort.length === 0) {
      const k = anyE.effort_kind;
      const c = anyE.effort_count;
      if (k !== null && k !== undefined && c !== null && c !== undefined) {
        effort = [{ kind: k, count: c }];
      }
    }
    cleaned.effort = collapseAndSortEffort(effort);
    return cleaned as Entry;
  });
  if (file.schema_version === 6) {
    return { ...file, entries };
  }
  return { ...file, schema_version: 6, entries };
}

function schemaUpgradeSuffix(fromVersion: EntriesFile['schema_version']): string {
  if (fromVersion === 6) return '';
  return ` [schema v${fromVersion}→v6]`;
}

function sourceTag(entry: Entry): 'calendar' | 'timer' | 'slack' | 'gmail' | undefined {
  if (entry.source_ref === null) return undefined;
  return entry.source_ref.kind;
}

/**
 * Third layer of uniqueness-by-kind defense (spec §3.2): reject any entry
 * whose `effort` array has a duplicate `kind`. Validator + upgrader
 * normalize duplicates; this asserts nothing slipped past them.
 */
function assertEffortUnique(entry: Entry, path: string): void {
  const seen = new Set<EffortKind>();
  for (const item of entry.effort) {
    if (seen.has(item.kind)) {
      throw new Error(
        `Entry ${entry.id} in ${path} has duplicate effort.kind="${item.kind}" — must be unique.`,
      );
    }
    seen.add(item.kind);
  }
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

  assertEffortUnique(args.entry, path);

  const probe: EntriesFile = { schema_version: 6, month, entries: [args.entry] };
  const validation = validateEntries(probe);
  if (!validation.ok) {
    throw new Error(`Entry failed validation:\n${formatValidationErrors(validation.errors)}`);
  }

  const src = sourceTag(args.entry);
  const baseMessage = logMessage(
    src !== undefined
      ? {
          project: args.entry.project,
          date: args.entry.date,
          hours_hundredths: args.entry.hours_hundredths,
          rate_cents: args.entry.rate_cents,
          description: args.entry.description,
          source: src,
          effort: args.entry.effort,
        }
      : {
          project: args.entry.project,
          date: args.entry.date,
          hours_hundredths: args.entry.hours_hundredths,
          rate_cents: args.entry.rate_cents,
          description: args.entry.description,
          effort: args.entry.effort,
        },
  );

  await writeJsonFileWithRetry<EntriesFile>(octokit, {
    owner: args.owner,
    repo: args.repo,
    path,
    // Message is built per-attempt so the [schema vN→v5] suffix reflects
    // the actual on-disk version read during this attempt (retries may see
    // a different version if another writer landed in between).
    message: (current) => {
      const fromVersion: EntriesFile['schema_version'] = current?.schema_version ?? 6;
      return baseMessage + schemaUpgradeSuffix(fromVersion);
    },
    transform: (current) => {
      const base: EntriesFile = current ?? {
        schema_version: 6,
        month,
        entries: [],
      };
      if (base.entries.some((e) => e.id === args.entry.id)) {
        throw new Error(`Duplicate entry id ${args.entry.id} — refusing to overwrite.`);
      }
      const upgraded = upgradeEntriesFileToV6(base);
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

  assertEffortUnique(args.entry, path);

  await writeJsonFileWithRetry<EntriesFile>(octokit, {
    owner: args.owner,
    repo: args.repo,
    path,
    message: args.message,
    transform: (current) => {
      if (!current) {
        throw new Error(`Cannot update entry in missing month file: ${path}`);
      }
      const upgraded = upgradeEntriesFileToV6(current);
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
      const upgraded = upgradeEntriesFileToV6(current);
      return {
        ...upgraded,
        entries: upgraded.entries.filter((e) => e.id !== args.entryId),
      };
    },
  });
}
