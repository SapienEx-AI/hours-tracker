import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listCalendars, listEvents } from '@/integrations/google/calendar-api';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('listCalendars', () => {
  it('returns parsed calendar entries', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { id: 'primary', summary: 'prash@sapienex.com', primary: true },
          { id: 'team@sapienex.com', summary: 'Team shared' },
          { id: 'holidays', summary: 'Holidays in Canada' },
        ],
      }),
    });
    const result = await listCalendars('tok');
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ id: 'primary', summary: 'prash@sapienex.com', primary: true });
  });

  it('throws on non-OK response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'backend lit' } }),
    });
    await expect(listCalendars('tok')).rejects.toThrow(/500/);
  });
});

describe('listEvents', () => {
  it('returns parsed events for a date range', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: 'evt1',
            summary: 'Sprosty standup',
            start: { dateTime: '2026-04-14T09:00:00-04:00' },
            end: { dateTime: '2026-04-14T09:30:00-04:00' },
            status: 'confirmed',
          },
        ],
      }),
    });
    const result = await listEvents('tok', {
      calendarId: 'primary',
      timeMin: '2026-04-14T00:00:00-04:00',
      timeMax: '2026-04-14T23:59:59-04:00',
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('evt1');
    expect(result[0]?.summary).toBe('Sprosty standup');
  });

  it('URL-encodes the calendar id', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    });
    await listEvents('tok', {
      calendarId: 'team@sapienex.com',
      timeMin: '2026-04-14T00:00:00Z',
      timeMax: '2026-04-14T23:59:59Z',
    });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('team%40sapienex.com');
  });

  it('throws on 401 so the caller can retry', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'unauth' } }),
    });
    await expect(
      listEvents('tok', {
        calendarId: 'primary',
        timeMin: '2026-04-14T00:00:00Z',
        timeMax: '2026-04-14T23:59:59Z',
      }),
    ).rejects.toThrow(/401/);
  });
});
