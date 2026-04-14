import type { Octokit } from '@octokit/rest';
import { encodeContent, decodeContent } from './octokit-client';

export class FileNotFoundError extends Error {
  constructor(path: string) {
    super(`GitHub file not found: ${path}`);
    this.name = 'FileNotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(path: string) {
    super(`GitHub write conflict on ${path}. File was modified concurrently.`);
    this.name = 'ConflictError';
  }
}

export type ReadArgs = {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
};

export type ReadResult<T> = {
  data: T;
  sha: string;
  raw: string;
};

export async function readJsonFile<T>(
  octokit: Octokit,
  args: ReadArgs,
): Promise<ReadResult<T>> {
  try {
    const res = await octokit.rest.repos.getContent({
      owner: args.owner,
      repo: args.repo,
      path: args.path,
      ...(args.ref !== undefined ? { ref: args.ref } : {}),
    });
    const d = res.data as { type: string; content: string; sha: string; encoding: string };
    if (d.type !== 'file') {
      throw new Error(`Expected file at ${args.path}, got ${d.type}`);
    }
    const raw = decodeContent(d.content);
    return { data: JSON.parse(raw) as T, sha: d.sha, raw };
  } catch (e) {
    if ((e as { status?: number }).status === 404) {
      throw new FileNotFoundError(args.path);
    }
    throw e;
  }
}

export type WriteArgs = {
  owner: string;
  repo: string;
  path: string;
  content: unknown;
  message: string;
  sha?: string;
};

export type WriteResult = {
  sha: string;
};

export async function writeJsonFile(
  octokit: Octokit,
  args: WriteArgs,
): Promise<WriteResult> {
  const serialized = JSON.stringify(args.content, null, 2) + '\n';
  try {
    const res = await octokit.rest.repos.createOrUpdateFileContents({
      owner: args.owner,
      repo: args.repo,
      path: args.path,
      message: args.message,
      content: encodeContent(serialized),
      ...(args.sha !== undefined ? { sha: args.sha } : {}),
    });
    const sha = (res.data as { content?: { sha?: string } }).content?.sha ?? '';
    return { sha };
  } catch (e) {
    if ((e as { status?: number }).status === 409) {
      throw new ConflictError(args.path);
    }
    throw e;
  }
}

/**
 * Write with one retry on conflict. On first 409, re-read the latest file,
 * let the caller transform the fresh data, and retry the write. If the retry
 * also fails with 409, surface a ConflictError (caller shows a banner).
 *
 * Spec §6.4.
 */
export async function writeJsonFileWithRetry<T>(
  octokit: Octokit,
  args: {
    owner: string;
    repo: string;
    path: string;
    /**
     * Commit message. If a function, it is called with the freshly-read
     * current data for this attempt, so callers can inspect the on-disk
     * shape (e.g. to append a schema-upgrade suffix).
     */
    message: string | ((current: T | null) => string);
    transform: (current: T | null, currentSha: string | null) => unknown;
  },
): Promise<WriteResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    let currentData: T | null = null;
    let currentSha: string | null = null;
    try {
      const read = await readJsonFile<T>(octokit, {
        owner: args.owner,
        repo: args.repo,
        path: args.path,
      });
      currentData = read.data;
      currentSha = read.sha;
    } catch (e) {
      if (!(e instanceof FileNotFoundError)) throw e;
    }
    const nextContent = args.transform(currentData, currentSha);
    const message =
      typeof args.message === 'function' ? args.message(currentData) : args.message;
    try {
      return await writeJsonFile(octokit, {
        owner: args.owner,
        repo: args.repo,
        path: args.path,
        content: nextContent,
        message,
        ...(currentSha !== null ? { sha: currentSha } : {}),
      });
    } catch (e) {
      lastError = e;
      if (e instanceof ConflictError && attempt === 0) continue;
      throw e;
    }
  }
  throw (lastError ?? new ConflictError(args.path)) as Error;
}
