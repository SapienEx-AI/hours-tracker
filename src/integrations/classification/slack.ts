import type { EffortKind, IntegrationsConfig } from '@/schema/types';

export type SlackChannelActivity = {
  readonly channelName: string;
  readonly threadTs: string;
  readonly workspaceId: string;
};

export type SlackDmActivity = {
  readonly participantEmails: readonly string[];
  readonly threadTs: string;
  readonly workspaceId: string;
};

export type ClassificationResult = {
  readonly direction: 'client' | 'internal' | 'ambiguous';
  readonly suggestedKind: EffortKind;
  readonly suggestedProjectId: string | null;
};

function firstMatchingPrefix(
  name: string,
  prefixes: readonly string[] | undefined,
): string | null {
  if (!prefixes) return null;
  return prefixes.find((p) => name.startsWith(p)) ?? null;
}

export function classifySlackChannelActivity(
  activity: SlackChannelActivity,
  config: IntegrationsConfig,
): ClassificationResult {
  const slack = config.slack ?? {};
  const clientPrefix = firstMatchingPrefix(activity.channelName, slack.client_channel_prefixes);
  const internalPrefix = firstMatchingPrefix(
    activity.channelName,
    slack.internal_channel_prefixes,
  );
  const projectByPrefix = clientPrefix ? slack.project_by_channel_prefix?.[clientPrefix] : undefined;
  const projectByWorkspace = slack.project_by_workspace?.[activity.workspaceId] ?? null;
  const suggestedProjectId = projectByPrefix ?? projectByWorkspace ?? null;

  if (clientPrefix) {
    return { direction: 'client', suggestedKind: 'slack', suggestedProjectId };
  }
  if (internalPrefix) {
    return { direction: 'internal', suggestedKind: 'internal_sync', suggestedProjectId: null };
  }
  return { direction: 'ambiguous', suggestedKind: 'slack', suggestedProjectId: null };
}

function domainOf(email: string): string {
  const at = email.lastIndexOf('@');
  return at < 0 ? '' : email.slice(at + 1).toLowerCase();
}

export function classifySlackDmActivity(
  activity: SlackDmActivity,
  config: IntegrationsConfig,
): ClassificationResult {
  const clientDomains = new Set(config.gmail?.client_domains ?? []);
  const internalDomains = new Set(config.gmail?.internal_domains ?? []);
  const domains = activity.participantEmails.map(domainOf);
  const projectByWorkspace = config.slack?.project_by_workspace?.[activity.workspaceId] ?? null;

  if (domains.some((d) => clientDomains.has(d))) {
    return { direction: 'client', suggestedKind: 'slack', suggestedProjectId: projectByWorkspace };
  }
  if (domains.length > 0 && domains.every((d) => internalDomains.has(d))) {
    return { direction: 'internal', suggestedKind: 'internal_sync', suggestedProjectId: null };
  }
  return { direction: 'ambiguous', suggestedKind: 'slack', suggestedProjectId: null };
}
