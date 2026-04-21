import Ajv, { type ValidateFunction, type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';

import partnerSchema from '../../schemas/partner.schema.json';
import profileSchema from '../../schemas/profile.schema.json';
import ratesSchema from '../../schemas/rates.schema.json';
import projectsSchema from '../../schemas/projects.schema.json';
import entriesSchema from '../../schemas/entries.schema.json';
import snapshotSchema from '../../schemas/snapshot.schema.json';
import calendarConfigSchema from '../../schemas/calendar-config.schema.json';
import integrationsSchema from '../../schemas/integrations.schema.json';

import type {
  Partner,
  Profile,
  RatesConfig,
  ProjectsConfig,
  EntriesFile,
  Entry,
  EffortItem,
  EffortKind,
  Snapshot,
  CalendarConfig,
  IntegrationsConfig,
} from './types';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const _partner = ajv.compile<Partner>(partnerSchema);
const _profile = ajv.compile<Profile>(profileSchema);
const _rates = ajv.compile<RatesConfig>(ratesSchema);
const _projects = ajv.compile<ProjectsConfig>(projectsSchema);
const _entries = ajv.compile<EntriesFile>(entriesSchema);
const _snapshot = ajv.compile<Snapshot>(snapshotSchema);
const _calendarConfig = ajv.compile<CalendarConfig>(calendarConfigSchema);
const _integrations = ajv.compile<IntegrationsConfig>(integrationsSchema);

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ErrorObject[] };

function wrap<T>(fn: ValidateFunction<T>) {
  return (data: unknown): ValidationResult<T> => {
    if (fn(data)) return { ok: true, value: data as T };
    return { ok: false, errors: fn.errors ?? [] };
  };
}

export const validatePartner = wrap<Partner>(_partner);
export const validateProfile = wrap<Profile>(_profile);
export const validateRates = wrap<RatesConfig>(_rates);
export const validateProjects = wrap<ProjectsConfig>(_projects);
export const validateSnapshot = wrap<Snapshot>(_snapshot);
export const validateCalendarConfig = wrap<CalendarConfig>(_calendarConfig);
export const validateIntegrationsConfig = wrap<IntegrationsConfig>(_integrations);

/**
 * Validate an entries file. Accepts v1 / v2 / v3 / v4 / v5 on the wire; the
 * returned value always has v5 shape. New in v5: source_ref.kind may be
 * 'slack' or 'gmail' in addition to 'calendar' and 'timer'.
 *
 * NOTE: returns a *deep clone* of the input with the v5 shape applied.
 * The caller's original object is never mutated.
 */
/**
 * Strip `source_event_id` from any entry that also has `source_ref`.
 * This pattern is corruption from a pre-fix broken writer; self-healing on
 * read lets those files load, and the next write lands a clean file via
 * the fixed upgrade chain.
 */
function stripCorruptedLegacyField(data: unknown): void {
  if (typeof data !== 'object' || data === null) return;
  const entries = (data as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) return;
  for (const e of entries as Array<Record<string, unknown>>) {
    if ('source_event_id' in e && 'source_ref' in e) {
      delete e.source_event_id;
    }
  }
}

/**
 * Lift legacy `source_event_id` into `source_ref` on entries that don't
 * already have `source_ref`. v1/v2 files always take this path; v3 files
 * generally already have source_ref.
 */
function liftLegacyFieldToSourceRef(file: EntriesFile): void {
  for (const e of file.entries) {
    const anyE = e as Entry & { source_event_id?: string | null };
    if ('source_ref' in e) continue;
    const legacyId = anyE.source_event_id;
    (e as Entry).source_ref =
      legacyId === undefined || legacyId === null
        ? null
        : { kind: 'calendar', id: legacyId };
    delete anyE.source_event_id;
  }
}

/**
 * Collapse duplicate kinds (sum counts) and sort by kind for determinism.
 * Exported so `upgradeEntriesFileToV6` and writer probes can share the
 * normalizer (defense-in-depth per spec §3.2).
 */
export function collapseAndSortEffort(items: EffortItem[]): EffortItem[] {
  const byKind = new Map<EffortKind, number>();
  for (const it of items) {
    byKind.set(it.kind, (byKind.get(it.kind) ?? 0) + it.count);
  }
  return [...byKind.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => a.kind.localeCompare(b.kind));
}

/**
 * Lift legacy `effort_kind` + `effort_count` scalars into the v6 `effort`
 * array, then strip the legacy fields. Applies to every entry regardless
 * of schema_version on disk (v1-v5 all lack `effort`, v5 has scalars).
 * Also collapses duplicate kinds and sorts by kind for stable hashing.
 */
function liftEffortToArray(file: EntriesFile): void {
  for (const e of file.entries) {
    const anyE = e as Entry & {
      effort_kind?: EffortKind | null;
      effort_count?: number | null;
    };
    let effort: EffortItem[] = Array.isArray((e as Entry).effort)
      ? [...(e as Entry).effort]
      : [];
    if (effort.length === 0) {
      const k = anyE.effort_kind;
      const c = anyE.effort_count;
      if (k !== null && k !== undefined && c !== null && c !== undefined) {
        effort = [{ kind: k, count: c }];
      }
    }
    delete anyE.effort_kind;
    delete anyE.effort_count;
    (e as Entry).effort = collapseAndSortEffort(effort);
  }
}

export const validateEntries = (data: unknown): ValidationResult<EntriesFile> => {
  // Clone FIRST — never mutate the caller's input.
  const cloned = structuredClone(data) as unknown;
  stripCorruptedLegacyField(cloned);
  if (!_entries(cloned)) return { ok: false, errors: _entries.errors ?? [] };
  const file = cloned as EntriesFile;
  liftLegacyFieldToSourceRef(file);
  liftEffortToArray(file);
  return { ok: true, value: file };
};

export function formatValidationErrors(errors: ErrorObject[]): string {
  return errors.map((e) => `  ${e.instancePath || '(root)'} ${e.message ?? ''}`).join('\n');
}
