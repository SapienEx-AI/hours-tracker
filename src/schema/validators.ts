import Ajv, { type ValidateFunction, type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';

import partnerSchema from '../../schemas/partner.schema.json';
import profileSchema from '../../schemas/profile.schema.json';
import ratesSchema from '../../schemas/rates.schema.json';
import projectsSchema from '../../schemas/projects.schema.json';
import entriesSchema from '../../schemas/entries.schema.json';
import snapshotSchema from '../../schemas/snapshot.schema.json';
import calendarConfigSchema from '../../schemas/calendar-config.schema.json';

import type {
  Partner,
  Profile,
  RatesConfig,
  ProjectsConfig,
  EntriesFile,
  Entry,
  Snapshot,
  CalendarConfig,
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
 * Enforce the effort cross-field rule: `effort_kind` and `effort_count` must
 * both be null or both be set. Returns null if clean, else an ErrorObject.
 */
function checkEffortCrossField(file: EntriesFile): ErrorObject | null {
  for (let i = 0; i < file.entries.length; i++) {
    const e = file.entries[i]!;
    const kNull = e.effort_kind === null || e.effort_kind === undefined;
    const cNull = e.effort_count === null || e.effort_count === undefined;
    if (kNull !== cNull) {
      return {
        instancePath: `/entries/${i}`,
        schemaPath: '#/properties/entries/items',
        keyword: 'cross-field',
        params: {},
        message: 'effort_kind and effort_count must both be null or both set',
      };
    }
  }
  return null;
}

/**
 * Backfill effort_kind / effort_count to null on entries that lack them.
 * Pre-v4 files never had these fields; after this pass the in-memory file
 * is always v4 shape regardless of on-disk version.
 */
function backfillEffortFields(file: EntriesFile): void {
  for (const e of file.entries) {
    if (!('effort_kind' in e)) (e as Entry).effort_kind = null;
    if (!('effort_count' in e)) (e as Entry).effort_count = null;
  }
}

export const validateEntries = (data: unknown): ValidationResult<EntriesFile> => {
  // Clone FIRST — never mutate the caller's input.
  const cloned = structuredClone(data) as unknown;
  stripCorruptedLegacyField(cloned);
  if (!_entries(cloned)) return { ok: false, errors: _entries.errors ?? [] };
  const file = cloned as EntriesFile;
  liftLegacyFieldToSourceRef(file);
  const crossErr = checkEffortCrossField(file);
  if (crossErr !== null) return { ok: false, errors: [crossErr] };
  backfillEffortFields(file);
  return { ok: true, value: file };
};

export function formatValidationErrors(errors: ErrorObject[]): string {
  return errors.map((e) => `  ${e.instancePath || '(root)'} ${e.message ?? ''}`).join('\n');
}
