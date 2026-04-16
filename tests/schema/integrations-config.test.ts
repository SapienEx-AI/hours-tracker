import { describe, it, expect } from 'vitest';
import { validateIntegrationsConfig } from '@/schema/validators';

describe('validateIntegrationsConfig', () => {
  it('accepts the minimal empty-but-valid config', () => {
    const config = { schema_version: 1 };
    const result = validateIntegrationsConfig(config);
    expect(result.ok).toBe(true);
  });

  it('accepts a fully-populated config', () => {
    const config = {
      schema_version: 1,
      slack: {
        enabled: true,
        workspaces: [{ id: 'T012AB', name: 'Acme' }],
        client_channel_prefixes: ['#client-'],
        internal_channel_prefixes: ['#team-'],
        project_by_workspace: { T012AB: 'acme' },
        project_by_channel_prefix: { '#client-': 'acme' },
      },
      gmail: {
        enabled: true,
        client_domains: ['acme.com'],
        internal_domains: ['sapienex.com'],
        project_by_domain: { 'acme.com': 'acme' },
      },
      calendar: {
        workshop_min_duration_minutes: 120,
        client_training_title_keywords: ['workshop'],
        internal_only_attendee_domains: ['sapienex.com'],
      },
    };
    const result = validateIntegrationsConfig(config);
    expect(result.ok).toBe(true);
  });

  it('rejects unknown top-level keys', () => {
    const config = { schema_version: 1, outlook: {} };
    const result = validateIntegrationsConfig(config);
    expect(result.ok).toBe(false);
  });

  it('rejects missing schema_version', () => {
    const config = { slack: { enabled: true } };
    const result = validateIntegrationsConfig(config as unknown as { schema_version: 1 });
    expect(result.ok).toBe(false);
  });

  it('rejects a non-integer workshop_min_duration_minutes', () => {
    const config = {
      schema_version: 1,
      calendar: { workshop_min_duration_minutes: 120.5 },
    };
    const result = validateIntegrationsConfig(config);
    expect(result.ok).toBe(false);
  });
});
