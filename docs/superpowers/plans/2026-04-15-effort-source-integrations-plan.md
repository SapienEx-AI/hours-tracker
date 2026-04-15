# Effort Source Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `EffortSourceAdapter` interface plus three concrete adapters (Calendar-refactor, Gmail, Slack) with a daily digest UX that replaces per-activity suggestions.

**Architecture:** Schema v5 (additive enum widening of `source_ref.kind`). New `src/integrations/adapters/` namespace with a shared interface. Per-consultant `config/integrations.json` governs classification rules. Digest panel on Log screen groups rows by direction (client/internal/ambiguous); per-row Accept calls `addEntry`.

**Tech Stack:** TypeScript (strict + exactOptionalPropertyTypes), React, React Query, Zustand, ajv, vitest, fast-check. No new heavy deps — Slack Web API via native fetch, Gmail API via native fetch.

**Spec:** `docs/superpowers/specs/2026-04-15-effort-source-integrations-design.md`

---

## Ground rules (apply to every task)

- TDD: write the failing test first, verify it fails, implement, verify it passes.
- Commit after each task passes `npm test`. Never commit a red tree.
- No floating-point math on hours fields — all hours arithmetic goes through `src/calc/int.ts` (existing invariant 1).
- All entry writes go through `validateEntries` before hitting GitHub (existing invariant 2).
- `npm run typecheck && npm run lint && npm test` must be green before every commit.
- March 2026 golden fixture must remain byte-identical throughout the plan. Check after every calc-touching change with `npm run test:golden`.

---

## Task 1: Schema v5 bump + validator + writer upgrade path

**Files:**
- Modify: `schemas/entries.schema.json`
- Modify: `src/schema/types.ts`
- Modify: `src/schema/validators.ts`
- Modify: `src/data/entries-repo.ts`
- Create: `tests/schema/entry-v5-migration.test.ts`
- Create: `tests/data/entries-repo-v5.test.ts`
- Create: `tests/calc/hash-v5.test.ts`

- [ ] **Step 1: Write failing test for v5 acceptance in validator**

Create `tests/schema/entry-v5-migration.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateEntries } from '@/schema/validators';
import type { EntriesFile } from '@/schema/types';

describe('Entry v5 schema migration', () => {
  it('accepts a v5 file with source_ref.kind slack', () => {
    const file = {
      schema_version: 5,
      month: '2026-04',
      entries: [
        {
          id: '2026-04-15-acme-abc123',
          project: 'acme',
          date: '2026-04-15',
          hours_hundredths: 40,
          rate_cents: 10000,
          rate_source: 'project_default',
          billable_status: 'billable',
          bucket_id: null,
          description: 'Slack batch',
          review_flag: false,
          created_at: '2026-04-15T12:00:00Z',
          updated_at: '2026-04-15T12:00:00Z',
          source_ref: { kind: 'slack', id: 'daily:2026-04-15:client:T012AB:acme' },
          effort_kind: 'slack',
          effort_count: 12,
        },
      ],
    };
    const result = validateEntries(file);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.schema_version).toBe(5);
  });

  it('accepts a v5 file with source_ref.kind gmail', () => {
    const file: EntriesFile = {
      schema_version: 5,
      month: '2026-04',
      entries: [
        {
          id: '2026-04-15-acme-def456',
          project: 'acme',
          date: '2026-04-15',
          hours_hundredths: 15,
          rate_cents: 10000,
          rate_source: 'project_default',
          billable_status: 'billable',
          bucket_id: null,
          description: 'Email batch',
          review_flag: false,
          created_at: '2026-04-15T12:00:00Z',
          updated_at: '2026-04-15T12:00:00Z',
          source_ref: { kind: 'gmail', id: 'daily:2026-04-15:client:acme' },
          effort_kind: 'email',
          effort_count: 3,
        },
      ],
    };
    const result = validateEntries(file);
    expect(result.ok).toBe(true);
  });

  it('rejects schema_version 6 (not widened)', () => {
    const file = {
      schema_version: 6,
      month: '2026-04',
      entries: [],
    };
    const result = validateEntries(file as unknown as EntriesFile);
    expect(result.ok).toBe(false);
  });

  it('rejects unknown source_ref.kind', () => {
    const file = {
      schema_version: 5,
      month: '2026-04',
      entries: [
        {
          id: '2026-04-15-acme-xyz789',
          project: 'acme',
          date: '2026-04-15',
          hours_hundredths: 10,
          rate_cents: 10000,
          rate_source: 'project_default',
          billable_status: 'billable',
          bucket_id: null,
          description: 'foo',
          review_flag: false,
          created_at: '2026-04-15T12:00:00Z',
          updated_at: '2026-04-15T12:00:00Z',
          source_ref: { kind: 'outlook', id: 'anything' },
          effort_kind: null,
          effort_count: null,
        },
      ],
    };
    const result = validateEntries(file as unknown as EntriesFile);
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/schema/entry-v5-migration.test.ts`
Expected: all four tests FAIL — validator rejects v5 and rejects new kinds.

- [ ] **Step 3: Bump `schemas/entries.schema.json`**

Change two lines:

```diff
-  "title": "Monthly entries file (v4)",
+  "title": "Monthly entries file (v5)",
...
-    "schema_version": { "enum": [1, 2, 3, 4] },
+    "schema_version": { "enum": [1, 2, 3, 4, 5] },
```

And in the `source_ref` oneOf block, widen the kind enum:

```diff
-                  "kind": { "enum": ["calendar", "timer"] },
+                  "kind": { "enum": ["calendar", "timer", "slack", "gmail"] },
```

- [ ] **Step 4: Update `src/schema/types.ts`**

Update `SourceRef` union + `EntriesFile.schema_version` union:

```diff
-export type SourceRef =
-  | null
-  | { readonly kind: 'calendar'; readonly id: string }
-  | { readonly kind: 'timer'; readonly id: string };
+export type SourceRef =
+  | null
+  | { readonly kind: 'calendar'; readonly id: string }
+  | { readonly kind: 'timer'; readonly id: string }
+  | { readonly kind: 'slack'; readonly id: string }
+  | { readonly kind: 'gmail'; readonly id: string };
```

```diff
-  schema_version: 1 | 2 | 3 | 4;
+  schema_version: 1 | 2 | 3 | 4 | 5;
```

- [ ] **Step 5: Update `src/schema/validators.ts` JSDoc**

Replace the JSDoc block above `validateEntries`:

```diff
-/**
- * Validate an entries file. Accepts v1 / v2 / v3 / v4 on the wire; the
- * returned value always has v4 shape (every entry carries `source_ref` and
- * `effort_kind` / `effort_count` fields, backfilled to null when absent).
- *
- * NOTE: returns a *deep clone* of the input with the v4 shape applied.
- * The caller's original object is never mutated, so a diagnostic logger
- * holding the parsed JSON sees exactly what came off disk.
- */
+/**
+ * Validate an entries file. Accepts v1 / v2 / v3 / v4 / v5 on the wire; the
+ * returned value always has v5 shape. New in v5: source_ref.kind may be
+ * 'slack' or 'gmail' in addition to 'calendar' and 'timer'.
+ *
+ * NOTE: returns a *deep clone* of the input with the v5 shape applied.
+ * The caller's original object is never mutated.
+ */
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/schema/entry-v5-migration.test.ts`
Expected: all 4 tests PASS.

- [ ] **Step 7: Write failing test for writer upgrade path**

Create `tests/data/entries-repo-v5.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { upgradeEntriesFileToV5 } from '@/data/entries-repo';
import type { EntriesFile } from '@/schema/types';

describe('upgradeEntriesFileToV5', () => {
  it('promotes a v4 file to v5 with identity entries', () => {
    const v4: EntriesFile = {
      schema_version: 4,
      month: '2026-04',
      entries: [
        {
          id: '2026-04-01-acme-aaa111',
          project: 'acme',
          date: '2026-04-01',
          hours_hundredths: 100,
          rate_cents: 10000,
          rate_source: 'project_default',
          billable_status: 'billable',
          bucket_id: null,
          description: 'x',
          review_flag: false,
          created_at: '2026-04-01T12:00:00Z',
          updated_at: '2026-04-01T12:00:00Z',
          source_ref: null,
          effort_kind: null,
          effort_count: null,
        },
      ],
    };
    const v5 = upgradeEntriesFileToV5(v4);
    expect(v5.schema_version).toBe(5);
    expect(v5.entries[0]?.id).toBe(v4.entries[0]?.id);
  });

  it('is idempotent on a v5 file', () => {
    const v5: EntriesFile = {
      schema_version: 5,
      month: '2026-04',
      entries: [],
    };
    const result = upgradeEntriesFileToV5(v5);
    expect(result.schema_version).toBe(5);
    expect(result).toEqual(v5);
  });

  it('promotes v1 via the full chain', () => {
    const v1 = {
      schema_version: 1 as const,
      month: '2026-04',
      entries: [],
    };
    const v5 = upgradeEntriesFileToV5(v1 as unknown as EntriesFile);
    expect(v5.schema_version).toBe(5);
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npx vitest run tests/data/entries-repo-v5.test.ts`
Expected: FAIL — `upgradeEntriesFileToV5` not exported.

- [ ] **Step 9: Rename + extend upgrade function in `src/data/entries-repo.ts`**

Rename `upgradeEntriesFileToV4` → `upgradeEntriesFileToV5`, update JSDoc and logic:

```ts
/**
 * Upgrade any legacy file (v1–v4) to v5 shape. Additive: no field changes
 * beyond the schema_version. v4 already carries effort_kind/effort_count.
 * Passing an already-v5 file still runs cleanly as idempotent identity.
 */
export function upgradeEntriesFileToV5(file: EntriesFile): EntriesFile {
  // [keep existing v1/v2/v3 → v4 entry normalization logic; then:]
  if (file.schema_version === 5) {
    return { ...file, entries };
  }
  return { ...file, schema_version: 5, entries };
}
```

Update the helper:

```ts
function schemaUpgradeSuffix(fromVersion: EntriesFile['schema_version']): string {
  if (fromVersion === 5) return '';
  return ` [schema v${fromVersion}→v5]`;
}
```

Replace all four call sites of `upgradeEntriesFileToV4` with `upgradeEntriesFileToV5`. Replace literal `schema_version: 4` with `5` in the probe constant (line ~146) and the default file constant (line ~185). Replace `?? 4` with `?? 5` on line ~180.

- [ ] **Step 10: Run test to verify it passes**

Run: `npx vitest run tests/data/entries-repo-v5.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 11: Delete the now-orphaned v4 test file and rename references**

The existing `tests/data/entries-repo-v4.test.ts` will still import `upgradeEntriesFileToV4` which no longer exists. Update its imports to `upgradeEntriesFileToV5` and its assertions to `schema_version: 5`. Rename the file to `entries-repo-v5-compat.test.ts` (it exercises legacy-version acceptance which is still meaningful).

- [ ] **Step 12: Write failing hash property test**

Create `tests/calc/hash-v5.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { hashEntries } from '@/calc/hash';
import type { Entry } from '@/schema/types';

const baseEntry: Entry = {
  id: '2026-04-15-acme-abc123',
  project: 'acme',
  date: '2026-04-15',
  hours_hundredths: 40,
  rate_cents: 10000,
  rate_source: 'project_default',
  billable_status: 'billable',
  bucket_id: null,
  description: 'd',
  review_flag: false,
  created_at: '2026-04-15T12:00:00Z',
  updated_at: '2026-04-15T12:00:00Z',
  source_ref: null,
  effort_kind: null,
  effort_count: null,
};

