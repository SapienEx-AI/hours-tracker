import { describe, it, expect, vi } from 'vitest';
import { fetchSlackActivityForDate } from '@/integrations/slack/client';

const fetchMock = vi.fn();

describe('fetchSlackActivityForDate', () => {
  it('aggregates thread_ts across channels and DMs', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, channels: [{ id: 'C1', name: 'client-acme' }] }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        messages: [
          { ts: '1.1', user: 'U1' },
          { ts: '1.2', user: 'U1', thread_ts: '1.1' },
          { ts: '1.3', user: 'U1' },
        ],
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, channels: [] }),
    });

    const result = await fetchSlackActivityForDate({
      token: 'xoxb-x',
      workspaceId: 'T012AB',
      userId: 'U1',
      date: '2026-04-15',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result.channelThreads.filter((t) => t.channelName === 'client-acme')).toHaveLength(2);
  });

  it('throws on invalid_auth', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false, error: 'invalid_auth' }),
    });
    await expect(
      fetchSlackActivityForDate({
        token: 'bad',
        workspaceId: 'T012AB',
        userId: 'U1',
        date: '2026-04-15',
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/invalid_auth/);
  });
});
