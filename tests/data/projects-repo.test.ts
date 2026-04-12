import { describe, it, expect, vi } from 'vitest';
import { loadProjects, writeProjects } from '@/data/projects-repo';
import type { ProjectsConfig } from '@/schema/types';

function mockOctokit() {
  return {
    rest: {
      repos: {
        getContent: vi.fn(),
        createOrUpdateFileContents: vi.fn(),
      },
    },
  };
}

describe('projects-repo', () => {
  it('loadProjects returns an empty projects list when the file does not exist', async () => {
    const mock = mockOctokit();
    mock.rest.repos.getContent.mockRejectedValue({ status: 404 });
    const result = await loadProjects(mock as never, { owner: 't', repo: 'r' });
    expect(result.data.projects).toHaveLength(0);
  });

  it('writeProjects refuses to write an invalid projects config', async () => {
    const mock = mockOctokit();
    const bad = {
      schema_version: 1,
      projects: [
        {
          id: 'Has Spaces',
          name: 'x',
          client: null,
          active: true,
          is_internal: false,
          default_rate_cents: null,
          buckets: [],
        },
      ],
    };
    await expect(
      writeProjects(mock as never, {
        owner: 't',
        repo: 'r',
        message: 'test',
        data: bad as unknown as ProjectsConfig,
      }),
    ).rejects.toThrow();
  });
});