describe('hashEntries with v5 source_ref kinds', () => {
  it('produces a stable hash for entries carrying source_ref.kind slack', () => {
    const entries: Entry[] = [
      { ...baseEntry, source_ref: { kind: 'slack', id: 'daily:2026-04-15:client:T012AB:acme' } },
    ];
    expect(hashEntries(entries)).toBe(hashEntries(entries));
  });

  it('produces a stable hash for entries carrying source_ref.kind gmail', () => {
    const entries: Entry[] = [
      { ...baseEntry, source_ref: { kind: 'gmail', id: 'daily:2026-04-15:client:acme' } },
    ];
    expect(hashEntries(entries)).toBe(hashEntries(entries));
  });

  it('is insensitive to array order for v5 kinds', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            kind: fc.constantFrom('calendar', 'timer', 'slack', 'gmail', null),
            id: fc.string({ minLength: 1 }),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        (refs) => {
          const entries: Entry[] = refs.map((r, i) => ({
            ...baseEntry,
            id: `2026-04-15-acme-${String(i).padStart(6, '0')}`,
            source_ref: r.kind === null ? null : { kind: r.kind, id: r.id },
          }));
          const shuffled = [...entries].reverse();
          return hashEntries(entries) === hashEntries(shuffled);
        },
      ),
    );
  });

  it('preserves existing v4 hash for entries with source_ref null', () => {
    const entries: Entry[] = [{ ...baseEntry, source_ref: null }];
    // Any refactor that accidentally changes the canonical form for null
    // source_ref entries will break this hash.
    const h = hashEntries(entries);
    expect(h).toMatch(/^[a-f0-9]+$/);
    expect(hashEntries(entries)).toBe(h);
  });
});
```

- [ ] **Step 13: Run new hash test**

Run: `npx vitest run tests/calc/hash-v5.test.ts`
Expected: all 4 tests PASS (no code changes needed — hash canonicalization treats `source_ref.kind` as opaque).

- [ ] **Step 14: Full test + golden + lint suite**

Run: `npm run typecheck && npm run lint && npm test && npm run test:golden`
Expected: 0 typecheck errors, 0 lint warnings, all existing tests pass, March 2026 golden fixture byte-identical.

- [ ] **Step 15: Commit**

```bash
git add schemas/entries.schema.json src/schema/types.ts src/schema/validators.ts \
  src/data/entries-repo.ts tests/schema/entry-v5-migration.test.ts \
  tests/data/entries-repo-v5.test.ts tests/calc/hash-v5.test.ts \
  tests/data/entries-repo-v5-compat.test.ts
git rm tests/data/entries-repo-v4.test.ts 2>/dev/null || true
git commit -m "feat(schema): Entry v5 — source_ref.kind gains slack + gmail"
```

---

## Task 2: `IntegrationsConfig` types + schema + repo module

**Files:**
- Create: `schemas/integrations.schema.json`
- Modify: `src/schema/types.ts`
- Modify: `src/schema/validators.ts`
- Create: `src/data/integrations-repo.ts`
- Modify: `src/data/commit-messages.ts`
- Create: `tests/schema/integrations-config.test.ts`
- Create: `tests/data/integrations-repo.test.ts`

- [ ] **Step 1: Write failing test for config validator**

Create `tests/schema/integrations-config.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/schema/integrations-config.test.ts`
Expected: FAIL — validator doesn't exist.

- [ ] **Step 3: Create `schemas/integrations.schema.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://sapienex-ai.github.io/hours-tracker/schemas/integrations.schema.json",
  "title": "Per-consultant integrations config (v1)",
  "type": "object",
  "required": ["schema_version"],
  "additionalProperties": false,
  "properties": {
    "schema_version": { "enum": [1] },
    "slack": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "enabled": { "type": "boolean" },
        "workspaces": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["id", "name"],
            "additionalProperties": false,
            "properties": {
              "id": { "type": "string", "minLength": 1 },
              "name": { "type": "string", "minLength": 1 }
            }
          }
        },
        "client_channel_prefixes": { "type": "array", "items": { "type": "string" } },
        "internal_channel_prefixes": { "type": "array", "items": { "type": "string" } },
        "project_by_workspace": {
          "type": "object",
          "additionalProperties": { "type": "string", "pattern": "^[a-z0-9-]+$" }
        },
        "project_by_channel_prefix": {
          "type": "object",
          "additionalProperties": { "type": "string", "pattern": "^[a-z0-9-]+$" }
        }
      }
    },
    "gmail": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "enabled": { "type": "boolean" },
        "client_domains": { "type": "array", "items": { "type": "string" } },
        "internal_domains": { "type": "array", "items": { "type": "string" } },
        "project_by_domain": {
          "type": "object",
          "additionalProperties": { "type": "string", "pattern": "^[a-z0-9-]+$" }
        }
      }
    },
    "calendar": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "workshop_min_duration_minutes": { "type": "integer", "minimum": 30 },
        "client_training_title_keywords": { "type": "array", "items": { "type": "string" } },
        "internal_only_attendee_domains": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

- [ ] **Step 4: Add `IntegrationsConfig` type to `src/schema/types.ts`**

Append:

```ts
export type IntegrationsConfig = {
  schema_version: 1;
  slack?: {
    enabled?: boolean;
    workspaces?: Array<{ id: string; name: string }>;
    client_channel_prefixes?: string[];
    internal_channel_prefixes?: string[];
    project_by_workspace?: Record<string, string>;
    project_by_channel_prefix?: Record<string, string>;
  };
  gmail?: {
    enabled?: boolean;
    client_domains?: string[];
    internal_domains?: string[];
    project_by_domain?: Record<string, string>;
  };
  calendar?: {
    workshop_min_duration_minutes?: number;
    client_training_title_keywords?: string[];
    internal_only_attendee_domains?: string[];
  };
};
```

- [ ] **Step 5: Wire validator in `src/schema/validators.ts`**

Add after the existing `validateCalendarConfig` line:

```ts
import integrationsSchema from '../../schemas/integrations.schema.json' assert { type: 'json' };

const _integrations = ajv.compile(integrationsSchema);
export const validateIntegrationsConfig = wrap<IntegrationsConfig>(_integrations);
```

Import `IntegrationsConfig` at the top with the other type imports.

- [ ] **Step 6: Run schema tests**

Run: `npx vitest run tests/schema/integrations-config.test.ts`
Expected: all 5 tests PASS.

- [ ] **Step 7: Write failing test for repo module**

Create `tests/data/integrations-repo.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import type { Octokit } from '@octokit/rest';
import { loadIntegrationsConfig, saveIntegrationsConfig } from '@/data/integrations-repo';

function mockOctokit(fileContent: string | null): Octokit {
  return {
    request: vi.fn(async () => {
      if (fileContent === null) {
        const err = new Error('Not Found') as Error & { status: number };
        err.status = 404;
        throw err;
      }
      return {
        status: 200,
        data: {
          content: Buffer.from(fileContent).toString('base64'),
          sha: 'abc',
          type: 'file',
        },
      };
    }),
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
```

- [ ] **Step 8: Run test to verify failure**

Run: `npx vitest run tests/data/integrations-repo.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 9: Implement `src/data/integrations-repo.ts`**

```ts
import type { Octokit } from '@octokit/rest';
import { readJsonFile, writeJsonFileWithRetry, FileNotFoundError } from './github-file';
import { validateIntegrationsConfig, formatValidationErrors } from '@/schema/validators';
import type { IntegrationsConfig } from '@/schema/types';

const CONFIG_PATH = 'config/integrations.json';

export type LoadArgs = { owner: string; repo: string };

export async function loadIntegrationsConfig(
  octokit: Octokit,
  args: LoadArgs,
): Promise<IntegrationsConfig | null> {
  try {
    const raw = await readJsonFile<unknown>(octokit, {
      owner: args.owner,
      repo: args.repo,
      path: CONFIG_PATH,
    });
    const result = validateIntegrationsConfig(raw);
    if (!result.ok) {
      throw new Error(
        `config/integrations.json failed validation:\n${formatValidationErrors(result.errors)}`,
      );
    }
    return result.value;
  } catch (err) {
    if (err instanceof FileNotFoundError) return null;
    throw err;
  }
}

export type SaveArgs = LoadArgs & {
  config: IntegrationsConfig;
  message: string;
};

export async function saveIntegrationsConfig(
  octokit: Octokit,
  args: SaveArgs,
): Promise<void> {
  const result = validateIntegrationsConfig(args.config);
  if (!result.ok) {
    throw new Error(
      `Cannot save invalid integrations.json:\n${formatValidationErrors(result.errors)}`,
    );
  }
  await writeJsonFileWithRetry<IntegrationsConfig>(octokit, {
    owner: args.owner,
    repo: args.repo,
    path: CONFIG_PATH,
    message: () => args.message,
    transform: () => result.value,
  });
}
```

- [ ] **Step 10: Add `integrationsMessage()` helper to `src/data/commit-messages.ts`**

Append:

```ts
export function integrationsMessage(action: 'create' | 'update'): string {
  return `config: ${action} integrations.json`;
}
```

Add a unit test line inside the existing commit-messages test if the file has a pattern for it.

- [ ] **Step 11: Run repo tests**

Run: `npx vitest run tests/data/integrations-repo.test.ts`
Expected: all 4 tests PASS.

- [ ] **Step 12: Full suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green.

- [ ] **Step 13: Commit**

```bash
git add schemas/integrations.schema.json src/schema/types.ts src/schema/validators.ts \
  src/data/integrations-repo.ts src/data/commit-messages.ts \
  tests/schema/integrations-config.test.ts tests/data/integrations-repo.test.ts
git commit -m "feat(data): integrations.json config + schema v1 + repo module"
```

---

## Task 3: Heuristics module + classification modules

**Files:**
- Create: `src/integrations/heuristics.ts`
- Create: `src/integrations/classification/slack.ts`
- Create: `src/integrations/classification/gmail.ts`
- Create: `src/integrations/classification/calendar.ts`
- Create: `tests/integrations/heuristics.test.ts`
- Create: `tests/integrations/heuristics-property.test.ts`
- Create: `tests/integrations/classification/slack.test.ts`
- Create: `tests/integrations/classification/gmail.test.ts`
- Create: `tests/integrations/classification/calendar.test.ts`

- [ ] **Step 1: Write failing test for heuristics**

Create `tests/integrations/heuristics.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { heuristicHoursHundredths, MINUTES_PER_UNIT } from '@/integrations/heuristics';

describe('heuristicHoursHundredths', () => {
  it('floors to 1 hundredth for zero count', () => {
    expect(heuristicHoursHundredths(2, 0)).toBe(1);
  });

  it('rounds 12 client-Slack threads at 2 min/unit to 40 hundredths', () => {
    expect(heuristicHoursHundredths(2, 12)).toBe(40);
  });

  it('rounds 8 internal emails at 1 min/unit to 13 hundredths', () => {
    expect(heuristicHoursHundredths(1, 8)).toBe(13);
  });

  it('returns 150 hundredths for a 90-min event (actual duration)', () => {
    expect(heuristicHoursHundredths(90, 1)).toBe(150);
  });

  it('MINUTES_PER_UNIT table exposes expected keys', () => {
    expect(MINUTES_PER_UNIT.slack.client).toBe(2);
    expect(MINUTES_PER_UNIT.slack.internal).toBe(1);
    expect(MINUTES_PER_UNIT.email.client).toBe(3);
    expect(MINUTES_PER_UNIT.email.internal).toBe(1);
  });
});
```

- [ ] **Step 2: Run test (should fail)**

Run: `npx vitest run tests/integrations/heuristics.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/integrations/heuristics.ts`**

```ts
export const MINUTES_PER_UNIT = {
  slack: { client: 2, internal: 1 },
  email: { client: 3, internal: 1 },
} as const;

