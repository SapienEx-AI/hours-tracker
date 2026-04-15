import { describe, it, expect } from 'vitest';
import type { IntegrationsConfig } from '@/schema/types';
import {
  classifyCalendarEvent,
  type CalendarEvent,
} from '@/integrations/classification/calendar';

const config: IntegrationsConfig = {
  schema_version: 1,
  calendar: {
    workshop_min_duration_minutes: 120,
    client_training_title_keywords: ['training', 'workshop'],
    internal_only_attendee_domains: ['sapienex.com'],
  },
};

describe('classifyCalendarEvent', () => {
  it('tags a "training" titled event with external attendees as client_training', () => {
    const event: CalendarEvent = {
      id: 'e1',
      title: 'Acme training session',
      durationMinutes: 60,
      attendeeDomains: ['acme.com', 'sapienex.com'],
    };
    const result = classifyCalendarEvent(event, config);
    expect(result.direction).toBe('client');
    expect(result.suggestedKind).toBe('client_training');
  });

  it('tags a 180-min event with external attendees as workshop', () => {
    const event: CalendarEvent = {
      id: 'e2',
      title: 'Strategy session',
      durationMinutes: 180,
      attendeeDomains: ['acme.com', 'sapienex.com'],
    };
    const result = classifyCalendarEvent(event, config);
    expect(result.suggestedKind).toBe('workshop');
  });

  it('tags an all-internal event as internal_sync', () => {
    const event: CalendarEvent = {
      id: 'e3',
      title: 'Team standup',
      durationMinutes: 15,
      attendeeDomains: ['sapienex.com'],
    };
    const result = classifyCalendarEvent(event, config);
    expect(result.direction).toBe('internal');
    expect(result.suggestedKind).toBe('internal_sync');
  });

  it('falls to client meeting when nothing else matches', () => {
    const event: CalendarEvent = {
      id: 'e4',
      title: 'Acme sync',
      durationMinutes: 30,
      attendeeDomains: ['acme.com', 'sapienex.com'],
    };
    const result = classifyCalendarEvent(event, config);
    expect(result.direction).toBe('client');
    expect(result.suggestedKind).toBe('meeting');
  });
});
