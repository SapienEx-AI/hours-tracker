import { describe, it, expect, beforeEach } from 'vitest';
import { PatTokenProvider } from '@/auth/pat-provider';

describe('PatTokenProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns null when no token is stored', () => {
    const provider = new PatTokenProvider();
    expect(provider.getToken()).toBeNull();
  });

  it('stores and retrieves a valid fine-grained PAT', () => {
    const provider = new PatTokenProvider();
    const token = 'github_pat_' + 'a'.repeat(80);
    provider.setToken(token);
    expect(provider.getToken()).toBe(token);
  });

  it('throws when setting a token that does not start with github_pat_ or ghp_', () => {
    const provider = new PatTokenProvider();
    expect(() => provider.setToken('not-a-valid-token')).toThrow();
  });

  it('accepts a classic ghp_ token for compatibility', () => {
    const provider = new PatTokenProvider();
    const token = 'ghp_' + 'a'.repeat(36);
    provider.setToken(token);
    expect(provider.getToken()).toBe(token);
  });

  it('clearToken removes the token from storage', () => {
    const provider = new PatTokenProvider();
    provider.setToken('github_pat_' + 'a'.repeat(80));
    provider.clearToken();
    expect(provider.getToken()).toBeNull();
  });

  it('persists across PatTokenProvider instances via localStorage', () => {
    const p1 = new PatTokenProvider();
    p1.setToken('github_pat_' + 'a'.repeat(80));
    const p2 = new PatTokenProvider();
    expect(p2.getToken()).toBe('github_pat_' + 'a'.repeat(80));
  });
});
