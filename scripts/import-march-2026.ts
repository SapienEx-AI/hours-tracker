#!/usr/bin/env -S npx tsx
/**
 * One-time March 2026 importer. Reads scripts/march-2026-source.md
 * (the raw Apple Notes content), parses each non-blank line into an Entry,
 * and writes tests/fixtures/2026-03-golden.json.
 *
 * Line formats in the source (heuristic, tolerant to noise):
 *   <Project> - <Month Day> - <N>(hr| hr) - <description>
 *   <Project> - <Month Day> - <N>hr (<annotation>) - <description>
 *   <Project> - <Month Day> (<annotation>) - <N> hr - <description>
 *
 * Annotations:
 *   (not billing)   → billable_status: non_billable
 *   (not billing?)  → billable_status: needs_review (review_flag: true)
 *   (billing?)      → billable_status: needs_review (review_flag: true)
 *   (at $N hourly rate) → rate_cents override, rate_source = entry_override
 *   no annotation   → billable_status: billable
 *
 * Usage:
 *   npm run import:march
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';

import type {
  Entry,
  EntriesFile,
  BillableStatus,
  RateSource,
} from '../src/schema/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, 'march-2026-source.md');
const OUT_DIR = join(HERE, '..', 'tests', 'fixtures');
const OUT = join(OUT_DIR, '2026-03-golden.json');
const IMPORT_TS = '2026-04-11T00:00:00Z';
const GLOBAL_RATE_CENTS = 12500; // Spec §13 — $125 CAD/hr from 2026-04-11.

// Slug normalization. Any unknown project throws — no silent fallback.
const SLUGS: Record<string, string> = {
  internal: 'internal',
  sprosty: 'sprosty',
  shannex: 'shannex',
  axiom: 'axiom',
  bayard: 'bayard',
  truvista: 'truvista',
  pickleplex: 'pickleplex',
  'sparc bc': 'sparc-bc',
  sparcbc: 'sparc-bc',
  sterling: 'sterling',
  'tech lead': 'tech-lead',
  bluejlegal: 'bluej-legal',
  'pre-sales': 'pre-sales',
  imagelift: 'image-lift',
};

const MONTH_NAMES: Record<string, string> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
};

function slugify(projectRaw: string): string {
  const key = projectRaw.trim().toLowerCase();
  const slug = SLUGS[key];
  if (!slug) throw new Error(`Unknown project: "${projectRaw}"`);
  return slug;
}

function parseDate(text: string): string {
  const m = text.trim().match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  if (!m) throw new Error(`Bad date: "${text}"`);
  const mName = m[1]?.toLowerCase();
  const day = m[2];
  if (!mName || !day) throw new Error(`Bad date parts: "${text}"`);
  const month = MONTH_NAMES[mName];
  if (!month) throw new Error(`Bad month: "${m[1] ?? ''}"`);
  return `2026-${month}-${day.padStart(2, '0')}`;
}

function parseHours(text: string): number {
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*hr/);
  if (!m || !m[1]) throw new Error(`Bad hours: "${text}"`);
  return Math.round(parseFloat(m[1]) * 100);
}

type Annotations = {
  billable: BillableStatus;
  rateOverride: number | null;
  cleanedDescription: string;
  reviewFlag: boolean;
};

function extractAnnotations(line: string): Annotations {
  let billable: BillableStatus = 'billable';
  let rateOverride: number | null = null;
  let reviewFlag = false;
  let cleaned = line;

  const rateMatch = cleaned.match(/\(at\s+\$(\d+(?:\.\d+)?)\s+hourly rate\)/i);
  if (rateMatch && rateMatch[1]) {
    rateOverride = Math.round(parseFloat(rateMatch[1]) * 100);
    cleaned = cleaned.replace(rateMatch[0], '').trim();
  }

  if (/\(not billing\?\)/i.test(cleaned) || /\(billing\?\)/i.test(cleaned)) {
    billable = 'needs_review';
    reviewFlag = true;
    cleaned = cleaned.replace(/\((?:not\s+)?billing\?\)/gi, '').trim();
  } else if (/\(not billing\)/i.test(cleaned)) {
    billable = 'non_billable';
    cleaned = cleaned.replace(/\(not billing\)/gi, '').trim();
  }

  return { billable, rateOverride, cleanedDescription: cleaned, reviewFlag };
}

function newId(date: string, projectSlug: string): string {
  return `${date}-${projectSlug}-${randomBytes(3).toString('hex')}`;
}

/**
 * Find the hours segment in the parts array — the one matching /\d+(\.\d+)?\s*hr/.
 * Returns the index or -1 if not found.
 */
