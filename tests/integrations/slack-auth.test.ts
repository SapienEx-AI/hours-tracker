import { describe, it, expect, vi } from 'vitest';
import { validateSlackBotToken } from '@/integrations/slack/auth';

describe('validateSlackBotToken', () => {
  it('accepts a valid bot token via auth.test', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, team_id: 'T012AB', user_id: 'U1', team: 'Acme' }),
    });
    const result = await validateSlackBotToken({
      token: 'xoxb-valid',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result.workspaceId).toBe('T012AB');
    expect(result.botUserId).toBe('U1');
  });

  it('throws on invalid token', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false, error: 'invalid_auth' }),
    });
    await expect(
      validateSlackBotToken({ token: 'xoxb-bad', fetchImpl: fetchMock as unknown as typeof fetch }),
    ).rejects.toThrow(/invalid_auth/);
  });

  it('rejects non-xoxb tokens without even calling Slack', async () => {
    const fetchMock = vi.fn();
    await expect(
      validateSlackBotToken({ token: 'xoxp-user', fetchImpl: fetchMock as unknown as typeof fetch }),
    ).rejects.toThrow(/xoxb/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
