import { describe, it, expect } from 'vitest';
import { GmailAdapter } from '@/integrations/adapters/gmail-adapter';
import type { IntegrationsConfig } from '@/schema/types';

const config: IntegrationsConfig = {
  schema_version: 1,
  gmail: {
    enabled: true,
    client_domains: ['acme.com'],
    internal_domains: ['sapienex.com'],
    project_by_domain: { 'acme.com': 'acme' },
  },
};

describe('GmailAdapter', () => {
  it('groups threads by direction into digest rows', async () => {
    const adapter = new GmailAdapter({
      config,
      fetchThreads: async () => [
        { threadId: 't1', recipientEmails: ['alice@acme.com'] },
        { threadId: 't2', recipientEmails: ['bob@acme.com'] },
        { threadId: 't3', recipientEmails: ['peer@sapienex.com'] },
      ],
      isConnected: () => true,
      connect: async () => {},
      disconnect: async () => {},
    });
    const rows = await adapter.fetchDailyDigest('2026-04-15');
    const client = rows.find((r) => r.direction === 'client');
    const internal = rows.find((r) => r.direction === 'internal');
    expect(client?.count).toBe(2);
    expect(client?.suggestedKind).toBe('email');
    expect(client?.suggestedProjectId).toBe('acme');
    expect(internal?.count).toBe(1);
  });

  it('returns [] when disabled in config', async () => {
    const adapter = new GmailAdapter({
      config: { schema_version: 1, gmail: { enabled: false } },
      fetchThreads: async () => [{ threadId: 't1', recipientEmails: ['alice@acme.com'] }],
      isConnected: () => true,
      connect: async () => {},
      disconnect: async () => {},
    });
    expect(await adapter.fetchDailyDigest('2026-04-15')).toEqual([]);
  });

  it('batch id follows daily:YYYY-MM-DD:direction:projectId shape', async () => {
    const adapter = new GmailAdapter({
      config,
      fetchThreads: async () => [{ threadId: 't1', recipientEmails: ['alice@acme.com'] }],
      isConnected: () => true,
      connect: async () => {},
      disconnect: async () => {},
    });
    const rows = await adapter.fetchDailyDigest('2026-04-15');
    expect(rows[0]?.batchId).toBe('daily:2026-04-15:client:acme');
  });
});
