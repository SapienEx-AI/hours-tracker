import { describe, it, expect } from 'vitest';
import { CalendarAdapter } from '@/integrations/adapters/calendar-adapter';
import type { IntegrationsConfig } from '@/schema/types';

const minimalConfig: IntegrationsConfig = {
  schema_version: 1,
  calendar: { workshop_min_duration_minutes: 120 },
};

describe('CalendarAdapter', () => {
  it('reports source: calendar', () => {
    const adapter = new CalendarAdapter({
      config: minimalConfig,
      fetchEvents: async () => [],
      isConnected: () => false,
      connect: async () => {},
      disconnect: async () => {},
    });
    expect(adapter.source).toBe('calendar');
  });

  it('emits a single-event digest row for a workshop', async () => {
    const adapter = new CalendarAdapter({
      config: minimalConfig,
      fetchEvents: async () => [
        {
          id: 'ev1',
          title: 'Acme strategy session',
          startTime: '2026-04-15T10:00:00Z',
          durationMinutes: 180,
          attendeeDomains: ['acme.com', 'sapienex.com'],
        },
      ],
      isConnected: () => true,
      connect: async () => {},
      disconnect: async () => {},
    });
    const rows = await adapter.fetchDailyDigest('2026-04-15');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.suggestedKind).toBe('workshop');
    expect(rows[0]?.count).toBe(1);
    expect(rows[0]?.heuristicHoursHundredths).toBe(300);
  });

  it('batches short meetings per direction', async () => {
    const adapter = new CalendarAdapter({
      config: {
        schema_version: 1,
        calendar: { internal_only_attendee_domains: ['sapienex.com'] },
      },
      fetchEvents: async () => [
        {
          id: 'ev1',
          title: 'Acme quick sync',
          startTime: '2026-04-15T10:00:00Z',
          durationMinutes: 15,
          attendeeDomains: ['acme.com', 'sapienex.com'],
        },
        {
          id: 'ev2',
          title: 'Acme catch-up',
          startTime: '2026-04-15T11:00:00Z',
          durationMinutes: 15,
          attendeeDomains: ['acme.com', 'sapienex.com'],
        },
        {
          id: 'ev3',
          title: 'Standup',
          startTime: '2026-04-15T09:00:00Z',
          durationMinutes: 15,
          attendeeDomains: ['sapienex.com'],
        },
      ],
      isConnected: () => true,
      connect: async () => {},
      disconnect: async () => {},
    });
    const rows = await adapter.fetchDailyDigest('2026-04-15');
    const clientBatch = rows.find((r) => r.direction === 'client' && r.count > 1);
    const internalBatch = rows.find((r) => r.direction === 'internal');
    expect(clientBatch?.count).toBe(2);
    expect(internalBatch?.count).toBe(1);
  });

  it('returns [] when not connected', async () => {
    const adapter = new CalendarAdapter({
      config: minimalConfig,
      fetchEvents: async () => [],
      isConnected: () => false,
      connect: async () => {},
      disconnect: async () => {},
    });
    expect(await adapter.fetchDailyDigest('2026-04-15')).toEqual([]);
  });
});
