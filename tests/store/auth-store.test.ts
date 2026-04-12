import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore, __resetAuthStoreForTests } from '@/store/auth-store';

describe('useAuthStore', () => {
  beforeEach(() => {
    __resetAuthStoreForTests();
  });

  it('starts unauthenticated with null partner and null consultant', () => {
    const state = useAuthStore.getState();
    expect(state.partnerId).toBeNull();
    expect(state.consultantSlug).toBeNull();
    expect(state.dataRepo).toBeNull();
    expect(state.token).toBeNull();
  });

  it('completeFirstRun stores partner, slug, data repo, and token in one atomic update', () => {
    useAuthStore.getState().completeFirstRun({
      partnerId: 'sector-growth',
      consultantSlug: 'prash',
      dataRepo: 'sapienEx-AI/hours-data-sector-growth-prash',
      token: 'github_pat_' + 'a'.repeat(80),
    });
    const state = useAuthStore.getState();
    expect(state.partnerId).toBe('sector-growth');
    expect(state.consultantSlug).toBe('prash');
    expect(state.dataRepo).toBe('sapienEx-AI/hours-data-sector-growth-prash');
    expect(state.token).toMatch(/^github_pat_/);
  });

  it('signOut clears all state', () => {
    useAuthStore.getState().completeFirstRun({
      partnerId: 'sector-growth',
      consultantSlug: 'prash',
      dataRepo: 'sapienEx-AI/hours-data-sector-growth-prash',
      token: 'github_pat_' + 'a'.repeat(80),
    });
    useAuthStore.getState().signOut();
    const state = useAuthStore.getState();
    expect(state.partnerId).toBeNull();
    expect(state.token).toBeNull();
  });

  it('rehydrates from localStorage on creation if all keys are present', () => {
    window.localStorage.setItem('sapienex:hours-tracker:partner_id', 'sector-growth');
    window.localStorage.setItem('sapienex:hours-tracker:consultant_slug', 'prash');
    window.localStorage.setItem(
      'sapienex:hours-tracker:data_repo',
      'sapienEx-AI/hours-data-sector-growth-prash',
    );
    window.localStorage.setItem(
      'sapienex:hours-tracker:token',
      'github_pat_' + 'a'.repeat(80),
    );
    useAuthStore.getState().rehydrateFromStorage();
    const state = useAuthStore.getState();
    expect(state.partnerId).toBe('sector-growth');
    expect(state.consultantSlug).toBe('prash');
  });
});
