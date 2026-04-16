import { describe, it, expect } from 'vitest';
import type { IntegrationsConfig } from '@/schema/types';
import { classifyGmailThread, type GmailThread } from '@/integrations/classification/gmail';

const config: IntegrationsConfig = {
  schema_version: 1,
  gmail: {
    client_domains: ['acme.com', 'bigco.com'],
    internal_domains: ['sapienex.com'],
    project_by_domain: { 'acme.com': 'acme', 'bigco.com': 'bigco' },
  },
};

describe('classifyGmailThread', () => {
  it('tags thread with client recipient as client + project via domain', () => {
    const thread: GmailThread = {
      threadId: 't1',
      recipientEmails: ['alice@acme.com', 'ops@sapienex.com'],
    };
    const result = classifyGmailThread(thread, config);
    expect(result.direction).toBe('client');
    expect(result.suggestedKind).toBe('email');
    expect(result.suggestedProjectId).toBe('acme');
  });

  it('tags all-internal thread as internal', () => {
    const thread: GmailThread = {
      threadId: 't2',
      recipientEmails: ['bob@sapienex.com', 'ops@sapienex.com'],
    };
    const result = classifyGmailThread(thread, config);
    expect(result.direction).toBe('internal');
    expect(result.suggestedKind).toBe('internal_sync');
  });

  it('falls to ambiguous on unknown domains', () => {
    const thread: GmailThread = {
      threadId: 't3',
      recipientEmails: ['stranger@unknown.com'],
    };
    const result = classifyGmailThread(thread, config);
    expect(result.direction).toBe('ambiguous');
    expect(result.suggestedKind).toBe('email');
  });

  it('first client-domain match wins for project id', () => {
    const thread: GmailThread = {
      threadId: 't4',
      recipientEmails: ['user@bigco.com', 'user@acme.com'],
    };
    const result = classifyGmailThread(thread, config);
    expect(result.suggestedProjectId).toBe('bigco');
  });
});
