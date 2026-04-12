import type { TokenProvider } from './token-provider';

const STORAGE_KEY = 'sapienex:hours-tracker:token';

/**
 * localStorage-backed fine-grained PAT provider.
 *
 * The token must start with `github_pat_` (new fine-grained) or `ghp_`
 * (classic; allowed for backward compatibility but not recommended).
 * Any other format throws — we refuse to store obviously wrong input.
 *
 * Spec §6.1.
 */
export class PatTokenProvider implements TokenProvider {
  getToken(): string | null {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  setToken(token: string): void {
    if (!PatTokenProvider.looksLikeGitHubToken(token)) {
      throw new Error(
        'Rejected token: expected a fine-grained PAT starting with "github_pat_" (preferred) or a classic PAT starting with "ghp_".',
      );
    }
    window.localStorage.setItem(STORAGE_KEY, token);
  }

  clearToken(): void {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  static looksLikeGitHubToken(token: string): boolean {
    return token.startsWith('github_pat_') || token.startsWith('ghp_');
  }
}
