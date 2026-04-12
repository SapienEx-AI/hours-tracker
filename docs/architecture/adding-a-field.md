# Adding a new field to a schema

Any new field on `Entry`, `Project`, `Bucket`, `Partner`, `Profile`, `RatesConfig`, or `Snapshot` is a **schema bump**. This is a reviewed event — don't sneak it in.

## Steps

1. **Bump `schema_version`** in the relevant `schemas/*.json`. Change `"const": 1` to `"const": 2`. Add the new field to `required` if appropriate, or `properties` if optional.
2. **Update `src/schema/types.ts`** to match. Add the field to the relevant TypeScript type.
3. **Update the matching validator test** in `tests/schema/validators.test.ts` if the field has constraints beyond type (e.g., min/max, format).
4. **Update calc code** if the new field affects billing. Add unit + property tests.
5. **Update `src/calc/hash.ts`** if the field is part of the semantic content of an entry. Add it to the emitted-key list in `canonicalizeEntry` in a fixed position. **This will change existing hashes.** Document as a one-time migration below.
6. **Update the relevant UI screen** to surface/edit the new field.
7. **Update `src/data/commit-messages.ts`** if the field appears in a commit message.
8. **Write a migration note** below in this file.
9. **Run the full test suite.** All 108+ tests must pass.
10. **Bump `version` in `package.json`.** Patch bump for additive optional field; minor for required new field.

## Hash-drift consequences

Adding a field to `canonicalizeEntry` changes EVERY existing entry's hash, which means EVERY existing snapshot's `source_hash` will no longer match its entries file — universal drift. This is intentional per `src/calc/hash.ts` comments but requires user communication.

**Mitigation options when bumping hash-contributing fields:**
- **Accept the drift:** inform the user, let the drift indicator light up on every historical month. Fine for rare bumps.
- **Rehash closed snapshots:** write a one-off script in `scripts/one-off/<date>-rehash-snapshots.ts` that recomputes `source_hash` for every snapshot and rewrites them (explicit, committed with reason).
- **Scope the drift:** add a `hash_schema_version` field to snapshots and have the drift detector compare only entries with matching versions.

Pick one explicitly and document it in the migration note below.

## Checklist

- [ ] `schema_version` bumped in JSON schema
- [ ] `src/schema/types.ts` updated
- [ ] Validator test updated
- [ ] Calc code updated (if relevant)
- [ ] Hash emission updated (if field is semantic)
- [ ] UI surface updated
- [ ] Commit message helper updated (if relevant)
- [ ] Migration note written below
- [ ] Full `npm test` passes
- [ ] `package.json` version bumped

## Migrations

*(none yet — MVP is at schema_version 1)*
