import type { EffortSourceAdapter, DigestRow } from './types';
import type { EffortKind, IntegrationsConfig } from '@/schema/types';
import { classifyGmailThread } from '@/integrations/classification/gmail';
import { heuristicHoursHundredths, MINUTES_PER_UNIT } from '@/integrations/heuristics';
import type { GmailThreadResult } from '@/integrations/google/gmail-api';

export type GmailAdapterDeps = {
  readonly config: IntegrationsConfig;
  readonly fetchThreads: (date: string) => Promise<GmailThreadResult[]>;
  readonly isConnected: () => boolean;
  readonly connect: () => Promise<void>;
  readonly disconnect: () => Promise<void>;
};

type Group = {
  direction: 'client' | 'internal' | 'ambiguous';
  projectId: string | null;
  kind: EffortKind;
  threadIds: string[];
};

function minutesPerUnit(direction: Group['direction']): number {
  return direction === 'client' ? MINUTES_PER_UNIT.email.client : MINUTES_PER_UNIT.email.internal;
}

function labelFor(direction: Group['direction'], projectId: string | null, count: number): string {
  const tail = direction === 'client' ? projectId ?? 'client' : direction;
  return `Email → ${tail} (${count} threads)`;
}

export class GmailAdapter implements EffortSourceAdapter {
  readonly source = 'gmail' as const;
  private readonly deps: GmailAdapterDeps;

  constructor(deps: GmailAdapterDeps) {
    this.deps = deps;
  }

  isConnected(): boolean {
    return this.deps.isConnected();
  }

  async connect(): Promise<void> {
    await this.deps.connect();
  }

  async disconnect(): Promise<void> {
    await this.deps.disconnect();
  }

  async fetchDailyDigest(date: string): Promise<DigestRow[]> {
    if (!this.deps.isConnected()) return [];
    if (this.deps.config.gmail?.enabled === false) return [];
    const threads = await this.deps.fetchThreads(date);
    const groups = new Map<string, Group>();

    for (const thread of threads) {
      const c = classifyGmailThread(thread, this.deps.config);
      const key = `${c.direction}|${c.suggestedProjectId ?? ''}|${c.suggestedKind}`;
      const existing = groups.get(key);
      if (existing) {
        existing.threadIds.push(thread.threadId);
      } else {
        groups.set(key, {
          direction: c.direction,
          projectId: c.suggestedProjectId,
          kind: c.suggestedKind,
          threadIds: [thread.threadId],
        });
      }
    }

    const rows: DigestRow[] = [];
    for (const g of groups.values()) {
      rows.push({
        source: 'gmail',
        direction: g.direction,
        count: g.threadIds.length,
        heuristicHoursHundredths: heuristicHoursHundredths(minutesPerUnit(g.direction), g.threadIds.length),
        suggestedKind: g.kind,
        suggestedProjectId: g.projectId,
        batchId: `daily:${date}:${g.direction}:${g.projectId ?? 'unmatched'}`,
        items: g.threadIds.map((id) => ({
          timestamp: `${date}T00:00:00Z`,
          label: id,
          externalId: id,
        })),
        label: labelFor(g.direction, g.projectId, g.threadIds.length),
      });
    }

    return rows;
  }
}