export function heuristicHoursHundredths(
  minutesPerUnit: number,
  count: number,
): number {
  return Math.max(1, Math.round((minutesPerUnit * count * 100) / 60));
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run tests/integrations/heuristics.test.ts`
Expected: PASS.

- [ ] **Step 5: Write property test**

Create `tests/integrations/heuristics-property.test.ts`:

```ts
import { describe, it } from 'vitest';
import fc from 'fast-check';
import { heuristicHoursHundredths } from '@/integrations/heuristics';

describe('heuristicHoursHundredths invariants', () => {
  it('result is always ≥ 1', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 120 }), fc.integer({ min: 0, max: 10000 }), (m, n) => {
        return heuristicHoursHundredths(m, n) >= 1;
      }),
    );
  });

  it('non-decreasing in count', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 120 }), fc.integer({ min: 0, max: 1000 }), (m, n) => {
        return heuristicHoursHundredths(m, n) <= heuristicHoursHundredths(m, n + 1);
      }),
    );
  });

  it('non-decreasing in minutesPerUnit', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 120 }), fc.integer({ min: 1, max: 1000 }), (m, n) => {
        return heuristicHoursHundredths(m, n) <= heuristicHoursHundredths(m + 1, n);
      }),
    );
  });
});
```

- [ ] **Step 6: Run property test**

Run: `npx vitest run tests/integrations/heuristics-property.test.ts`
Expected: all 3 properties hold.

- [ ] **Step 7: Write failing test for Slack classification**

Create `tests/integrations/classification/slack.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { IntegrationsConfig } from '@/schema/types';
import {
  classifySlackChannelActivity,
  classifySlackDmActivity,
  type SlackChannelActivity,
  type SlackDmActivity,
} from '@/integrations/classification/slack';

const config: IntegrationsConfig = {
  schema_version: 1,
  slack: {
    client_channel_prefixes: ['#client-', '#acme-'],
    internal_channel_prefixes: ['#team-', '#internal-'],
    project_by_channel_prefix: { '#acme-': 'acme' },
    project_by_workspace: { T012AB: 'acme' },
  },
  gmail: { client_domains: ['acme.com'], internal_domains: ['sapienex.com'] },
};

describe('classifySlackChannelActivity', () => {
  it('tags #acme-general as client with project acme', () => {
    const activity: SlackChannelActivity = {
      channelName: '#acme-general',
      threadTs: 'ts1',
      workspaceId: 'T012AB',
    };
    const result = classifySlackChannelActivity(activity, config);
    expect(result.direction).toBe('client');
    expect(result.suggestedKind).toBe('slack');
    expect(result.suggestedProjectId).toBe('acme');
  });

  it('tags #team-ops as internal with no project', () => {
    const activity: SlackChannelActivity = {
      channelName: '#team-ops',
      threadTs: 'ts2',
      workspaceId: 'T012AB',
    };
    const result = classifySlackChannelActivity(activity, config);
    expect(result.direction).toBe('internal');
    expect(result.suggestedKind).toBe('internal_sync');
  });

  it('falls to ambiguous when no prefix matches', () => {
    const activity: SlackChannelActivity = {
      channelName: '#random',
      threadTs: 'ts3',
      workspaceId: 'T012AB',
    };
    const result = classifySlackChannelActivity(activity, config);
    expect(result.direction).toBe('ambiguous');
  });
});

describe('classifySlackDmActivity', () => {
  it('tags DM with client participant as client', () => {
    const activity: SlackDmActivity = {
      participantEmails: ['alice@acme.com', 'me@sapienex.com'],
      threadTs: 'ts4',
      workspaceId: 'T012AB',
    };
    const result = classifySlackDmActivity(activity, config);
    expect(result.direction).toBe('client');
    expect(result.suggestedKind).toBe('slack');
  });

  it('tags all-internal DM as internal', () => {
    const activity: SlackDmActivity = {
      participantEmails: ['bob@sapienex.com', 'me@sapienex.com'],
      threadTs: 'ts5',
      workspaceId: 'T012AB',
    };
    const result = classifySlackDmActivity(activity, config);
    expect(result.direction).toBe('internal');
  });

  it('falls to ambiguous when no participant matches any domain list', () => {
    const activity: SlackDmActivity = {
      participantEmails: ['stranger@unknown.com'],
      threadTs: 'ts6',
      workspaceId: 'T012AB',
    };
    const result = classifySlackDmActivity(activity, config);
    expect(result.direction).toBe('ambiguous');
  });
});
```

- [ ] **Step 8: Run (should fail)**

Run: `npx vitest run tests/integrations/classification/slack.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 9: Implement `src/integrations/classification/slack.ts`**

```ts
import type { EffortKind, IntegrationsConfig } from '@/schema/types';

export type SlackChannelActivity = {
  readonly channelName: string;
  readonly threadTs: string;
  readonly workspaceId: string;
};

export type SlackDmActivity = {
  readonly participantEmails: readonly string[];
  readonly threadTs: string;
  readonly workspaceId: string;
};

export type ClassificationResult = {
  readonly direction: 'client' | 'internal' | 'ambiguous';
  readonly suggestedKind: EffortKind;
  readonly suggestedProjectId: string | null;
};

function firstMatchingPrefix(
  name: string,
  prefixes: readonly string[] | undefined,
): string | null {
  if (!prefixes) return null;
  return prefixes.find((p) => name.startsWith(p)) ?? null;
}

export function classifySlackChannelActivity(
  activity: SlackChannelActivity,
  config: IntegrationsConfig,
): ClassificationResult {
  const slack = config.slack ?? {};
  const clientPrefix = firstMatchingPrefix(activity.channelName, slack.client_channel_prefixes);
  const internalPrefix = firstMatchingPrefix(activity.channelName, slack.internal_channel_prefixes);
  const projectByPrefix = clientPrefix ? slack.project_by_channel_prefix?.[clientPrefix] : undefined;
  const projectByWorkspace = slack.project_by_workspace?.[activity.workspaceId] ?? null;
  const suggestedProjectId = projectByPrefix ?? projectByWorkspace ?? null;

  if (clientPrefix) return { direction: 'client', suggestedKind: 'slack', suggestedProjectId };
  if (internalPrefix) return { direction: 'internal', suggestedKind: 'internal_sync', suggestedProjectId: null };
  return { direction: 'ambiguous', suggestedKind: 'slack', suggestedProjectId: null };
}

function domainOf(email: string): string {
  const at = email.lastIndexOf('@');
  return at < 0 ? '' : email.slice(at + 1).toLowerCase();
}

export function classifySlackDmActivity(
  activity: SlackDmActivity,
  config: IntegrationsConfig,
): ClassificationResult {
  const clientDomains = new Set(config.gmail?.client_domains ?? []);
  const internalDomains = new Set(config.gmail?.internal_domains ?? []);
  const domains = activity.participantEmails.map(domainOf);

  const projectByWorkspace = config.slack?.project_by_workspace?.[activity.workspaceId] ?? null;

  if (domains.some((d) => clientDomains.has(d))) {
    return { direction: 'client', suggestedKind: 'slack', suggestedProjectId: projectByWorkspace };
  }
  if (domains.length > 0 && domains.every((d) => internalDomains.has(d))) {
    return { direction: 'internal', suggestedKind: 'internal_sync', suggestedProjectId: null };
  }
  return { direction: 'ambiguous', suggestedKind: 'slack', suggestedProjectId: null };
}
```

- [ ] **Step 10: Run Slack classification test**

Run: `npx vitest run tests/integrations/classification/slack.test.ts`
Expected: all 6 tests PASS.

- [ ] **Step 11: Write failing test for Gmail classification**

Create `tests/integrations/classification/gmail.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { IntegrationsConfig } from '@/schema/types';
import { classifyGmailThread, type GmailThread } from '@/integrations/classification/gmail';

const config: IntegrationsConfig = {
  schema_version: 1,
  gmail: {
    client_domains: ['acme.com', 'bigco.com'],
    internal_domains: ['sapienex.com'],
    project_by_domain: { 'acme.com': 'acme', 'bigco.com': 'bigco' },
  },
};

describe('classifyGmailThread', () => {
  it('tags thread with client recipient as client + project via domain', () => {
    const thread: GmailThread = {
      threadId: 't1',
      recipientEmails: ['alice@acme.com', 'ops@sapienex.com'],
    };
    const result = classifyGmailThread(thread, config);
    expect(result.direction).toBe('client');
    expect(result.suggestedKind).toBe('email');
    expect(result.suggestedProjectId).toBe('acme');
  });

  it('tags all-internal thread as internal', () => {
    const thread: GmailThread = {
      threadId: 't2',
      recipientEmails: ['bob@sapienex.com', 'ops@sapienex.com'],
    };
    const result = classifyGmailThread(thread, config);
    expect(result.direction).toBe('internal');
    expect(result.suggestedKind).toBe('internal_sync');
  });

  it('falls to ambiguous on unknown domains', () => {
    const thread: GmailThread = {
      threadId: 't3',
      recipientEmails: ['stranger@unknown.com'],
    };
    const result = classifyGmailThread(thread, config);
    expect(result.direction).toBe('ambiguous');
    expect(result.suggestedKind).toBe('email');
  });

  it('first client-domain match wins for project id', () => {
    const thread: GmailThread = {
      threadId: 't4',
      recipientEmails: ['user@bigco.com', 'user@acme.com'],
    };
    const result = classifyGmailThread(thread, config);
    expect(result.suggestedProjectId).toBe('bigco');
  });
});
```

- [ ] **Step 12: Implement `src/integrations/classification/gmail.ts`**

```ts
import type { EffortKind, IntegrationsConfig } from '@/schema/types';
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
```

- [ ] **Step 13: Run Gmail classification test**

Run: `npx vitest run tests/integrations/classification/gmail.test.ts`
Expected: all 4 tests PASS.

- [ ] **Step 14: Write failing test for calendar classification**

Create `tests/integrations/classification/calendar.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { IntegrationsConfig } from '@/schema/types';
import {
  classifyCalendarEvent,
  type CalendarEvent,
} from '@/integrations/classification/calendar';

const config: IntegrationsConfig = {
  schema_version: 1,
  calendar: {
    workshop_min_duration_minutes: 120,
    client_training_title_keywords: ['training', 'workshop'],
    internal_only_attendee_domains: ['sapienex.com'],
  },
};

describe('classifyCalendarEvent', () => {
  it('tags a "training" titled event with external attendees as client_training', () => {
    const event: CalendarEvent = {
      id: 'e1',
      title: 'Acme training session',
      durationMinutes: 60,
      attendeeDomains: ['acme.com', 'sapienex.com'],
    };
    const result = classifyCalendarEvent(event, config);
    expect(result.direction).toBe('client');
    expect(result.suggestedKind).toBe('client_training');
  });

  it('tags a 180-min event with external attendees as workshop', () => {
    const event: CalendarEvent = {
      id: 'e2',
      title: 'Strategy session',
      durationMinutes: 180,
      attendeeDomains: ['acme.com', 'sapienex.com'],
    };
    const result = classifyCalendarEvent(event, config);
    expect(result.suggestedKind).toBe('workshop');
  });

  it('tags an all-internal event as internal_sync', () => {
    const event: CalendarEvent = {
      id: 'e3',
      title: 'Team standup',
      durationMinutes: 15,
      attendeeDomains: ['sapienex.com'],
    };
    const result = classifyCalendarEvent(event, config);
    expect(result.direction).toBe('internal');
    expect(result.suggestedKind).toBe('internal_sync');
  });

  it('falls to client meeting when nothing else matches', () => {
    const event: CalendarEvent = {
      id: 'e4',
      title: 'Acme sync',
      durationMinutes: 30,
      attendeeDomains: ['acme.com', 'sapienex.com'],
    };
    const result = classifyCalendarEvent(event, config);
    expect(result.direction).toBe('client');
    expect(result.suggestedKind).toBe('meeting');
  });
});
```

- [ ] **Step 15: Implement `src/integrations/classification/calendar.ts`**

