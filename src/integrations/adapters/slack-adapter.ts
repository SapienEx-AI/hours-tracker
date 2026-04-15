import type { EffortSourceAdapter, DigestRow } from './types';
import type { EffortKind, IntegrationsConfig } from '@/schema/types';
import {
  classifySlackChannelActivity,
  classifySlackDmActivity,
} from '@/integrations/classification/slack';
import { heuristicHoursHundredths, MINUTES_PER_UNIT } from '@/integrations/heuristics';
import type { SlackActivityResult } from '@/integrations/slack/client';

export type SlackAdapterDeps = {
  readonly config: IntegrationsConfig;
  readonly workspaceId: string;
  readonly fetchActivity: (date: string) => Promise<SlackActivityResult>;
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
  return direction === 'client' ? MINUTES_PER_UNIT.slack.client : MINUTES_PER_UNIT.slack.internal;
}

function labelFor(direction: Group['direction'], projectId: string | null, count: number): string {
  const tail = direction === 'client' ? projectId ?? 'client' : direction;
  return `Slack → ${tail} (${count} threads)`;
}

function keyOf(
  direction: Group['direction'],
  projectId: string | null,
  kind: EffortKind,
): string {
  return `${direction}|${projectId ?? ''}|${kind}`;
}

function addToGroup(
  groups: Map<string, Group>,
  direction: Group['direction'],
  projectId: string | null,
  kind: EffortKind,
  threadId: string,
): void {
  const key = keyOf(direction, projectId, kind);
  const existing = groups.get(key);
  if (existing) {
    existing.threadIds.push(threadId);
  } else {
    groups.set(key, { direction, projectId, kind, threadIds: [threadId] });
  }
}

export class SlackAdapter implements EffortSourceAdapter {
  readonly source = 'slack' as const;
  private readonly deps: SlackAdapterDeps;

  constructor(deps: SlackAdapterDeps) {
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
    if (this.deps.config.slack?.enabled === false) return [];
    const activity = await this.deps.fetchActivity(date);
    const groups = new Map<string, Group>();

    for (const ch of activity.channelThreads) {
      const c = classifySlackChannelActivity(
        {
          channelName: `#${ch.channelName}`,
          threadTs: ch.threadTs,
          workspaceId: this.deps.workspaceId,
        },
        this.deps.config,
      );
      addToGroup(groups, c.direction, c.suggestedProjectId, c.suggestedKind, ch.threadTs);
    }

    for (const dm of activity.dmThreads) {
      const c = classifySlackDmActivity(
        {
          participantEmails: dm.participantEmails,
          threadTs: dm.threadTs,
          workspaceId: this.deps.workspaceId,
        },
        this.deps.config,
      );
      addToGroup(groups, c.direction, c.suggestedProjectId, c.suggestedKind, dm.threadTs);
    }

    const rows: DigestRow[] = [];
    for (const g of groups.values()) {
      rows.push({
        source: 'slack',
        direction: g.direction,
        count: g.threadIds.length,
        heuristicHoursHundredths: heuristicHoursHundredths(
          minutesPerUnit(g.direction),
          g.threadIds.length,
        ),
        suggestedKind: g.kind,
        suggestedProjectId: g.projectId,
        batchId: `daily:${date}:${g.direction}:${this.deps.workspaceId}:${g.projectId ?? 'unmatched'}`,
        items: g.threadIds.map((ts) => ({
          timestamp: `${date}T00:00:00Z`,
          label: ts,
          externalId: ts,
        })),
        label: labelFor(g.direction, g.projectId, g.threadIds.length),
      });
    }

    return rows;
  }
}
