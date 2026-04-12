import { describe, it, expect } from 'vitest';
import { encodeContent, decodeContent, splitRepoPath } from '@/data/octokit-client';

describe('octokit-client helpers', () => {
  it('encodeContent round-trips a simple JSON string through base64', () => {
    const original = '{"hello":"world"}';
    const encoded = encodeContent(original);
    expect(decodeContent(encoded)).toBe(original);
  });

  it('encodeContent handles unicode (hours symbols, accented names)', () => {
    const original = '{"description":"MS Fabric · 4.5h"}';
    const encoded = encodeContent(original);
    expect(decodeContent(encoded)).toBe(original);
  });

  it('splitRepoPath parses "owner/repo" into parts', () => {
    expect(splitRepoPath('sapienEx-AI/hours-data-sector-growth-prash')).toEqual({
      owner: 'sapienEx-AI',
      repo: 'hours-data-sector-growth-prash',
    });
  });

  it('splitRepoPath throws on malformed input', () => {
    expect(() => splitRepoPath('no-slash')).toThrow();
    expect(() => splitRepoPath('too/many/slashes')).toThrow();
  });
});