```ts
import type { EffortKind, IntegrationsConfig } from '@/schema/types';
import type { ClassificationResult } from './slack';

export type CalendarEvent = {
  readonly id: string;
  readonly title: string;
  readonly durationMinutes: number;
  readonly attendeeDomains: readonly string[];
};

export function classifyCalendarEvent(
  event: CalendarEvent,
  config: IntegrationsConfig,
): ClassificationResult {
  const c = config.calendar ?? {};
  const keywords = c.client_training_title_keywords ?? [];
  const workshopMin = c.workshop_min_duration_minutes ?? 120;
  const internalDomains = new Set(c.internal_only_attendee_domains ?? []);
  const titleLc = event.title.toLowerCase();
  const hasExternal = event.attendeeDomains.some((d) => !internalDomains.has(d));
  const allInternal = event.attendeeDomains.length > 0 &&
    event.attendeeDomains.every((d) => internalDomains.has(d));

  if (hasExternal && keywords.some((k) => titleLc.includes(k.toLowerCase()))) {
    return { direction: 'client', suggestedKind: 'client_training', suggestedProjectId: null };
  }
  if (hasExternal && event.durationMinutes >= workshopMin) {
    return { direction: 'client', suggestedKind: 'workshop', suggestedProjectId: null };
  }
  if (allInternal) {
    return { direction: 'internal', suggestedKind: 'internal_sync', suggestedProjectId: null };
  }
  return { direction: 'client', suggestedKind: 'meeting', suggestedProjectId: null };
}
```

- [ ] **Step 16: Run calendar classification test**

Run: `npx vitest run tests/integrations/classification/calendar.test.ts`
Expected: all 4 tests PASS.

- [ ] **Step 17: Full suite + commit**

```bash
npm run typecheck && npm run lint && npm test
git add src/integrations/heuristics.ts src/integrations/classification/ \
  tests/integrations/heuristics.test.ts tests/integrations/heuristics-property.test.ts \
  tests/integrations/classification/
git commit -m "feat(integrations): heuristics + direction classifiers (slack / gmail / calendar)"
```

---

## Task 4: `EffortSourceAdapter` interface + types

**Files:**
- Create: `src/integrations/adapters/types.ts`
- Create: `tests/integrations/adapters/types.test.ts`

- [ ] **Step 1: Write contract test**

Create `tests/integrations/adapters/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type {
  EffortSourceAdapter,
  DigestRow,
  DigestItem,
  SourceKind,
  DigestDirection,
} from '@/integrations/adapters/types';

describe('EffortSourceAdapter contract', () => {
  it('accepts a minimal adapter implementation', () => {
    const adapter: EffortSourceAdapter = {
      source: 'calendar',
      isConnected: () => false,
      connect: async () => {},
      disconnect: async () => {},
      fetchDailyDigest: async () => [],
    };
    expect(adapter.source).toBe('calendar');
  });

  it('DigestRow type composes cleanly', () => {
    const row: DigestRow = {
      source: 'slack',
      direction: 'client',
      count: 12,
      heuristicHoursHundredths: 40,
      suggestedKind: 'slack',
      suggestedProjectId: 'acme',
      batchId: 'daily:2026-04-15:client:T012AB:acme',
      items: [],
      label: 'Slack → Acme (12 threads)',
    };
    expect(row.source).toBe('slack');
  });

  it('SourceKind has exactly three members', () => {
    const kinds: SourceKind[] = ['calendar', 'slack', 'gmail'];
    expect(kinds).toHaveLength(3);
  });

  it('DigestDirection has exactly three members', () => {
    const dirs: DigestDirection[] = ['client', 'internal', 'ambiguous'];
    expect(dirs).toHaveLength(3);
  });

  it('DigestItem composes cleanly', () => {
    const item: DigestItem = {
      timestamp: '2026-04-15T12:00:00Z',
      label: 'thread',
      externalId: 'abc',
    };
    expect(item.externalId).toBe('abc');
  });
});
```

- [ ] **Step 2: Run (should fail)**

Run: `npx vitest run tests/integrations/adapters/types.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/integrations/adapters/types.ts`**

```ts
import type { EffortKind } from '@/schema/types';

export type SourceKind = 'calendar' | 'slack' | 'gmail';
export type DigestDirection = 'client' | 'internal' | 'ambiguous';

export interface DigestItem {
  readonly timestamp: string;
  readonly label: string;
  readonly externalId: string;
}

export interface DigestRow {
  readonly source: SourceKind;
  readonly direction: DigestDirection;
  readonly count: number;
  readonly heuristicHoursHundredths: number;
  readonly suggestedKind: EffortKind;
  readonly suggestedProjectId: string | null;
  readonly batchId: string;
  readonly items: readonly DigestItem[];
  readonly label: string;
}

export interface EffortSourceAdapter {
  readonly source: SourceKind;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  fetchDailyDigest(date: string): Promise<DigestRow[]>;
}
```

- [ ] **Step 4: Verify**

Run: `npx vitest run tests/integrations/adapters/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/integrations/adapters/types.ts tests/integrations/adapters/types.test.ts
git commit -m "feat(integrations): EffortSourceAdapter interface + DigestRow types"
```

---

## Task 5: Calendar adapter refactor

**Files:**
- Create: `src/integrations/adapters/calendar-adapter.ts`
- Create: `tests/integrations/adapters/calendar-adapter.test.ts`
- Modify: `src/integrations/calendar/event-to-entry.ts` (called from adapter; no behavior change)

- [ ] **Step 1: Identify the refactor target**

Run: `npx grep -n "fetchCalendarEvents\|buildSuggestion" src/integrations/calendar/*.ts src/ui/screens/QuickLog.tsx`
(Note the function names and call sites.) The refactor wraps the existing fetch + event→suggestion logic into a new adapter class while keeping both the legacy code path live (for the "Individual calendar events" fallback) and the adapter path live (for the DigestPanel).

- [ ] **Step 2: Write failing adapter test**

Create `tests/integrations/adapters/calendar-adapter.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { CalendarAdapter } from '@/integrations/adapters/calendar-adapter';
import type { IntegrationsConfig } from '@/schema/types';

const minimalConfig: IntegrationsConfig = {
  schema_version: 1,
  calendar: { workshop_min_duration_minutes: 120 },
};

describe('CalendarAdapter', () => {
  it('reports source: calendar', () => {
    const adapter = new CalendarAdapter({
      config: minimalConfig,
      fetchEvents: async () => [],
      isConnected: () => false,
      connect: async () => {},
      disconnect: async () => {},
    });
    expect(adapter.source).toBe('calendar');
  });

  it('emits a single-event digest row for a workshop', async () => {
    const adapter = new CalendarAdapter({
      config: minimalConfig,
      fetchEvents: async () => [
        {
          id: 'ev1',
          title: 'Acme strategy session',
          startTime: '2026-04-15T10:00:00Z',
          durationMinutes: 180,
          attendeeDomains: ['acme.com', 'sapienex.com'],
        },
      ],
      isConnected: () => true,
      connect: async () => {},
      disconnect: async () => {},
    });
    const rows = await adapter.fetchDailyDigest('2026-04-15');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.suggestedKind).toBe('workshop');
    expect(rows[0]?.count).toBe(1);
    expect(rows[0]?.heuristicHoursHundredths).toBe(300);
  });

  it('batches short meetings per direction', async () => {
    const adapter = new CalendarAdapter({
      config: {
        schema_version: 1,
        calendar: { internal_only_attendee_domains: ['sapienex.com'] },
      },
      fetchEvents: async () => [
        {
          id: 'ev1',
          title: 'Acme quick sync',
          startTime: '2026-04-15T10:00:00Z',
          durationMinutes: 15,
          attendeeDomains: ['acme.com', 'sapienex.com'],
        },
        {
          id: 'ev2',
          title: 'Acme catch-up',
          startTime: '2026-04-15T11:00:00Z',
          durationMinutes: 15,
          attendeeDomains: ['acme.com', 'sapienex.com'],
        },
        {
          id: 'ev3',
          title: 'Standup',
          startTime: '2026-04-15T09:00:00Z',
          durationMinutes: 15,
          attendeeDomains: ['sapienex.com'],
        },
      ],
      isConnected: () => true,
      connect: async () => {},
      disconnect: async () => {},
    });
    const rows = await adapter.fetchDailyDigest('2026-04-15');
    const clientBatch = rows.find((r) => r.direction === 'client' && r.count > 1);
    const internalBatch = rows.find((r) => r.direction === 'internal');
    expect(clientBatch?.count).toBe(2);
    expect(internalBatch?.count).toBe(1);
  });

  it('returns [] when not connected', async () => {
    const adapter = new CalendarAdapter({
      config: minimalConfig,
      fetchEvents: async () => [],
      isConnected: () => false,
      connect: async () => {},
      disconnect: async () => {},
    });
    expect(await adapter.fetchDailyDigest('2026-04-15')).toEqual([]);
  });
});
```

- [ ] **Step 3: Implement `src/integrations/adapters/calendar-adapter.ts`**

```ts
import type { EffortSourceAdapter, DigestRow } from './types';
import type { IntegrationsConfig } from '@/schema/types';
import { classifyCalendarEvent } from '@/integrations/classification/calendar';
import { heuristicHoursHundredths } from '@/integrations/heuristics';

export type RawCalendarEvent = {
  readonly id: string;
  readonly title: string;
  readonly startTime: string;
  readonly durationMinutes: number;
  readonly attendeeDomains: readonly string[];
};

export type CalendarAdapterDeps = {
  readonly config: IntegrationsConfig;
  readonly fetchEvents: (date: string) => Promise<RawCalendarEvent[]>;
  readonly isConnected: () => boolean;
  readonly connect: () => Promise<void>;
  readonly disconnect: () => Promise<void>;
};

const SHORT_MEETING_MAX_MIN = 30;

export class CalendarAdapter implements EffortSourceAdapter {
  readonly source = 'calendar' as const;
  private readonly deps: CalendarAdapterDeps;

  constructor(deps: CalendarAdapterDeps) {
    this.deps = deps;
  }

  isConnected(): boolean {
    return this.deps.isConnected();
  }

  async connect(): Promise<void> {
    await this.deps.connect();
  }

  async disconnect(): Promise<void> {
    await this.deps.disconnect();
  }

  async fetchDailyDigest(date: string): Promise<DigestRow[]> {
    if (!this.deps.isConnected()) return [];
    const events = await this.deps.fetchEvents(date);
    const individual: DigestRow[] = [];
    const shortByDirection = new Map<'client' | 'internal' | 'ambiguous', RawCalendarEvent[]>();

    for (const event of events) {
      const classification = classifyCalendarEvent(event, this.deps.config);
      const isSubstantiveKind =
        classification.suggestedKind === 'workshop' ||
        classification.suggestedKind === 'client_training';
      const isLongEnough = event.durationMinutes >= SHORT_MEETING_MAX_MIN;
      if (isSubstantiveKind || isLongEnough) {
        individual.push({
          source: 'calendar',
          direction: classification.direction,
          count: 1,
          heuristicHoursHundredths: heuristicHoursHundredths(event.durationMinutes, 1),
          suggestedKind: classification.suggestedKind,
          suggestedProjectId: classification.suggestedProjectId,
          batchId: event.id,
          items: [{ timestamp: event.startTime, label: event.title, externalId: event.id }],
          label: event.title,
        });
      } else {
        const bucket = shortByDirection.get(classification.direction) ?? [];
        bucket.push(event);
        shortByDirection.set(classification.direction, bucket);
      }
    }

    for (const [direction, batch] of shortByDirection) {
      if (batch.length === 0) continue;
      const totalMinutes = batch.reduce((sum, e) => sum + e.durationMinutes, 0);
      const first = batch[0]!;
      const kind = classifyCalendarEvent(first, this.deps.config).suggestedKind;
      individual.push({
        source: 'calendar',
        direction,
        count: batch.length,
        heuristicHoursHundredths: heuristicHoursHundredths(totalMinutes, 1),
        suggestedKind: kind,
        suggestedProjectId: null,
        batchId: `daily:${date}:short-meetings-${direction}`,
        items: batch.map((e) => ({ timestamp: e.startTime, label: e.title, externalId: e.id })),
        label: `Calendar — short meetings (${batch.length})`,
      });
    }

    return individual;
  }
}
```

- [ ] **Step 4: Run adapter test**

Run: `npx vitest run tests/integrations/adapters/calendar-adapter.test.ts`
Expected: all 4 tests PASS.

