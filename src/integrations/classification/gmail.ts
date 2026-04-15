import type { IntegrationsConfig } from '@/schema/types';
import type { ClassificationResult } from './slack';

export type GmailThread = {
  readonly threadId: string;
  readonly recipientEmails: readonly string[];
};

function domainOf(email: string): string {
  const at = email.lastIndexOf('@');
  return at < 0 ? '' : email.slice(at + 1).toLowerCase();
}

export function classifyGmailThread(
  thread: GmailThread,
  config: IntegrationsConfig,
): ClassificationResult {
  const clientDomains = new Set(config.gmail?.client_domains ?? []);
  const internalDomains = new Set(config.gmail?.internal_domains ?? []);
  const projectByDomain = config.gmail?.project_by_domain ?? {};
  const domains = thread.recipientEmails.map(domainOf);

  const firstClientDomain = domains.find((d) => clientDomains.has(d));
  if (firstClientDomain) {
    return {
      direction: 'client',
      suggestedKind: 'email',
      suggestedProjectId: projectByDomain[firstClientDomain] ?? null,
    };
  }
  if (domains.length > 0 && domains.every((d) => internalDomains.has(d))) {
    return { direction: 'internal', suggestedKind: 'internal_sync', suggestedProjectId: null };
  }
  return { direction: 'ambiguous', suggestedKind: 'email', suggestedProjectId: null };
}
