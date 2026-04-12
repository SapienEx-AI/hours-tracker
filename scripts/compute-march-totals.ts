/**
 * One-shot helper: run computeMonthTotals against the March 2026 golden
 * fixture with the full project list from spec §13 and the global rate
 * from spec §13. Prints the totals JSON for hand-verification.
 *
 * This file is ALSO reused at test time as the source of the expected
 * fixture — see tests/calc/golden-full.test.ts.
 *
 * Usage: npx tsx scripts/compute-march-totals.ts
 */
import { readFileSync } from 'node:fs';
import { computeMonthTotals } from '../src/calc';
import type {
  EntriesFile,
  ProjectsConfig,
  RatesConfig,
} from '../src/schema/types';

const golden = JSON.parse(
  readFileSync('tests/fixtures/2026-03-golden.json', 'utf8'),
) as EntriesFile;

export const MARCH_PROJECTS: ProjectsConfig = {
  schema_version: 1,
  projects: [
    { id: 'sprosty', name: 'Sprosty', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] },
    { id: 'internal', name: 'Internal', client: null, active: true, is_internal: true, default_rate_cents: null, buckets: [] },
    { id: 'shannex', name: 'Shannex', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] },
    { id: 'axiom', name: 'Axiom', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] },
    { id: 'bayard', name: 'Bayard', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] },
    { id: 'truvista', name: 'TruVista', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] },
    { id: 'pickleplex', name: 'Pickleplex', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] },
    { id: 'sparc-bc', name: 'Sparc BC', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] },
    { id: 'sterling', name: 'Sterling', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] },
    { id: 'tech-lead', name: 'Tech Lead', client: null, active: true, is_internal: true, default_rate_cents: null, buckets: [] },
    { id: 'bluej-legal', name: 'BlueJ Legal', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] },
    { id: 'pre-sales', name: 'Pre-sales', client: null, active: true, is_internal: true, default_rate_cents: null, buckets: [] },
    { id: 'image-lift', name: 'ImageLift', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] },
  ],
};

export const MARCH_RATES: RatesConfig = {
  schema_version: 1,
  default_rate_history: [{ effective_from: '2026-01-01', rate_cents: 12500 }],
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = computeMonthTotals(
    { entries: golden.entries, projects: MARCH_PROJECTS, rates: MARCH_RATES },
    '2026-03',
  );
  console.log(JSON.stringify(result, null, 2));
}