- [ ] **Step 5: Full suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/integrations/adapters/calendar-adapter.ts tests/integrations/adapters/calendar-adapter.test.ts
git commit -m "feat(integrations): CalendarAdapter wraps existing calendar on new interface"
```

---

## Task 6: Gmail adapter (API wrapper + adapter + auth)

**Files:**
- Create: `src/integrations/google/gmail-api.ts`
- Create: `src/integrations/adapters/gmail-adapter.ts`
- Create: `tests/integrations/gmail-api.test.ts`
- Create: `tests/integrations/adapters/gmail-adapter.test.ts`
- Modify: `src/integrations/google/gis-client.ts` (add gmail scope support)

- [ ] **Step 1: Inspect existing GIS client for scope extension**

Read `src/integrations/google/gis-client.ts` to locate the token-request call. Note whether scopes are a constant or configurable at runtime.

- [ ] **Step 2: Add `GMAIL_READONLY_SCOPE` constant + scope-request extension**

In `src/integrations/google/gis-client.ts`, add:

```ts
export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
```

Extend the token-client constructor's `scope` field to include both `calendar.readonly` and `gmail.readonly` joined by space. If the current code hardcodes calendar-only, keep it as a default and expose a function `requestTokenWithScopes(scopes: string[])` used by both calendar and gmail paths.

Test behavior: existing calendar tests still pass unchanged.

- [ ] **Step 3: Write failing Gmail API test**

Create `tests/integrations/gmail-api.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchSentThreadsForDate } from '@/integrations/google/gmail-api';

const fetchMock = vi.fn();

function setupFetch(listBody: unknown, threadBody: unknown) {
  fetchMock.mockReset();
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => listBody });
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => threadBody });
}

describe('fetchSentThreadsForDate', () => {
  it('constructs in:sent after:/before: query for the target date', async () => {
    setupFetch({ messages: [] }, {});
    await fetchSentThreadsForDate({
      token: 't',
      date: '2026-04-15',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toMatch(/in%3Asent/);
    expect(url).toMatch(/after%3A2026%2F04%2F15/);
  });

  it('groups messages by thread', async () => {
    setupFetch(
      { messages: [{ id: 'm1', threadId: 't1' }, { id: 'm2', threadId: 't1' }, { id: 'm3', threadId: 't2' }] },
      {},
    );
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        threadId: 't1',
        messages: [{ payload: { headers: [{ name: 'To', value: 'a@acme.com' }] } }],
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        threadId: 't2',
        messages: [{ payload: { headers: [{ name: 'To', value: 'b@sapienex.com' }] } }],
      }),
    });
    const threads = await fetchSentThreadsForDate({
      token: 't',
      date: '2026-04-15',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(threads).toHaveLength(2);
    expect(threads[0]?.threadId).toBe('t1');
    expect(threads[0]?.recipientEmails).toContain('a@acme.com');
  });

  it('throws on 401 response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' });
    await expect(
      fetchSentThreadsForDate({
        token: 'bad',
        date: '2026-04-15',
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/401/);
  });
});
```

- [ ] **Step 4: Implement `src/integrations/google/gmail-api.ts`**

```ts
export type GmailThreadResult = {
  readonly threadId: string;
  readonly recipientEmails: readonly string[];
};

export type FetchArgs = {
  readonly token: string;
  readonly date: string; // YYYY-MM-DD
  readonly fetchImpl?: typeof fetch;
};

function nextDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function toGmailDate(date: string): string {
  return date.replace(/-/g, '/');
}

function parseEmails(headerValue: string): string[] {
  return headerValue
    .split(',')
    .map((s) => {
      const m = s.match(/<([^>]+)>/);
      return (m ? m[1] : s.trim()).toLowerCase();
    })
    .filter((s) => s.includes('@'));
}

export async function fetchSentThreadsForDate(args: FetchArgs): Promise<GmailThreadResult[]> {
  const f = args.fetchImpl ?? fetch;
  const after = toGmailDate(args.date);
  const before = toGmailDate(nextDate(args.date));
  const q = encodeURIComponent(`in:sent after:${after} before:${before}`);
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}`;

  const listResp = await f(listUrl, {
    headers: { Authorization: `Bearer ${args.token}` },
  });
  if (!listResp.ok) {
    throw new Error(`Gmail list failed: ${listResp.status} ${listResp.statusText}`);
  }
  const listBody = (await listResp.json()) as { messages?: Array<{ threadId: string }> };
  const threadIds = Array.from(new Set((listBody.messages ?? []).map((m) => m.threadId)));

  const threads: GmailThreadResult[] = [];
  for (const threadId of threadIds) {
    const threadResp = await f(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
      { headers: { Authorization: `Bearer ${args.token}` } },
    );
    if (!threadResp.ok) continue;
    const body = (await threadResp.json()) as {
      messages?: Array<{ payload?: { headers?: Array<{ name: string; value: string }> } }>;
    };
    const recipients = new Set<string>();
    for (const msg of body.messages ?? []) {
      for (const header of msg.payload?.headers ?? []) {
        if (header.name === 'To' || header.name === 'Cc') {
          parseEmails(header.value).forEach((e) => recipients.add(e));
        }
      }
    }
    threads.push({ threadId, recipientEmails: Array.from(recipients) });
  }

  return threads;
}
```

- [ ] **Step 5: Run API test**

Run: `npx vitest run tests/integrations/gmail-api.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 6: Write failing adapter test**

Create `tests/integrations/adapters/gmail-adapter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GmailAdapter } from '@/integrations/adapters/gmail-adapter';
import type { IntegrationsConfig } from '@/schema/types';

const config: IntegrationsConfig = {
  schema_version: 1,
  gmail: {
    enabled: true,
    client_domains: ['acme.com'],
    internal_domains: ['sapienex.com'],
    project_by_domain: { 'acme.com': 'acme' },
  },
};

describe('GmailAdapter', () => {
  it('groups threads by direction into digest rows', async () => {
    const adapter = new GmailAdapter({
      config,
      fetchThreads: async () => [
        { threadId: 't1', recipientEmails: ['alice@acme.com'] },
        { threadId: 't2', recipientEmails: ['bob@acme.com'] },
        { threadId: 't3', recipientEmails: ['peer@sapienex.com'] },
      ],
      isConnected: () => true,
      connect: async () => {},
      disconnect: async () => {},
    });
    const rows = await adapter.fetchDailyDigest('2026-04-15');
    const client = rows.find((r) => r.direction === 'client');
    const internal = rows.find((r) => r.direction === 'internal');
    expect(client?.count).toBe(2);
    expect(client?.suggestedKind).toBe('email');
    expect(client?.suggestedProjectId).toBe('acme');
    expect(internal?.count).toBe(1);
  });

  it('returns [] when disabled in config', async () => {
    const adapter = new GmailAdapter({
      config: { schema_version: 1, gmail: { enabled: false } },
      fetchThreads: async () => [{ threadId: 't1', recipientEmails: ['alice@acme.com'] }],
      isConnected: () => true,
      connect: async () => {},
      disconnect: async () => {},
    });
    expect(await adapter.fetchDailyDigest('2026-04-15')).toEqual([]);
  });

  it('batch id follows daily:YYYY-MM-DD:direction:projectId shape', async () => {
    const adapter = new GmailAdapter({
      config,
      fetchThreads: async () => [{ threadId: 't1', recipientEmails: ['alice@acme.com'] }],
      isConnected: () => true,
      connect: async () => {},
      disconnect: async () => {},
    });
    const rows = await adapter.fetchDailyDigest('2026-04-15');
    expect(rows[0]?.batchId).toBe('daily:2026-04-15:client:acme');
  });
});
```

- [ ] **Step 7: Implement `src/integrations/adapters/gmail-adapter.ts`**

```ts
import type { EffortSourceAdapter, DigestRow } from './types';
import type { IntegrationsConfig } from '@/schema/types';
import { classifyGmailThread } from '@/integrations/classification/gmail';
import { heuristicHoursHundredths, MINUTES_PER_UNIT } from '@/integrations/heuristics';
import type { GmailThreadResult } from '@/integrations/google/gmail-api';

export type GmailAdapterDeps = {
  readonly config: IntegrationsConfig;
  readonly fetchThreads: (date: string) => Promise<GmailThreadResult[]>;
  readonly isConnected: () => boolean;
  readonly connect: () => Promise<void>;
  readonly disconnect: () => Promise<void>;
};

export class GmailAdapter implements EffortSourceAdapter {
  readonly source = 'gmail' as const;
  private readonly deps: GmailAdapterDeps;

  constructor(deps: GmailAdapterDeps) {
    this.deps = deps;
  }

  isConnected(): boolean {
    return this.deps.isConnected();
  }

  async connect(): Promise<void> {
    await this.deps.connect();
  }

  async disconnect(): Promise<void> {
    await this.deps.disconnect();
  }

  async fetchDailyDigest(date: string): Promise<DigestRow[]> {
    if (!this.deps.isConnected()) return [];
    if (this.deps.config.gmail?.enabled === false) return [];
    const threads = await this.deps.fetchThreads(date);
    type Group = {
      direction: 'client' | 'internal' | 'ambiguous';
      projectId: string | null;
      kind: import('@/schema/types').EffortKind;
      threadIds: string[];
    };
    const groups = new Map<string, Group>();

    for (const thread of threads) {
      const c = classifyGmailThread(thread, this.deps.config);
      const key = `${c.direction}|${c.suggestedProjectId ?? ''}|${c.suggestedKind}`;
      const existing = groups.get(key);
      if (existing) {
        existing.threadIds.push(thread.threadId);
      } else {
        groups.set(key, {
          direction: c.direction,
          projectId: c.suggestedProjectId,
          kind: c.suggestedKind,
          threadIds: [thread.threadId],
        });
      }
    }

    const rows: DigestRow[] = [];
    for (const g of groups.values()) {
      const minutesPerUnit =
        g.direction === 'client' ? MINUTES_PER_UNIT.email.client : MINUTES_PER_UNIT.email.internal;
      rows.push({
        source: 'gmail',
        direction: g.direction,
        count: g.threadIds.length,
        heuristicHoursHundredths: heuristicHoursHundredths(minutesPerUnit, g.threadIds.length),
        suggestedKind: g.kind,
        suggestedProjectId: g.projectId,
        batchId: `daily:${date}:${g.direction}:${g.projectId ?? 'unmatched'}`,
        items: g.threadIds.map((id) => ({
          timestamp: date + 'T00:00:00Z',
          label: id,
          externalId: id,
        })),
        label: `Email → ${g.direction === 'client' ? g.projectId ?? 'client' : g.direction} (${g.threadIds.length} threads)`,
      });
    }

    return rows;
  }
}
```

- [ ] **Step 8: Run adapter test**

Run: `npx vitest run tests/integrations/adapters/gmail-adapter.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 9: Full suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: green.

- [ ] **Step 10: Commit**

```bash
git add src/integrations/google/gmail-api.ts src/integrations/adapters/gmail-adapter.ts \
  src/integrations/google/gis-client.ts tests/integrations/gmail-api.test.ts \
  tests/integrations/adapters/gmail-adapter.test.ts
git commit -m "feat(integrations): GmailAdapter — sent-folder digest, Google scope extended"
```

---

## Task 7: Slack adapter (API wrapper + BYO-token auth + adapter)

**Files:**
- Create: `src/integrations/slack/client.ts`
- Create: `src/integrations/slack/auth.ts`
- Create: `src/integrations/adapters/slack-adapter.ts`
- Create: `tests/integrations/slack-client.test.ts`
- Create: `tests/integrations/slack-auth.test.ts`
- Create: `tests/integrations/adapters/slack-adapter.test.ts`

- [ ] **Step 1: Write failing Slack client test**

