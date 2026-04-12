import { create } from 'zustand';
import { PatTokenProvider } from '@/auth/pat-provider';

const KEYS = {
  partnerId: 'sapienex:hours-tracker:partner_id',
  consultantSlug: 'sapienex:hours-tracker:consultant_slug',
  dataRepo: 'sapienex:hours-tracker:data_repo',
} as const;

export type AuthState = {
  partnerId: string | null;
  consultantSlug: string | null;
  dataRepo: string | null;
  token: string | null;
  completeFirstRun: (args: {
    partnerId: string;
    consultantSlug: string;
    dataRepo: string;
    token: string;
  }) => void;
  signOut: () => void;
  rehydrateFromStorage: () => void;
};

const initialState = {
  partnerId: null,
  consultantSlug: null,
  dataRepo: null,
  token: null,
};

const tokenProvider = new PatTokenProvider();

/**
 * Auth store: partner, consultant slug, data repo, and GitHub token.
 *
 * Persisted in localStorage via four keys (spec §8.1.1). Rehydrates on app
 * start. Writes go through both the store and localStorage atomically inside
 * completeFirstRun / signOut.
 */
export const useAuthStore = create<AuthState>((set) => ({
  ...initialState,
  completeFirstRun({ partnerId, consultantSlug, dataRepo, token }) {
    window.localStorage.setItem(KEYS.partnerId, partnerId);
    window.localStorage.setItem(KEYS.consultantSlug, consultantSlug);
    window.localStorage.setItem(KEYS.dataRepo, dataRepo);
    tokenProvider.setToken(token);
    set({ partnerId, consultantSlug, dataRepo, token });
  },
  signOut() {
    window.localStorage.removeItem(KEYS.partnerId);
    window.localStorage.removeItem(KEYS.consultantSlug);
    window.localStorage.removeItem(KEYS.dataRepo);
    tokenProvider.clearToken();
    set(initialState);
  },
  rehydrateFromStorage() {
    const partnerId = window.localStorage.getItem(KEYS.partnerId);
    const consultantSlug = window.localStorage.getItem(KEYS.consultantSlug);
    const dataRepo = window.localStorage.getItem(KEYS.dataRepo);
    const token = tokenProvider.getToken();
    if (partnerId && consultantSlug && dataRepo && token) {
      set({ partnerId, consultantSlug, dataRepo, token });
    }
  },
}));

/**
 * Reset auth store + localStorage to a clean slate. Intended for tests and
 * never called from production code paths.
 */
export function __resetAuthStoreForTests(): void {
  window.localStorage.clear();
  useAuthStore.setState(initialState);
}
