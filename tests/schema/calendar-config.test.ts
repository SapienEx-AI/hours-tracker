import { describe, it, expect } from 'vitest';
import { validateCalendarConfig } from '@/schema/validators';

describe('validateCalendarConfig', () => {
  it('accepts a minimal valid config', () => {
    const r = validateCalendarConfig({
      schema_version: 1,
      provider: 'google',
      enabled_calendars: ['primary'],
    });
    expect(r.ok).toBe(true);
  });

  it('accepts a config with last_connected_at', () => {
    const r = validateCalendarConfig({
      schema_version: 1,
      provider: 'google',
      enabled_calendars: ['primary', 'team@sapienex.com'],
      last_connected_at: '2026-04-14T10:00:00Z',
    });
    expect(r.ok).toBe(true);
  });

  it('rejects unknown provider', () => {
    const r = validateCalendarConfig({
      schema_version: 1,
      provider: 'outlook',
      enabled_calendars: ['primary'],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects duplicate calendar ids', () => {
    const r = validateCalendarConfig({
      schema_version: 1,
      provider: 'google',
      enabled_calendars: ['primary', 'primary'],
    });
    expect(r.ok).toBe(false);
  });
});