Create `tests/integrations/slack-client.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchSlackActivityForDate } from '@/integrations/slack/client';

const fetchMock = vi.fn();

describe('fetchSlackActivityForDate', () => {
  it('aggregates thread_ts across channels + DMs', async () => {
    fetchMock.mockReset();
    // conversations.list (channels)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, channels: [{ id: 'C1', name: 'client-acme' }], response_metadata: {} }),
    });
    // conversations.history for C1
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        messages: [{ ts: '1.1', user: 'U1' }, { ts: '1.2', user: 'U1', thread_ts: '1.1' }, { ts: '1.3', user: 'U1' }],
        response_metadata: {},
      }),
    });
    // conversations.list (DMs via im)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, channels: [], response_metadata: {} }),
    });

    const result = await fetchSlackActivityForDate({
      token: 'xoxb-x',
      workspaceId: 'T012AB',
      userId: 'U1',
      date: '2026-04-15',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result.channelThreads.filter((t) => t.channelName === 'client-acme')).toHaveLength(2);
  });

  it('retries once on rate limit with Retry-After', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({ 'Retry-After': '0' }),
      json: async () => ({}),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, channels: [], response_metadata: {} }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, channels: [], response_metadata: {} }),
    });
    const result = await fetchSlackActivityForDate({
      token: 'xoxb-x',
      workspaceId: 'T012AB',
      userId: 'U1',
      date: '2026-04-15',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result).toBeDefined();
  });

  it('throws on invalid_auth', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false, error: 'invalid_auth' }),
    });
    await expect(
      fetchSlackActivityForDate({
        token: 'bad',
        workspaceId: 'T012AB',
        userId: 'U1',
        date: '2026-04-15',
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/invalid_auth/);
  });
});
```

- [ ] **Step 2: Implement `src/integrations/slack/client.ts`**

```ts
export type SlackChannelThread = {
  readonly channelName: string;
  readonly threadTs: string;
};

export type SlackDmThread = {
  readonly participantEmails: readonly string[];
  readonly threadTs: string;
};

export type SlackActivityResult = {
  readonly channelThreads: readonly SlackChannelThread[];
  readonly dmThreads: readonly SlackDmThread[];
};

export type FetchArgs = {
  readonly token: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly date: string;
  readonly fetchImpl?: typeof fetch;
};

async function slackGet<T>(
  url: string,
  token: string,
  f: typeof fetch,
): Promise<T> {
  const doFetch = async (): Promise<Response> => f(url, { headers: { Authorization: `Bearer ${token}` } });
  let resp = await doFetch();
  if (resp.status === 429) {
    const retry = parseInt(resp.headers.get('Retry-After') ?? '0', 10) * 1000;
    await new Promise((r) => setTimeout(r, retry));
    resp = await doFetch();
  }
  if (!resp.ok) throw new Error(`Slack HTTP ${resp.status}`);
  const body = (await resp.json()) as { ok?: boolean; error?: string } & T;
  if (body.ok === false) throw new Error(`Slack API error: ${body.error}`);
  return body;
}

function dayWindow(date: string): { after: number; before: number } {
  const start = Date.parse(`${date}T00:00:00Z`) / 1000;
  const end = start + 86400;
  return { after: start, before: end };
}

export async function fetchSlackActivityForDate(
  args: FetchArgs,
): Promise<SlackActivityResult> {
  const f = args.fetchImpl ?? fetch;
  const { after, before } = dayWindow(args.date);
  const channelsBody = await slackGet<{
    channels: Array<{ id: string; name: string }>;
  }>(
    `https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=1000`,
    args.token,
    f,
  );

  const channelThreads: SlackChannelThread[] = [];
  for (const ch of channelsBody.channels) {
    const historyBody = await slackGet<{
      messages: Array<{ ts: string; user?: string; thread_ts?: string }>;
    }>(
      `https://slack.com/api/conversations.history?channel=${ch.id}&oldest=${after}&latest=${before}&limit=200`,
      args.token,
      f,
    );
    const threadIds = new Set<string>();
    for (const msg of historyBody.messages) {
      if (msg.user !== args.userId) continue;
      threadIds.add(msg.thread_ts ?? msg.ts);
    }
    for (const tts of threadIds) {
      channelThreads.push({ channelName: ch.name, threadTs: tts });
    }
  }

  const dmsBody = await slackGet<{
    channels: Array<{ id: string; user?: string }>;
  }>(
    `https://slack.com/api/conversations.list?types=im&limit=1000`,
    args.token,
    f,
  );
  const dmThreads: SlackDmThread[] = [];
  for (const dm of dmsBody.channels) {
    const historyBody = await slackGet<{
      messages: Array<{ ts: string; user?: string; thread_ts?: string }>;
    }>(
      `https://slack.com/api/conversations.history?channel=${dm.id}&oldest=${after}&latest=${before}&limit=200`,
      args.token,
      f,
    );
    const threadIds = new Set<string>();
    for (const msg of historyBody.messages) {
      if (msg.user !== args.userId) continue;
      threadIds.add(msg.thread_ts ?? msg.ts);
    }
    if (threadIds.size === 0) continue;
    const otherUserId = dm.user;
    let email = '';
    if (otherUserId) {
      const userBody = await slackGet<{ user: { profile: { email?: string } } }>(
        `https://slack.com/api/users.info?user=${otherUserId}`,
        args.token,
        f,
      );
      email = userBody.user.profile.email?.toLowerCase() ?? '';
    }
    for (const tts of threadIds) {
      dmThreads.push({ participantEmails: email ? [email] : [], threadTs: tts });
    }
  }

  return { channelThreads, dmThreads };
}
```

- [ ] **Step 3: Run Slack client test**

Run: `npx vitest run tests/integrations/slack-client.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 4: Write failing auth test**

Create `tests/integrations/slack-auth.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { validateSlackBotToken } from '@/integrations/slack/auth';

describe('validateSlackBotToken', () => {
  it('accepts a valid bot token via auth.test', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, team_id: 'T012AB', user_id: 'U1', team: 'Acme' }),
    });
    const result = await validateSlackBotToken({
      token: 'xoxb-valid',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result.workspaceId).toBe('T012AB');
    expect(result.botUserId).toBe('U1');
  });

  it('throws on invalid token', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false, error: 'invalid_auth' }),
    });
    await expect(
      validateSlackBotToken({ token: 'bad', fetchImpl: fetchMock as unknown as typeof fetch }),
    ).rejects.toThrow(/invalid_auth/);
  });

  it('rejects non-xoxb tokens without even calling Slack', async () => {
    const fetchMock = vi.fn();
    await expect(
      validateSlackBotToken({ token: 'xoxp-user', fetchImpl: fetchMock as unknown as typeof fetch }),
    ).rejects.toThrow(/xoxb/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Implement `src/integrations/slack/auth.ts`**

```ts
export type ValidateArgs = {
  readonly token: string;
  readonly fetchImpl?: typeof fetch;
};

export type ValidateResult = {
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly botUserId: string;
};

export async function validateSlackBotToken(args: ValidateArgs): Promise<ValidateResult> {
  if (!args.token.startsWith('xoxb-')) {
    throw new Error('Slack bot tokens must start with xoxb-');
  }
  const f = args.fetchImpl ?? fetch;
  const resp = await f('https://slack.com/api/auth.test', {
    method: 'POST',
    headers: { Authorization: `Bearer ${args.token}` },
  });
  const body = (await resp.json()) as {
    ok: boolean;
    error?: string;
    team_id?: string;
    team?: string;
    user_id?: string;
  };
  if (!body.ok) throw new Error(`Slack ${body.error ?? 'auth.test failed'}`);
  return {
    workspaceId: body.team_id ?? '',
    workspaceName: body.team ?? '',
    botUserId: body.user_id ?? '',
  };
}

const TOKEN_KEY = 'hours-tracker.slack-token';
const WORKSPACE_KEY = 'hours-tracker.slack-workspace';
const USER_KEY = 'hours-tracker.slack-user-id';

export type SlackSession = {
  readonly token: string;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly botUserId: string;
};

export function loadSlackSession(): SlackSession | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const workspaceId = localStorage.getItem(WORKSPACE_KEY);
  const botUserId = localStorage.getItem(USER_KEY);
  if (!token || !workspaceId || !botUserId) return null;
  return { token, workspaceId, workspaceName: '', botUserId };
}

export function storeSlackSession(session: SlackSession): void {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(WORKSPACE_KEY, session.workspaceId);
  localStorage.setItem(USER_KEY, session.botUserId);
}

export function clearSlackSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(WORKSPACE_KEY);
  localStorage.removeItem(USER_KEY);
}
```

- [ ] **Step 6: Run auth test**

Run: `npx vitest run tests/integrations/slack-auth.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 7: Write failing Slack adapter test**

Create `tests/integrations/adapters/slack-adapter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SlackAdapter } from '@/integrations/adapters/slack-adapter';
import type { IntegrationsConfig } from '@/schema/types';

const config: IntegrationsConfig = {
  schema_version: 1,
  slack: {
    enabled: true,
    client_channel_prefixes: ['client-', 'acme-'],
    internal_channel_prefixes: ['team-'],
    project_by_channel_prefix: { 'acme-': 'acme' },
    project_by_workspace: { T012AB: 'acme' },
  },
  gmail: { client_domains: ['acme.com'], internal_domains: ['sapienex.com'] },
};

describe('SlackAdapter', () => {
  it('groups channel threads by direction + project', async () => {
    const adapter = new SlackAdapter({
      config,
      workspaceId: 'T012AB',
      fetchActivity: async () => ({
        channelThreads: [
          { channelName: 'acme-dev', threadTs: 'ts1' },
          { channelName: 'acme-design', threadTs: 'ts2' },
          { channelName: 'team-ops', threadTs: 'ts3' },
        ],
        dmThreads: [],
      }),
      isConnected: () => true,
      connect: async () => {},
      disconnect: async () => {},
    });
    const rows = await adapter.fetchDailyDigest('2026-04-15');
    const client = rows.find((r) => r.direction === 'client');
    const internal = rows.find((r) => r.direction === 'internal');
    expect(client?.count).toBe(2);
    expect(client?.suggestedProjectId).toBe('acme');
    expect(internal?.count).toBe(1);
  });

  it('groups DM threads by direction', async () => {
    const adapter = new SlackAdapter({
      config,
      workspaceId: 'T012AB',
      fetchActivity: async () => ({
        channelThreads: [],
        dmThreads: [
          { participantEmails: ['alice@acme.com'], threadTs: 'dm1' },
          { participantEmails: ['bob@sapienex.com'], threadTs: 'dm2' },
        ],
      }),
      isConnected: () => true,
      connect: async () => {},
      disconnect: async () => {},
    });
    const rows = await adapter.fetchDailyDigest('2026-04-15');
    expect(rows.find((r) => r.direction === 'client')?.count).toBe(1);
    expect(rows.find((r) => r.direction === 'internal')?.count).toBe(1);
  });

  it('returns [] when disabled', async () => {
    const adapter = new SlackAdapter({
      config: { schema_version: 1, slack: { enabled: false } },
      workspaceId: 'T012AB',
      fetchActivity: async () => ({ channelThreads: [], dmThreads: [] }),
      isConnected: () => true,
      connect: async () => {},
      disconnect: async () => {},
    });
    expect(await adapter.fetchDailyDigest('2026-04-15')).toEqual([]);
  });
});
```

- [ ] **Step 8: Implement `src/integrations/adapters/slack-adapter.ts`**

