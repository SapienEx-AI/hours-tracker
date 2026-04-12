# src/schema

**Purpose:** TypeScript types + ajv validators for every JSON file read or written by the app.

**Public API:**
- `types.ts` — in-memory types mirroring every JSON schema
- `validators.ts` — compiled ajv validators, one per schema

**Invariants:**
1. Types in `types.ts` must match `/schemas/*.json` exactly.
2. Every write must pass through the matching validator (spec §11 guard 1).
3. Schema bumps are a reviewed event (spec §15.5 `adding-a-field.md`).

**Dependencies:** `ajv`, `ajv-formats`. Nothing else.
