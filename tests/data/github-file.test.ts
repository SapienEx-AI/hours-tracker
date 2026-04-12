import { describe, it, expect, vi } from 'vitest';
import {
  readJsonFile,
  writeJsonFile,
  FileNotFoundError,
  ConflictError,
} from '@/data/github-file';

type MockOctokit = {
  rest: {
    repos: {
      getContent: ReturnType<typeof vi.fn>;
      createOrUpdateFileContents: ReturnType<typeof vi.fn>;
    };
  };
};

function makeMock(): MockOctokit {
  return {
    rest: {
      repos: {
        getContent: vi.fn(),
        createOrUpdateFileContents: vi.fn(),
      },
    },
  };
}

describe('readJsonFile', () => {
  it('reads and parses a JSON file from a github repo', async () => {
    const mock = makeMock();
    mock.rest.repos.getContent.mockResolvedValue({
      data: {
        type: 'file',
        content: btoa(JSON.stringify({ hello: 'world' })),
        sha: 'abc123',
        encoding: 'base64',
      },
    });
    const result = await readJsonFile(mock as never, {
      owner: 'test',
      repo: 'repo',
      path: 'config/test.json',
    });
    expect(result.data).toEqual({ hello: 'world' });
    expect(result.sha).toBe('abc123');
  });

  it('throws FileNotFoundError on 404', async () => {
    const mock = makeMock();
    mock.rest.repos.getContent.mockRejectedValue({ status: 404 });
    await expect(
      readJsonFile(mock as never, { owner: 'test', repo: 'repo', path: 'config/test.json' }),
    ).rejects.toBeInstanceOf(FileNotFoundError);
  });
});

describe('writeJsonFile', () => {
  it('creates a new file when sha is not provided', async () => {
    const mock = makeMock();
    mock.rest.repos.createOrUpdateFileContents.mockResolvedValue({
      data: { content: { sha: 'new-sha' } },
    });
    const result = await writeJsonFile(mock as never, {
      owner: 'test',
      repo: 'repo',
      path: 'config/test.json',
      content: { hello: 'world' },
      message: 'test commit',
    });
    expect(result.sha).toBe('new-sha');
    expect(mock.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'test commit' }),
    );
  });

  it('updates an existing file when sha is provided', async () => {
    const mock = makeMock();
    mock.rest.repos.createOrUpdateFileContents.mockResolvedValue({
      data: { content: { sha: 'updated-sha' } },
    });
    await writeJsonFile(mock as never, {
      owner: 'test',
      repo: 'repo',
      path: 'config/test.json',
      content: { hello: 'world' },
      message: 'test commit',
      sha: 'old-sha',
    });
    expect(mock.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({ sha: 'old-sha' }),
    );
  });

  it('throws ConflictError on a 409 response', async () => {
    const mock = makeMock();
    mock.rest.repos.createOrUpdateFileContents.mockRejectedValue({ status: 409 });
    await expect(
      writeJsonFile(mock as never, {
        owner: 'test',
        repo: 'repo',
        path: 'config/test.json',
        content: { hello: 'world' },
        message: 'test',
        sha: 'old-sha',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