```ts
import type { EffortSourceAdapter, DigestRow } from './types';
import type { EffortKind, IntegrationsConfig } from '@/schema/types';
import {
  classifySlackChannelActivity,
  classifySlackDmActivity,
} from '@/integrations/classification/slack';
import { heuristicHoursHundredths, MINUTES_PER_UNIT } from '@/integrations/heuristics';
import type { SlackActivityResult } from '@/integrations/slack/client';

export type SlackAdapterDeps = {
  readonly config: IntegrationsConfig;
  readonly workspaceId: string;
  readonly fetchActivity: (date: string) => Promise<SlackActivityResult>;
  readonly isConnected: () => boolean;
  readonly connect: () => Promise<void>;
  readonly disconnect: () => Promise<void>;
};

type Group = {
  direction: 'client' | 'internal' | 'ambiguous';
  projectId: string | null;
  kind: EffortKind;
  threadIds: string[];
};

export class SlackAdapter implements EffortSourceAdapter {
  readonly source = 'slack' as const;
  private readonly deps: SlackAdapterDeps;

  constructor(deps: SlackAdapterDeps) {
    this.deps = deps;
  }

  isConnected(): boolean {
    return this.deps.isConnected();
  }

  async connect(): Promise<void> {
    await this.deps.connect();
  }

  async disconnect(): Promise<void> {
    await this.deps.disconnect();
  }

  async fetchDailyDigest(date: string): Promise<DigestRow[]> {
    if (!this.deps.isConnected()) return [];
    if (this.deps.config.slack?.enabled === false) return [];
    const activity = await this.deps.fetchActivity(date);
    const groups = new Map<string, Group>();

    for (const ch of activity.channelThreads) {
      const c = classifySlackChannelActivity(
        { channelName: `#${ch.channelName}`, threadTs: ch.threadTs, workspaceId: this.deps.workspaceId },
        this.deps.config,
      );
      const key = `${c.direction}|${c.suggestedProjectId ?? ''}|${c.suggestedKind}`;
      const g = groups.get(key) ?? {
        direction: c.direction,
        projectId: c.suggestedProjectId,
        kind: c.suggestedKind,
        threadIds: [],
      };
      g.threadIds.push(ch.threadTs);
      groups.set(key, g);
    }

    for (const dm of activity.dmThreads) {
      const c = classifySlackDmActivity(
        { participantEmails: dm.participantEmails, threadTs: dm.threadTs, workspaceId: this.deps.workspaceId },
        this.deps.config,
      );
      const key = `${c.direction}|${c.suggestedProjectId ?? ''}|${c.suggestedKind}`;
      const g = groups.get(key) ?? {
        direction: c.direction,
        projectId: c.suggestedProjectId,
        kind: c.suggestedKind,
        threadIds: [],
      };
      g.threadIds.push(dm.threadTs);
      groups.set(key, g);
    }

    const rows: DigestRow[] = [];
    for (const g of groups.values()) {
      const minutesPerUnit =
        g.direction === 'client' ? MINUTES_PER_UNIT.slack.client : MINUTES_PER_UNIT.slack.internal;
      rows.push({
        source: 'slack',
        direction: g.direction,
        count: g.threadIds.length,
        heuristicHoursHundredths: heuristicHoursHundredths(minutesPerUnit, g.threadIds.length),
        suggestedKind: g.kind,
        suggestedProjectId: g.projectId,
        batchId: `daily:${date}:${g.direction}:${this.deps.workspaceId}:${g.projectId ?? 'unmatched'}`,
        items: g.threadIds.map((ts) => ({
          timestamp: date + 'T00:00:00Z',
          label: ts,
          externalId: ts,
        })),
        label: `Slack → ${g.direction === 'client' ? g.projectId ?? 'client' : g.direction} (${g.threadIds.length} threads)`,
      });
    }

    return rows;
  }
}
```

- [ ] **Step 9: Run Slack adapter test**

Run: `npx vitest run tests/integrations/adapters/slack-adapter.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 10: Full suite + commit**

```bash
npm run typecheck && npm run lint && npm test
git add src/integrations/slack/ src/integrations/adapters/slack-adapter.ts \
  tests/integrations/slack-client.test.ts tests/integrations/slack-auth.test.ts \
  tests/integrations/adapters/slack-adapter.test.ts
git commit -m "feat(integrations): SlackAdapter + BYO bot-token auth"
```

---

## Task 8: `enabled-adapters` helper + composition test

**Files:**
- Create: `src/integrations/adapters/enabled-adapters.ts`
- Create: `tests/integrations/adapters/enabled-adapters.test.ts`

- [ ] **Step 1: Write failing composition test**

Create `tests/integrations/adapters/enabled-adapters.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { composeDigest } from '@/integrations/adapters/enabled-adapters';
import type { EffortSourceAdapter } from '@/integrations/adapters/types';

function stubAdapter(source: 'calendar' | 'slack' | 'gmail', rows: unknown[]): EffortSourceAdapter {
  return {
    source,
    isConnected: () => true,
    connect: async () => {},
    disconnect: async () => {},
    fetchDailyDigest: async () => rows as never,
  };
}

describe('composeDigest', () => {
  it('runs adapters in parallel and concatenates their rows', async () => {
    const a = stubAdapter('calendar', [{ source: 'calendar', direction: 'client' }]);
    const b = stubAdapter('slack', [{ source: 'slack', direction: 'client' }]);
    const c = stubAdapter('gmail', [{ source: 'gmail', direction: 'internal' }]);
    const result = await composeDigest([a, b, c], '2026-04-15');
    expect(result.rows).toHaveLength(3);
    expect(result.errors).toEqual([]);
  });

  it('captures per-adapter errors without failing the batch', async () => {
    const good = stubAdapter('calendar', [{ source: 'calendar', direction: 'client' }]);
    const bad: EffortSourceAdapter = {
      source: 'slack',
      isConnected: () => true,
      connect: async () => {},
      disconnect: async () => {},
      fetchDailyDigest: async () => { throw new Error('boom'); },
    };
    const result = await composeDigest([good, bad], '2026-04-15');
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.source).toBe('slack');
  });
});
```

- [ ] **Step 2: Implement `src/integrations/adapters/enabled-adapters.ts`**

```ts
import type { DigestRow, EffortSourceAdapter, SourceKind } from './types';

export type DigestError = { readonly source: SourceKind; readonly message: string };
export type ComposeResult = {
  readonly rows: readonly DigestRow[];
  readonly errors: readonly DigestError[];
};

export async function composeDigest(
  adapters: readonly EffortSourceAdapter[],
  date: string,
): Promise<ComposeResult> {
  const settled = await Promise.allSettled(adapters.map((a) => a.fetchDailyDigest(date)));
  const rows: DigestRow[] = [];
  const errors: DigestError[] = [];
  settled.forEach((r, i) => {
    const source = adapters[i]!.source;
    if (r.status === 'fulfilled') {
      rows.push(...r.value);
    } else {
      errors.push({ source, message: r.reason instanceof Error ? r.reason.message : String(r.reason) });
    }
  });
  return { rows, errors };
}
```

- [ ] **Step 3: Run + commit**

```bash
npx vitest run tests/integrations/adapters/enabled-adapters.test.ts
# expected: 2 PASS
npm run typecheck && npm run lint && npm test
git add src/integrations/adapters/enabled-adapters.ts tests/integrations/adapters/enabled-adapters.test.ts
git commit -m "feat(integrations): composeDigest — parallel adapters with per-source error capture"
```

---

## Task 9: `DigestPanel` UI + per-row Accept flow

**Files:**
- Create: `src/ui/screens/log/DigestPanel.tsx`
- Create: `src/ui/screens/log/DigestRow.tsx`
- Modify: `src/ui/screens/QuickLog.tsx`
- Create: `tests/ui/log/digest-panel-layout.test.ts` (layout/state unit test; no real rendering)

- [ ] **Step 1: Write failing layout unit test**

Create `tests/ui/log/digest-panel-layout.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { groupRowsForDisplay } from '@/ui/screens/log/DigestPanel';
import type { DigestRow } from '@/integrations/adapters/types';

function row(partial: Partial<DigestRow>): DigestRow {
  return {
    source: 'slack',
    direction: 'client',
    count: 1,
    heuristicHoursHundredths: 10,
    suggestedKind: 'slack',
    suggestedProjectId: null,
    batchId: 'b',
    items: [],
    label: 'x',
    ...partial,
  };
}

describe('groupRowsForDisplay', () => {
  it('groups into CLIENT, INTERNAL, AMBIGUOUS', () => {
    const rows = [
      row({ direction: 'client' }),
      row({ direction: 'internal' }),
      row({ direction: 'ambiguous' }),
    ];
    const result = groupRowsForDisplay(rows);
    expect(result.client).toHaveLength(1);
    expect(result.internal).toHaveLength(1);
    expect(result.ambiguous).toHaveLength(1);
  });

  it('within a group, sorts by source order calendar > slack > gmail', () => {
    const rows = [
      row({ direction: 'client', source: 'slack', label: 'slack-x' }),
      row({ direction: 'client', source: 'calendar', label: 'cal-x' }),
      row({ direction: 'client', source: 'gmail', label: 'gmail-x' }),
    ];
    const result = groupRowsForDisplay(rows);
    expect(result.client.map((r) => r.source)).toEqual(['calendar', 'slack', 'gmail']);
  });

  it('within a source, sorts by descending heuristicHoursHundredths', () => {
    const rows = [
      row({ direction: 'client', source: 'slack', heuristicHoursHundredths: 10, label: 'a' }),
      row({ direction: 'client', source: 'slack', heuristicHoursHundredths: 40, label: 'b' }),
    ];
    const result = groupRowsForDisplay(rows);
    expect(result.client[0]?.label).toBe('b');
  });
});
```

- [ ] **Step 2: Implement `src/ui/screens/log/DigestPanel.tsx`** (exports `groupRowsForDisplay` + default-export React component)

```tsx
import { useMemo } from 'react';
import type { DigestRow } from '@/integrations/adapters/types';
import { DigestRowCard } from './DigestRow';

type Grouped = {
  client: DigestRow[];
  internal: DigestRow[];
  ambiguous: DigestRow[];
};

const SOURCE_ORDER: Record<DigestRow['source'], number> = { calendar: 0, slack: 1, gmail: 2 };

export function groupRowsForDisplay(rows: readonly DigestRow[]): Grouped {
  const sorted = [...rows].sort((a, b) => {
    const s = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
    if (s !== 0) return s;
    return b.heuristicHoursHundredths - a.heuristicHoursHundredths;
  });
  return {
    client: sorted.filter((r) => r.direction === 'client'),
    internal: sorted.filter((r) => r.direction === 'internal'),
    ambiguous: sorted.filter((r) => r.direction === 'ambiguous'),
  };
}

export type DigestPanelProps = {
  rows: readonly DigestRow[];
  onAccept: (row: DigestRow, override: { hoursHundredths: number; projectId: string; effortKind: DigestRow['suggestedKind'] }) => Promise<void>;
  projects: Array<{ id: string; name: string }>;
  isLoading: boolean;
};

export default function DigestPanel({ rows, onAccept, projects, isLoading }: DigestPanelProps) {
  const grouped = useMemo(() => groupRowsForDisplay(rows), [rows]);
  if (isLoading) return <div className="text-xs text-slate-500">Loading today's activity…</div>;
  if (rows.length === 0) {
    return <div className="text-xs text-slate-500">No activity captured today.</div>;
  }
  return (
    <div className="space-y-4">
      {grouped.client.length > 0 && (
        <div>
          <div className="text-[10px] font-mono uppercase text-slate-500 mb-1">Client</div>
          {grouped.client.map((r) => (
            <DigestRowCard key={r.batchId} row={r} onAccept={onAccept} projects={projects} />
          ))}
        </div>
      )}
      {grouped.internal.length > 0 && (
        <div>
          <div className="text-[10px] font-mono uppercase text-slate-500 mb-1">Internal</div>
          {grouped.internal.map((r) => (
            <DigestRowCard key={r.batchId} row={r} onAccept={onAccept} projects={projects} />
          ))}
        </div>
      )}
      {grouped.ambiguous.length > 0 && (
        <div>
          <div className="text-[10px] font-mono uppercase text-amber-600 mb-1">
            Ambiguous — pick project + kind
          </div>
          {grouped.ambiguous.map((r) => (
            <DigestRowCard
              key={r.batchId}
              row={r}
              onAccept={onAccept}
              projects={projects}
              requiresProject
              requiresKind
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Implement `src/ui/screens/log/DigestRow.tsx`**

Render a row card with project Select (required if no suggestion), Kind Select (required if ambiguous), editable hours input, Accept button. Disabled Accept when required fields missing. Uses existing Select / Input / Button components.

```tsx
import { useState } from 'react';
import type { DigestRow, DigestRow as DR } from '@/integrations/adapters/types';
import { EffortKindSelect } from '@/ui/components/EffortKindSelect';

