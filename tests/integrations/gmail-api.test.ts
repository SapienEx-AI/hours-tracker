import { describe, it, expect, vi } from 'vitest';
import { fetchSentThreadsForDate } from '@/integrations/google/gmail-api';

const fetchMock = vi.fn();

describe('fetchSentThreadsForDate', () => {
  it('constructs in:sent after:/before: query for the target date', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [] }) });
    await fetchSentThreadsForDate({
      token: 't',
      date: '2026-04-15',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toMatch(/in%3Asent/);
    expect(url).toMatch(/after%3A2026%2F04%2F15/);
  });

  it('groups messages by thread', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messages: [
          { id: 'm1', threadId: 't1' },
          { id: 'm2', threadId: 't1' },
          { id: 'm3', threadId: 't2' },
        ],
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        threadId: 't1',
        messages: [{ payload: { headers: [{ name: 'To', value: 'a@acme.com' }] } }],
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        threadId: 't2',
        messages: [{ payload: { headers: [{ name: 'To', value: 'b@sapienex.com' }] } }],
      }),
    });
    const threads = await fetchSentThreadsForDate({
      token: 't',
      date: '2026-04-15',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(threads).toHaveLength(2);
    expect(threads[0]?.threadId).toBe('t1');
    expect(threads[0]?.recipientEmails).toContain('a@acme.com');
  });

  it('throws on 401 response', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' });
    await expect(
      fetchSentThreadsForDate({
        token: 'bad',
        date: '2026-04-15',
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/401/);
  });
});
