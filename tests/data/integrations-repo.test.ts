import { describe, it, expect, vi } from 'vitest';
import type { Octokit } from '@octokit/rest';
import { loadIntegrationsConfig } from '@/data/integrations-repo';

function mockOctokit(fileContent: string | null): Octokit {
  return {
    rest: {
      repos: {
        getContent: vi.fn(async () => {
          if (fileContent === null) {
            const err = new Error('Not Found') as Error & { status: number };
            err.status = 404;
            throw err;
          }
          return {
            data: {
              type: 'file',
              content: Buffer.from(fileContent).toString('base64'),
              sha: 'abc',
              encoding: 'base64',
            },
          };
        }),
      },
    },
  } as unknown as Octokit;
}

describe('integrations-repo', () => {
  it('returns null when the config file does not exist', async () => {
    const result = await loadIntegrationsConfig(mockOctokit(null), {
      owner: 'o',
      repo: 'r',
    });
    expect(result).toBeNull();
  });

  it('loads and validates a well-formed config', async () => {
    const content = JSON.stringify({ schema_version: 1, slack: { enabled: true } });
    const result = await loadIntegrationsConfig(mockOctokit(content), {
      owner: 'o',
      repo: 'r',
    });
    expect(result?.schema_version).toBe(1);
    expect(result?.slack?.enabled).toBe(true);
  });

  it('throws on malformed JSON', async () => {
    await expect(
      loadIntegrationsConfig(mockOctokit('{not-json'), { owner: 'o', repo: 'r' }),
    ).rejects.toThrow();
  });

  it('throws on schema-invalid config', async () => {
    const content = JSON.stringify({ schema_version: 2 });
    await expect(
      loadIntegrationsConfig(mockOctokit(content), { owner: 'o', repo: 'r' }),
    ).rejects.toThrow(/schema_version/);
  });
});
