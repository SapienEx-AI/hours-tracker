import { describe, it, expect } from 'vitest';
import { newEntryId } from '@/data/new-entry-id';

describe('newEntryId', () => {
  it('produces an id in the format YYYY-MM-DD-<slug>-<6-hex>', () => {
    const id = newEntryId({ date: '2026-04-11', projectSlug: 'sprosty' });
    expect(id).toMatch(/^2026-04-11-sprosty-[a-f0-9]{6}$/);
  });

  it('produces a different id on successive calls', () => {
    const a = newEntryId({ date: '2026-04-11', projectSlug: 'sprosty' });
    const b = newEntryId({ date: '2026-04-11', projectSlug: 'sprosty' });
    expect(a).not.toBe(b);
  });
});
