import { describe, it, expect } from 'vitest';
import { SlackAdapter } from '@/integrations/adapters/slack-adapter';
import type { IntegrationsConfig } from '@/schema/types';

const config: IntegrationsConfig = {
  schema_version: 1,
  slack: {
    enabled: true,
    client_channel_prefixes: ['#client-', '#acme-'],
    internal_channel_prefixes: ['#team-'],
    project_by_channel_prefix: { '#acme-': 'acme' },
    project_by_workspace: { T012AB: 'acme' },
  },
  gmail: { client_domains: ['acme.com'], internal_domains: ['sapienex.com'] },
};

describe('SlackAdapter', () => {
  it('groups channel threads by direction + project', async () => {
    const adapter = new SlackAdapter({
      config,
      workspaceId: 'T012AB',
      fetchActivity: async () => ({
        channelThreads: [
          { channelName: 'acme-dev', threadTs: 'ts1' },
          { channelName: 'acme-design', threadTs: 'ts2' },
          { channelName: 'team-ops', threadTs: 'ts3' },
        ],
        dmThreads: [],
      }),
      isConnected: () => true,
      connect: async () => {},
      disconnect: async () => {},
    });
    const rows = await adapter.fetchDailyDigest('2026-04-15');
    const client = rows.find((r) => r.direction === 'client');
    const internal = rows.find((r) => r.direction === 'internal');
    expect(client?.count).toBe(2);
    expect(client?.suggestedProjectId).toBe('acme');
    expect(internal?.count).toBe(1);
  });

  it('groups DM threads by direction', async () => {
    const adapter = new SlackAdapter({
      config,
      workspaceId: 'T012AB',
      fetchActivity: async () => ({
        channelThreads: [],
        dmThreads: [
          { participantEmails: ['alice@acme.com'], threadTs: 'dm1' },
          { participantEmails: ['bob@sapienex.com'], threadTs: 'dm2' },
        ],
      }),
      isConnected: () => true,
      connect: async () => {},
      disconnect: async () => {},
    });
    const rows = await adapter.fetchDailyDigest('2026-04-15');
    expect(rows.find((r) => r.direction === 'client')?.count).toBe(1);
    expect(rows.find((r) => r.direction === 'internal')?.count).toBe(1);
  });

  it('returns [] when disabled', async () => {
    const adapter = new SlackAdapter({
      config: { schema_version: 1, slack: { enabled: false } },
      workspaceId: 'T012AB',
      fetchActivity: async () => ({ channelThreads: [], dmThreads: [] }),
      isConnected: () => true,
      connect: async () => {},
      disconnect: async () => {},
    });
    expect(await adapter.fetchDailyDigest('2026-04-15')).toEqual([]);
  });
});
