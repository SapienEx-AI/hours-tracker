import type { IntegrationsConfig } from '@/schema/types';
import type { ClassificationResult } from './slack';

export type CalendarEvent = {
  readonly id: string;
  readonly title: string;
  readonly durationMinutes: number;
  readonly attendeeDomains: readonly string[];
};

type CalendarClassifierInputs = {
  hasExternal: boolean;
  allInternal: boolean;
  matchesTrainingKeyword: boolean;
  meetsWorkshopDuration: boolean;
};

function computeInputs(
  event: CalendarEvent,
  config: IntegrationsConfig,
): CalendarClassifierInputs {
  const c = config.calendar ?? {};
  const keywords = c.client_training_title_keywords ?? [];
  const workshopMin = c.workshop_min_duration_minutes ?? 120;
  const internalDomains = new Set(c.internal_only_attendee_domains ?? []);
  const lc = event.title.toLowerCase();
  const hasExternal = event.attendeeDomains.some((d) => !internalDomains.has(d));
  const allInternal =
    event.attendeeDomains.length > 0 &&
    event.attendeeDomains.every((d) => internalDomains.has(d));
  return {
    hasExternal,
    allInternal,
    matchesTrainingKeyword: keywords.some((k) => lc.includes(k.toLowerCase())),
    meetsWorkshopDuration: event.durationMinutes >= workshopMin,
  };
}

export function classifyCalendarEvent(
  event: CalendarEvent,
  config: IntegrationsConfig,
): ClassificationResult {
  const inputs = computeInputs(event, config);
  if (inputs.hasExternal && inputs.matchesTrainingKeyword) {
    return { direction: 'client', suggestedKind: 'client_training', suggestedProjectId: null };
  }
  if (inputs.hasExternal && inputs.meetsWorkshopDuration) {
    return { direction: 'client', suggestedKind: 'workshop', suggestedProjectId: null };
  }
  if (inputs.allInternal) {
    return { direction: 'internal', suggestedKind: 'internal_sync', suggestedProjectId: null };
  }
  return { direction: 'client', suggestedKind: 'meeting', suggestedProjectId: null };
}
