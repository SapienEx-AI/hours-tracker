import type { EffortKind, EffortCategory } from '@/schema/types';

/**
 * Pure mapping from EffortKind to EffortCategory. Record literal is
 * exhaustiveness-checked by TypeScript — adding a new EffortKind will
 * fail to compile until it is mapped here.
 *
 * Categories drive the dashboard's 5-way palette and the rollup summary
 * (EffortSummaryCard). "other" intentionally folds into "enablement" for
 * aggregation; dashboards may still surface "other" as its own line when
 * its count is significant.
 */
const KIND_TO_CATEGORY: Record<EffortKind, EffortCategory> = {
  workshop: 'client_sync',
  meeting: 'client_sync',
  client_training: 'client_sync',
  config_work: 'technical',
  build: 'technical',
  integration: 'technical',
  data_work: 'technical',
  reporting: 'technical',
  qa: 'technical',
  slack: 'client_async',
  email: 'client_async',
  async_video: 'client_async',
  ticket: 'client_async',
  internal_sync: 'internal',
  documentation: 'internal',
  peer_review: 'internal',
  learning: 'enablement',
  scoping: 'enablement',
  other: 'enablement',
};

export function categoryOf(kind: EffortKind): EffortCategory {
  return KIND_TO_CATEGORY[kind];
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
