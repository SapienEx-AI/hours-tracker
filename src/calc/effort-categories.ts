import type { EffortKind, EffortCategory } from '@/schema/types';

/**
 * Pure mapping from EffortKind to EffortCategory. Exhaustive switch —
 * adding a new EffortKind will fail to compile until it is mapped here.
 *
 * Categories drive the dashboard's 5-way palette and the rollup summary
 * (EffortSummaryCard). "other" intentionally folds into "enablement" for
 * aggregation; dashboards may still surface "other" as its own line when
 * its count is significant.
 */
export function categoryOf(kind: EffortKind): EffortCategory {
  switch (kind) {
    case 'workshop':
    case 'meeting':
    case 'client_training':
      return 'client_sync';
    case 'config_work':
    case 'build':
    case 'integration':
    case 'data_work':
    case 'reporting':
    case 'qa':
      return 'technical';
    case 'slack':
    case 'email':
    case 'async_video':
    case 'ticket':
      return 'client_async';
    case 'internal_sync':
    case 'documentation':
    case 'peer_review':
      return 'internal';
    case 'learning':
    case 'scoping':
    case 'other':
      return 'enablement';
  }
}

export const ALL_EFFORT_KINDS: ReadonlyArray<EffortKind> = [
  'workshop', 'meeting', 'client_training',
  'config_work', 'build', 'integration', 'data_work', 'reporting', 'qa',
  'slack', 'email', 'async_video', 'ticket',
  'internal_sync', 'documentation', 'peer_review',
  'learning', 'scoping',
  'other',
];

export const ALL_EFFORT_CATEGORIES: ReadonlyArray<EffortCategory> = [
  'client_sync', 'technical', 'client_async', 'internal', 'enablement',
];

export function emptyByKind(): Record<EffortKind, number> {
  const out = {} as Record<EffortKind, number>;
  for (const k of ALL_EFFORT_KINDS) out[k] = 0;
  return out;
}

export function emptyByCategory(): Record<EffortCategory, number> {
  return {
    client_sync: 0,
    technical: 0,
    client_async: 0,
    internal: 0,
    enablement: 0,
  };
}
