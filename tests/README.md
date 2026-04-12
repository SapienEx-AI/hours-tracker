# Tests

Test categories:

- `tests/calc/unit.test.ts` — hand-crafted inputs, one test per public `src/calc` function.
- `tests/calc/property.test.ts` — fast-check invariants from spec §7.2 layer 2.
- `tests/calc/golden.test.ts` — March 2026 real-data golden fixture, spec §7.2 layer 3.
- `tests/integration/*.test.ts` — module-boundary tests (Octokit mocked).

**Test-as-documentation rules (spec §15.4):**
- Every test name is a full sentence describing observable behavior.
- No shared mutable fixtures.
- No mocks for the calc module. Only mock at the Octokit boundary.
- Property tests use the exact invariant names from spec §7.2 as descriptions.
