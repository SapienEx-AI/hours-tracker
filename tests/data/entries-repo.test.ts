import { describe, it, expect, vi } from 'vitest';
import { loadMonthEntries, addEntry } from '@/data/entries-repo';
import type { Entry } from '@/schema/types';

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

const sampleEntry: Omit<Entry, 'id' | 'created_at' | 'updated_at'> = {
  project: 'sprosty',
  date: '2026-04-11',
  hours_hundredths: 400,
  rate_cents: 12500,
  rate_source: 'global_default',
  billable_status: 'billable',
  bucket_id: null,
  description: 'test entry',
  review_flag: false,
};

describe('loadMonthEntries', () => {
  it('returns an empty file when the month does not exist yet', async () => {
    const mock = mockOctokit();
    mock.rest.repos.getContent.mockRejectedValue({ status: 404 });
    const result = await loadMonthEntries(mock as never, {
      owner: 'test',
      repo: 'data',
      month: '2026-04',
    });
    expect(result.data).toEqual({ schema_version: 1, month: '2026-04', entries: [] });
    expect(result.sha).toBeNull();
  });

  it('validates the loaded file against the schema and throws on malformed content', async () => {
    const mock = mockOctokit();
    mock.rest.repos.getContent.mockResolvedValue({
      data: {
        type: 'file',
        content: btoa(JSON.stringify({ not: 'valid' })),
        sha: 'abc',
        encoding: 'base64',
      },
    });
    await expect(
      loadMonthEntries(mock as never, { owner: 'test', repo: 'data', month: '2026-04' }),
    ).rejects.toThrow(/validation/i);
  });
});

describe('addEntry', () => {
  it('validates the entry against the schema before writing', async () => {
    const mock = mockOctokit();
    mock.rest.repos.getContent.mockRejectedValue({ status: 404 });
    mock.rest.repos.createOrUpdateFileContents.mockResolvedValue({
      data: { content: { sha: 'new' } },
    });
    // Invalid: hours_hundredths = 0 violates schema minimum
    await expect(
      addEntry(mock as never, {
        owner: 'test',
        repo: 'data',
        entry: {
          ...sampleEntry,
          id: '2026-04-11-sprosty-aaaaaa',
          created_at: '2026-04-11T00:00:00Z',
          updated_at: '2026-04-11T00:00:00Z',
          hours_hundredths: 0,
        } as Entry,
      }),
    ).rejects.toThrow(/validation/i);
  });
});
