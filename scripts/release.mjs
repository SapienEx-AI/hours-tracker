#!/usr/bin/env node
/**
 * Bump the app version and append a release entry to public/version.json.
 *
 * Usage:
 *   node scripts/release.mjs                          (patch bump, summary required)
 *   node scripts/release.mjs patch "short summary"
 *   node scripts/release.mjs minor "short summary"
 *   node scripts/release.mjs major "short summary"
 *
 * Run BEFORE pushing to main. Commit the resulting version.json change
 * alongside the rest of the release payload.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERSION_PATH = join(HERE, '..', 'public', 'version.json');

const [bumpRaw, ...summaryParts] = process.argv.slice(2);
const bump = bumpRaw ?? 'patch';
const summary = summaryParts.join(' ').trim();

if (!['major', 'minor', 'patch'].includes(bump)) {
  console.error(`Unknown bump: ${bump}. Use major|minor|patch.`);
  process.exit(1);
}
if (!summary) {
  console.error('Summary required. Usage: node scripts/release.mjs <major|minor|patch> "summary"');
  process.exit(1);
}

const raw = readFileSync(VERSION_PATH, 'utf8');
const v = JSON.parse(raw);

const [maj, min, pat] = v.app.version.split('.').map(Number);
const next =
  bump === 'major' ? `${maj + 1}.0.0` :
  bump === 'minor' ? `${maj}.${min + 1}.0` :
  `${maj}.${min}.${pat + 1}`;

const commit = execSync('git rev-parse --short HEAD').toString().trim();
const lastCommit = v.releases[0]?.commit;

let changes = [];
if (lastCommit) {
  const out = execSync(`git log --pretty=format:"%s" ${lastCommit}..HEAD`).toString().trim();
  if (out) changes = out.split('\n').filter((line) => line && !line.startsWith('release:'));
}

if (changes.length === 0) {
  console.error('No new commits since last release. Aborting.');
  process.exit(1);
}

const releasedAt = new Date().toISOString().slice(0, 10);

v.app.version = next;
v.releases.unshift({
  version: next,
  released_at: releasedAt,
  commit,
  summary,
  changes: changes.slice(0, 40),
});

writeFileSync(VERSION_PATH, JSON.stringify(v, null, 2) + '\n');

console.log(`Bumped to v${next} (from v${maj}.${min}.${pat})`);
console.log(`Captured ${changes.length} commits since ${lastCommit}`);
console.log('');
console.log('Next:');
console.log(`  git add public/version.json`);
console.log(`  git commit -m "release: v${next} — ${summary}"`);
console.log(`  git push`);
