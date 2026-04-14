/**
 * Centralized React Query key factory. Every cache key in the app is
 * defined here so invalidations are exhaustive and typo-free.
 */
export const qk = {
  all: ['hours-tracker'] as const,
  partnersIndex: () => [...qk.all, 'partners', 'index'] as const,
  partner: (partnerId: string) => [...qk.all, 'partners', partnerId] as const,
  profile: (repo: string) => [...qk.all, 'profile', repo] as const,
  projects: (repo: string) => [...qk.all, 'projects', repo] as const,
  rates: (repo: string) => [...qk.all, 'rates', repo] as const,
  monthEntries: (repo: string, month: string) =>
    [...qk.all, 'entries', repo, month] as const,
  snapshot: (repo: string, month: string) =>
    [...qk.all, 'snapshots', repo, month] as const,
  snapshotsList: (repo: string) => [...qk.all, 'snapshots-list', repo] as const,
  calendarConfig: (repo: string) => [...qk.all, 'calendar-config', repo] as const,
};
