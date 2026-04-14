import { describe, it, expect } from 'vitest';
import { eventToFormState } from '@/integrations/calendar/event-to-entry';
import type { CalendarEvent } from '@/integrations/calendar/provider';

function mkEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt1',
    status: 'confirmed',
    summary: 'Sprosty standup',
    start: { dateTime: '2026-04-14T09:00:00-04:00' },
    end: { dateTime: '2026-04-14T09:30:00-04:00' },
    ...overrides,
  };
}

describe('eventToFormState', () => {
  it('returns prefill for a 30-min confirmed event', () => {
    const r = eventToFormState(mkEvent(), '2026-04-14');
    expect(r).toMatchObject({
      date: '2026-04-14',
      hours_hundredths: 50,
      description: 'Sprosty standup',
      source_event_id: 'evt1',
    });
    expect(r?.start_label).toMatch(/^\d{2}:\d{2}$/);
    expect(r?.end_label).toMatch(/^\d{2}:\d{2}$/);
  });

  it('rounds 52-min duration UP to 60 min (100 hundredths)', () => {
    const r = eventToFormState(
      mkEvent({
        start: { dateTime: '2026-04-14T09:00:00-04:00' },
        end: { dateTime: '2026-04-14T09:52:00-04:00' },
      }),
      '2026-04-14',
    );
    expect(r?.hours_hundredths).toBe(100);
  });

  it('rounds 7-min duration UP to the 15-min minimum (25 hundredths)', () => {
    const r = eventToFormState(
      mkEvent({
        start: { dateTime: '2026-04-14T09:00:00-04:00' },
        end: { dateTime: '2026-04-14T09:07:00-04:00' },
      }),
      '2026-04-14',
    );
    expect(r?.hours_hundredths).toBe(25);
  });

  it('filters declined events (user declined the invite) → null', () => {
    const r = eventToFormState(
      mkEvent({
        attendees: [{ self: true, responseStatus: 'declined' }],
      }),
      '2026-04-14',
    );
    expect(r).toBeNull();
  });

  it('filters all-day events (date-only, no dateTime) → null', () => {
    const r = eventToFormState(
      mkEvent({
        start: { date: '2026-04-14' },
        end: { date: '2026-04-15' },
      }),
      '2026-04-14',
    );
    expect(r).toBeNull();
  });

  it('filters zero-duration events (start === end) → null', () => {
    const r = eventToFormState(
      mkEvent({
        start: { dateTime: '2026-04-14T09:00:00-04:00' },
        end: { dateTime: '2026-04-14T09:00:00-04:00' },
      }),
      '2026-04-14',
    );
    expect(r).toBeNull();
  });

  it('missing summary becomes empty description', () => {
    const noSummary: CalendarEvent = {
      id: 'evt1',
      status: 'confirmed',
      start: { dateTime: '2026-04-14T09:00:00-04:00' },
      end: { dateTime: '2026-04-14T09:30:00-04:00' },
    };
    const r = eventToFormState(noSummary, '2026-04-14');
    expect(r?.description).toBe('');
  });

  it('clips an event spanning past the selected date midnight', () => {
    const r = eventToFormState(
      {
        id: 'cross',
        status: 'confirmed',
        summary: 'late work',
        start: { dateTime: '2026-04-14T23:00:00-04:00' },
        end: { dateTime: '2026-04-15T01:00:00-04:00' },
      },
      '2026-04-14',
    );
    expect(r?.hours_hundredths).toBe(100);
  });
});
