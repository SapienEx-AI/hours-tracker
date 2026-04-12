import { Octokit } from '@octokit/rest';

/**
 * Octokit factory. Takes a token and returns a configured client with retry
 * disabled (we handle retries explicitly in the repo modules for visibility).
 */
export function makeOctokit(token: string): Octokit {
  return new Octokit({
    auth: token,
    userAgent: 'hours-tracker',
    request: {
      retries: 0,
    },
  });
}

/** Base64-encode a UTF-8 string for the GitHub contents API. */
export function encodeContent(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Decode a base64 string from the GitHub contents API as UTF-8. */
export function decodeContent(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export type RepoParts = { owner: string; repo: string };

/** Parse "owner/repo" into {owner, repo}. Throws if malformed. */
export function splitRepoPath(path: string): RepoParts {
  const parts = path.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid repo path "${path}". Expected "owner/repo".`);
  }
  return { owner: parts[0], repo: parts[1] };
}
