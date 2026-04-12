import { useMemo } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { makeOctokit } from '@/data/octokit-client';

/**
 * Returns a memoized Octokit instance bound to the current auth token.
 * Returns null when unauthenticated.
 */
export function useOctokit() {
  const token = useAuthStore((s) => s.token);
  return useMemo(() => (token ? makeOctokit(token) : null), [token]);
}
