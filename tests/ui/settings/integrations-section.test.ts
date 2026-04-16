import { describe, it, expect } from 'vitest';
import { parseAndValidateConfigJson } from '@/ui/screens/settings/IntegrationsSection';

describe('parseAndValidateConfigJson', () => {
  it('returns ok on valid JSON + valid schema', () => {
    const r = parseAndValidateConfigJson(JSON.stringify({ schema_version: 1 }));
    expect(r.ok).toBe(true);
  });

  it('returns error on malformed JSON', () => {
    const r = parseAndValidateConfigJson('{not-json');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/JSON/);
  });

  it('returns error on schema-invalid JSON', () => {
    const r = parseAndValidateConfigJson(JSON.stringify({ schema_version: 2 }));
    expect(r.ok).toBe(false);
  });
});
