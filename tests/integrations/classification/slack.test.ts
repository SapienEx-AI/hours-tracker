import { describe, it, expect } from 'vitest';
import type { IntegrationsConfig } from '@/schema/types';
import {
  classifySlackChannelActivity,
  classifySlackDmActivity,
  type SlackChannelActivity,
  type SlackDmActivity,
} from '@/integrations/classification/slack';

const config: IntegrationsConfig = {
  schema_version: 1,
  slack: {
    client_channel_prefixes: ['#client-', '#acme-'],
    internal_channel_prefixes: ['#team-', '#internal-'],
    project_by_channel_prefix: { '#acme-': 'acme' },
    project_by_workspace: { T012AB: 'acme' },
  },
  gmail: { client_domains: ['acme.com'], internal_domains: ['sapienex.com'] },
};

describe('classifySlackChannelActivity', () => {
  it('tags #acme-general as client with project acme', () => {
    const activity: SlackChannelActivity = {
      channelName: '#acme-general',
      threadTs: 'ts1',
      workspaceId: 'T012AB',
    };
    const result = classifySlackChannelActivity(activity, config);
    expect(result.direction).toBe('client');
    expect(result.suggestedKind).toBe('slack');
    expect(result.suggestedProjectId).toBe('acme');
  });

  it('tags #team-ops as internal with no project', () => {
    const activity: SlackChannelActivity = {
      channelName: '#team-ops',
      threadTs: 'ts2',
      workspaceId: 'T012AB',
    };
    const result = classifySlackChannelActivity(activity, config);
    expect(result.direction).toBe('internal');
    expect(result.suggestedKind).toBe('internal_sync');
  });

  it('falls to ambiguous when no prefix matches', () => {
    const activity: SlackChannelActivity = {
      channelName: '#random',
      threadTs: 'ts3',
      workspaceId: 'T012AB',
    };
    const result = classifySlackChannelActivity(activity, config);
    expect(result.direction).toBe('ambiguous');
  });
});

describe('classifySlackDmActivity', () => {
  it('tags DM with client participant as client', () => {
    const activity: SlackDmActivity = {
      participantEmails: ['alice@acme.com', 'me@sapienex.com'],
      threadTs: 'ts4',
      workspaceId: 'T012AB',
    };
    const result = classifySlackDmActivity(activity, config);
    expect(result.direction).toBe('client');
    expect(result.suggestedKind).toBe('slack');
  });

  it('tags all-internal DM as internal', () => {
    const activity: SlackDmActivity = {
      participantEmails: ['bob@sapienex.com', 'me@sapienex.com'],
      threadTs: 'ts5',
      workspaceId: 'T012AB',
    };
    const result = classifySlackDmActivity(activity, config);
    expect(result.direction).toBe('internal');
  });

  it('falls to ambiguous when no participant matches any domain list', () => {
    const activity: SlackDmActivity = {
      participantEmails: ['stranger@unknown.com'],
      threadTs: 'ts6',
      workspaceId: 'T012AB',
    };
    const result = classifySlackDmActivity(activity, config);
    expect(result.direction).toBe('ambiguous');
  });
});
