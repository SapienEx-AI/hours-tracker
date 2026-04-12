/**
 * TokenProvider abstracts the source of the GitHub API token.
 *
 * This indirection exists so the PAT implementation (MVP) can be swapped for
 * a future OAuth device-flow implementation without touching Octokit consumers.
 * Spec §6.1 "Future upgrade path."
 */
export interface TokenProvider {
  /** Get the current token, or null if not signed in. */
  getToken(): string | null;
  /** Persist a new token. Throws if the format is obviously invalid. */
  setToken(token: string): void;
  /** Clear the stored token (sign out). */
  clearToken(): void;
}