export type DigestRowCardProps = {
  row: DR;
  onAccept: (row: DR, override: { hoursHundredths: number; projectId: string; effortKind: DR['suggestedKind'] }) => Promise<void>;
  projects: Array<{ id: string; name: string }>;
  requiresProject?: boolean;
  requiresKind?: boolean;
};

export function DigestRowCard({ row, onAccept, projects, requiresProject, requiresKind }: DigestRowCardProps) {
  const [projectId, setProjectId] = useState<string>(row.suggestedProjectId ?? '');
  const [effortKind, setEffortKind] = useState(row.suggestedKind);
  const [hoursHundredths, setHoursHundredths] = useState(row.heuristicHoursHundredths);
  const [isAccepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = (requiresProject && !projectId) || (requiresKind && !effortKind) || isAccepting;

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);
    try {
      await onAccept(row, { hoursHundredths, projectId, effortKind });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded px-2 py-1.5 mb-1.5 text-xs">
      <div className="flex items-center gap-2 justify-between">
        <span>{row.label}</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            className="w-14 border border-slate-300 px-1 py-0.5 text-right font-mono"
            step={1}
            min={1}
            value={hoursHundredths}
            onChange={(e) => setHoursHundredths(Math.max(1, parseInt(e.target.value || '1', 10)))}
          />
          <span className="text-[10px] font-mono text-slate-400">h/100</span>
          <button
            disabled={disabled}
            onClick={handleAccept}
            className="px-2 py-0.5 border border-slate-300 rounded text-xs disabled:opacity-50"
          >
            {isAccepting ? '…' : 'Accept'}
          </button>
        </div>
      </div>
      {(requiresProject || requiresKind) && (
        <div className="flex items-center gap-2 mt-1">
          {requiresProject && (
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={`border ${!projectId ? 'border-red-400' : 'border-slate-300'} text-xs px-1 py-0.5`}
            >
              <option value="">Pick project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {requiresKind && (
            <EffortKindSelect value={effortKind} onChange={(k) => k && setEffortKind(k)} />
          )}
        </div>
      )}
      {error && <div className="text-[10px] text-red-600 mt-1">{error}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Wire `DigestPanel` into `src/ui/screens/QuickLog.tsx`**

Replace the existing `<SuggestionCard />` mount in the right column with:

```tsx
<DigestPanel
  rows={digest?.rows ?? []}
  isLoading={digestQuery.isLoading}
  projects={projects.data?.projects ?? []}
  onAccept={async (row, override) => {
    const entry = buildEntry({
      date: today,
      projectId: override.projectId,
      bucketId: null,
      hoursHundredths: override.hoursHundredths,
      description: row.label,
      billableStatus: 'non_billable',
      effortKind: override.effortKind,
      effortCount: row.count,
      sourceRef: { kind: row.source === 'calendar' ? 'calendar' : row.source, id: row.batchId },
      rateInfo: resolveRateAtLogTime(...),
    });
    await addEntry(octokit, { owner, repo, entry });
    queryClient.invalidateQueries({ queryKey: qk.monthEntries(month) });
  }}
/>
```

Keep the existing `<SuggestionCard />` rendering inside a collapsed `<details>` labeled "Individual calendar events" for the per-event prefill fallback. Use existing React Query hook to fetch the digest — add `useDailyDigest(date)` in `src/data/hooks/use-daily-digest.ts` wiring `composeDigest` over the enabled adapters.

- [ ] **Step 5: Run full suite + manual smoke**

Run: `npm run typecheck && npm run lint && npm test`
Run: `npm run dev` — open browser, verify digest skeleton shows, Settings shows Integrations section once Task 10 lands.

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/log/DigestPanel.tsx src/ui/screens/log/DigestRow.tsx \
  src/ui/screens/QuickLog.tsx src/data/hooks/use-daily-digest.ts \
  tests/ui/log/digest-panel-layout.test.ts
git commit -m "feat(log): DigestPanel replaces SuggestionCard; per-row Accept"
```

---

## Task 10: Settings Integrations section

**Files:**
- Create: `src/ui/screens/settings/IntegrationsSection.tsx`
- Modify: `src/ui/screens/Settings.tsx`
- Create: `tests/ui/settings/integrations-section.test.ts` (pure logic test; JSON editor validation)

- [ ] **Step 1: Write failing test for config JSON round-trip validation**

Create `tests/ui/settings/integrations-section.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseAndValidateConfigJson } from '@/ui/screens/settings/IntegrationsSection';

describe('parseAndValidateConfigJson', () => {
  it('returns ok + config on valid JSON + valid schema', () => {
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
    if (!r.ok) expect(r.error).toMatch(/schema_version/);
  });
});
```

- [ ] **Step 2: Implement `src/ui/screens/settings/IntegrationsSection.tsx`**

Export `parseAndValidateConfigJson` + React component. The component renders:
- Calendar card (reuses existing calendar connect logic)
- Gmail card — button triggers `requestTokenWithScopes(['calendar.readonly', 'gmail.readonly'])`
- Slack card — modal with [Workspace name] + [Bot token] + "Create the app" link + Save button; Save calls `validateSlackBotToken` and on success stores the session via `storeSlackSession` + reloads page
- JSON editor textarea + Save button; Save calls `saveIntegrationsConfig`

```ts
export function parseAndValidateConfigJson(
  text: string,
): { ok: true; value: IntegrationsConfig } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }
  const v = validateIntegrationsConfig(parsed);
  if (!v.ok) return { ok: false, error: formatValidationErrors(v.errors) };
  return { ok: true, value: v.value };
}
```

(Full component omitted here; follow existing Settings component patterns.)

- [ ] **Step 3: Mount the new section in `Settings.tsx`**

Add a section below the existing calendar one.

- [ ] **Step 4: Run tests + lint + manual smoke**

Run: `npm run typecheck && npm run lint && npm test`
Run: `npm run dev` — verify:
- Integrations section appears below Calendar on Settings
- JSON editor round-trips valid config
- Slack modal opens and validates bot token via auth.test
- Gmail Connect button triggers re-consent

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/settings/IntegrationsSection.tsx src/ui/screens/Settings.tsx \
  tests/ui/settings/integrations-section.test.ts
git commit -m "feat(settings): Integrations section — Slack + Gmail connect + JSON config editor"
```

---

## Task 11: Docs sweep + backlog update

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/architecture/adding-a-field.md` (add v4 → v5 migration note)
- Modify: `docs/architecture/data-flow.md` (add source-integration flow)
- Modify: `docs/architecture/google-calendar-setup.md` (add gmail-scope addendum)
- Create: `docs/architecture/effort-source-integrations.md` (new playbook)
- Modify: `docs/superpowers/backlog.md` — move v0 entry + add deferred items

- [ ] **Step 1: Update `CLAUDE.md`**

- Append to the "Project purpose" spec link list the new spec.
- Add invariant #9: "Every source-generated entry lands via the DigestPanel Accept path — no silent writes."
- Add new "Common tasks" row: "Add a new effort source integration → `docs/architecture/effort-source-integrations.md`"

- [ ] **Step 2: Extend `docs/architecture/adding-a-field.md`**

Append a "v4 → v5 migration (2026-04-15)" section explaining the additive enum widening of `source_ref.kind`, zero hash drift, upgrade-on-write suffix.

- [ ] **Step 3: Extend `docs/architecture/data-flow.md`**

Add "Source integrations flow (v5)" section documenting:
```
User opens Log → DigestPanel mounts → composeDigest(enabledAdapters, today) →
  per-adapter fetchDailyDigest → DigestRow[] → grouped → rendered →
  user clicks Accept → buildEntry → validateEntries → addEntry → queryClient invalidate
```

- [ ] **Step 4: Create `docs/architecture/effort-source-integrations.md`**

Playbook with sections:
1. Overview + adapter interface
2. Adding a new source (step-by-step: API wrapper, classification module, adapter class, Settings card, test set)
3. Integration config schema reference
4. Heuristics table
5. Dedupe + source_ref id shapes per source
6. Cloudflare Worker OAuth swap-in point (for future)

- [ ] **Step 5: Update `docs/architecture/google-calendar-setup.md`**

Add "Extending for Gmail" section: "Add `gmail.readonly` to the existing OAuth consent screen scopes. No new credentials. Consultants get one re-consent prompt."

- [ ] **Step 6: Update `docs/superpowers/backlog.md`**

Move from Near-term → Shipped:
> **Effort source integrations (v1, per-consultant).** EffortSourceAdapter interface; Slack + Gmail + Calendar-extended adapters; DigestPanel on Log screen; `config/integrations.json`; schema v5. Slack uses BYO bot-token.

Add to Near-term:
> - Outlook / Microsoft Graph email adapter (mirrors Gmail pattern)
> - Jira / Linear adapter for ticket activity
> - Zendesk / Intercom adapter for support activity
> - Cloudflare Worker OAuth exchange (replaces Slack BYO bot-token)
> - Slack multi-workspace per consultant
> - Historical backfill tool ("scan last 30 days")
> - First-class form UI for `integrations.json`

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md docs/architecture/ docs/superpowers/backlog.md
git commit -m "docs: effort source integrations — CLAUDE.md + playbooks + backlog"
```

---

## Task 12: Final verification + Gate A dispatch

- [ ] **Step 1: Run the full validation matrix**

```bash
npm run typecheck
npm run lint
npm test
npm run test:golden
npm run test:property
npm run build
```

Expected: all green. March 2026 golden fixture byte-identical.

- [ ] **Step 2: Gate A review**

Per CLAUDE.md, no `src/calc/**` file changed behaviorally in this plan — only the `SourceRef` type widening in `src/schema/types.ts`, which threads through `canonicalizeEntry` without altering its output for any existing entry. The hash-v5 property tests demonstrate this.

Dispatch the `superpowers:code-reviewer` subagent against:
- `src/calc/hash.ts` (read-only review — confirm no behavior change)
- `schemas/entries.schema.json` (v5 widening)
- `src/data/entries-repo.ts` (upgradeEntriesFileToV5)
- `src/schema/validators.ts` (accepts v5; new IntegrationsConfig validator)
- `src/integrations/adapters/*` (new interface + three adapters)

Brief: "Verify March 2026 golden fixture preserved byte-for-byte. Confirm `source_ref.kind` enum widening has zero effect on existing entry canonicalization. Confirm v4 → v5 upgrade chain is additive. Confirm EffortSourceAdapter interface contract is honored by all three concrete adapters."

- [ ] **Step 3: Address Gate A feedback**

Any blocking issues → fix + re-run validation + recommit. Non-blocking nits → fix before merge if low-risk.

- [ ] **Step 4: Finalize**

Per `superpowers:finishing-a-development-branch` skill, present completion options:
1. Merge to main locally
2. Push + create PR
3. Keep branch as-is
4. Discard work

---

## Appendix: Sequencing summary

| Task | Produces | Gate-A sensitive? |
|---|---|---|
| 1 | Schema v5 + writer upgrade + hash-v5 regression | **yes** (hash preservation) |
| 2 | IntegrationsConfig schema + repo module | no |
| 3 | Heuristics + 3 classification modules | no |
| 4 | EffortSourceAdapter interface + types | no |
| 5 | Calendar adapter refactor | no (behavior preserved) |
| 6 | Gmail adapter + API + scope extension | no |
| 7 | Slack adapter + API + BYO auth | no |
| 8 | composeDigest helper | no |
| 9 | DigestPanel + DigestRow UI + QuickLog wiring | no |
| 10 | Settings Integrations section | no |
| 11 | Docs sweep + backlog | no |
| 12 | Full verification + Gate A + finalization | **yes** (final sign-off) |
