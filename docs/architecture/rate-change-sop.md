# Changing your default rate

Rates are append-only. You add a new `default_rate_history` entry; old entries stay untouched.

## Forward-only (the normal case)

1. Open the Rates screen.
2. Click "Add rate".
3. Enter new rate (dollars), effective date (today or a future date), optional note.
4. Save. A commit is written with message `config: add rate $X.XX effective YYYY-MM-DD`.

From the effective date onward, new entries use the new rate as their default. Historical entries are unaffected — their `rate_cents` is snapshotted at log time.

## Retroactive (rare — requires explicit intent)

When you need to retroactively apply a new rate to entries that have already been logged (e.g., a client agreed to pay a higher rate in arrears):

**MVP manual process:**
1. Open the Entries screen, filter to the affected entries.
2. For each entry, delete and re-add with the new rate. Tedious but auditable — each change is a separate commit.

**Post-MVP: Bulk edit tool** (spec §7 row 9)
- UI provides a filter + preview + confirm flow.
- Single commit with message `bulk-edit: apply $X.XX rate to N entries matching {filter}`.

**One-off script approach** (advanced):
- Write a script in `scripts/one-off/<date>-<description>.ts` that:
  1. Reads the current month file(s)
  2. Applies the transformation (filter + rate change)
  3. Validates against schema
  4. Commits with descriptive message
  5. Leaves a comment at the top of the script explaining the one-off nature

## Do NOT

- Edit the `rate_cents` field on historical entries without a descriptive commit message.
- Bypass schema validation.
- Remove entries from `default_rate_history` — the history is append-only.
- Modify a closed month's entries without accepting that the snapshot drift indicator will fire (and deciding what to do about it).

## Checklist

- [ ] Decided: forward-only or retroactive?
- [ ] If retroactive: documented the reason in commit message
- [ ] Ran `npm test` after the change — all pass
- [ ] If retroactive affected a closed month, noted the drift in the Snapshots view
