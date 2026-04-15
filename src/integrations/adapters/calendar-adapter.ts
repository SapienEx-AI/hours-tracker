import type { EffortSourceAdapter, DigestRow, DigestDirection } from './types';
import type { IntegrationsConfig } from '@/schema/types';
import { classifyCalendarEvent } from '@/integrations/classification/calendar';
import { heuristicHoursHundredths } from '@/integrations/heuristics';

export type RawCalendarEvent = {
  readonly id: string;
  readonly title: string;
  readonly startTime: string;
  readonly durationMinutes: number;
  readonly attendeeDomains: readonly string[];
};

export type CalendarAdapterDeps = {
  readonly config: IntegrationsConfig;
  readonly fetchEvents: (date: string) => Promise<RawCalendarEvent[]>;
  readonly isConnected: () => boolean;
  readonly connect: () => Promise<void>;
  readonly disconnect: () => Promise<void>;
};

const SHORT_MEETING_MAX_MIN = 30;

function isSubstantiveEvent(
  event: RawCalendarEvent,
  kind: ReturnType<typeof classifyCalendarEvent>['suggestedKind'],
): boolean {
  if (kind === 'workshop' || kind === 'client_training') return true;
  return event.durationMinutes >= SHORT_MEETING_MAX_MIN;
}

export class CalendarAdapter implements EffortSourceAdapter {
  readonly source = 'calendar' as const;
  private readonly deps: CalendarAdapterDeps;

  constructor(deps: CalendarAdapterDeps) {
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
    const events = await this.deps.fetchEvents(date);
    const individual: DigestRow[] = [];
    const shortByDirection = new Map<DigestDirection, RawCalendarEvent[]>();

    for (const event of events) {
      const classification = classifyCalendarEvent(event, this.deps.config);
      if (isSubstantiveEvent(event, classification.suggestedKind)) {
        individual.push({
          source: 'calendar',
          direction: classification.direction,
          count: 1,
          heuristicHoursHundredths: heuristicHoursHundredths(event.durationMinutes, 1),
          suggestedKind: classification.suggestedKind,
          suggestedProjectId: classification.suggestedProjectId,
          batchId: event.id,
          items: [{ timestamp: event.startTime, label: event.title, externalId: event.id }],
          label: event.title,
        });
      } else {
        const bucket = shortByDirection.get(classification.direction) ?? [];
        bucket.push(event);
        shortByDirection.set(classification.direction, bucket);
      }
    }

    for (const [direction, batch] of shortByDirection) {
      if (batch.length === 0) continue;
      const totalMinutes = batch.reduce((sum, e) => sum + e.durationMinutes, 0);
      const first = batch[0]!;
      const kind = classifyCalendarEvent(first, this.deps.config).suggestedKind;
      individual.push({
        source: 'calendar',
        direction,
        count: batch.length,
        heuristicHoursHundredths: heuristicHoursHundredths(totalMinutes, 1),
        suggestedKind: kind,
        suggestedProjectId: null,
        batchId: `daily:${date}:short-meetings-${direction}`,
        items: batch.map((e) => ({ timestamp: e.startTime, label: e.title, externalId: e.id })),
        label: `Calendar — short meetings (${batch.length})`,
      });
    }

    return individual;
  }
}