function findHoursIndex(parts: string[]): number {
  return parts.findIndex((p) => /\d+(?:\.\d+)?\s*hr/.test(p));
}

function parseLine(line: string): Entry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+-\s+/);
  if (parts.length < 3) {
    throw new Error(`Cannot parse (need >= 3 parts): "${trimmed}"`);
  }

  const projectRaw = parts[0];
  if (!projectRaw) throw new Error(`Missing project: "${trimmed}"`);
  const projectSlug = slugify(projectRaw);

  const hoursIdx = findHoursIndex(parts);
  if (hoursIdx < 0) throw new Error(`No hours segment: "${trimmed}"`);

  // Date is parts[1] with any annotation stripped.
  const rawDateSegment = parts[1];
  if (!rawDateSegment) throw new Error(`Missing date segment: "${trimmed}"`);
  const rawDate = rawDateSegment.replace(/\([^)]*\)/g, '').trim();
  const date = parseDate(rawDate);

  const hoursSegment = parts[hoursIdx];
  if (!hoursSegment) throw new Error(`Missing hours segment: "${trimmed}"`);
  const hours = parseHours(hoursSegment);

  // Description is everything after hoursIdx joined with " - ".
  const descParts = parts.slice(hoursIdx + 1);
  const rawDesc = descParts.join(' - ');

  // Pull annotations from the full line — annotations can live in the date,
  // hours, or description segment depending on how the user wrote the line.
  const annotationSource = [rawDateSegment, hoursSegment, rawDesc].join(' ');
  const annotations = extractAnnotations(annotationSource);

  // Description: the raw description minus any annotation markers, collapsed.
  const descClean = rawDesc
    .replace(/\(not billing\?\)/gi, '')
    .replace(/\(billing\?\)/gi, '')
    .replace(/\(not billing\)/gi, '')
    .replace(/\(at\s+\$\d+(?:\.\d+)?\s+hourly rate\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const rateCents =
    annotations.billable === 'non_billable'
      ? 0
      : (annotations.rateOverride ?? GLOBAL_RATE_CENTS);
  const rateSource: RateSource =
    annotations.rateOverride !== null ? 'entry_override' : 'global_default';

  return {
    id: newId(date, projectSlug),
    project: projectSlug,
    date,
    hours_hundredths: hours,
    rate_cents: rateCents,
    rate_source: rateSource,
    billable_status: annotations.billable,
    bucket_id: null,
    description: descClean || '(no description)',
    review_flag: annotations.reviewFlag,
    created_at: IMPORT_TS,
    updated_at: IMPORT_TS,
    source_ref: null,
    effort: [],
  };
}

function main(): void {
  const source = readFileSync(SOURCE, 'utf8');
  const lines = source.split('\n');
  const entries: Entry[] = [];
  const errors: Array<{ line: number; msg: string; text: string }> = [];

  lines.forEach((line, i) => {
    if (!line.trim()) return;
    try {
      const e = parseLine(line);
      if (e) entries.push(e);
    } catch (err) {
      errors.push({ line: i + 1, msg: (err as Error).message, text: line });
    }
  });

  if (errors.length > 0) {
    console.error(`\n${errors.length} parse errors:`);
    for (const e of errors) {
      console.error(`  line ${e.line}: ${e.msg}\n    > ${e.text}`);
    }
    process.exit(1);
  }

  // Sort by (date, id) so output order is deterministic and diffable.
  entries.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.id.localeCompare(b.id);
  });

  const file: EntriesFile = {
    schema_version: 1,
    month: '2026-03',
    entries,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT, JSON.stringify(file, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${entries.length} entries to ${OUT}`);

  // Emit content hash so future re-runs can detect drift.
  const hash = createHash('sha256').update(JSON.stringify(entries)).digest('hex');
  console.log(`Content sha256: ${hash}`);
}

main();
