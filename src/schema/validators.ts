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
 * Validate an entries file. Accepts v1 / v2 / v3 on the wire; the returned
 * value always has v3 shape (every entry carries `source_ref`, never the
 * legacy `source_event_id`).
 *
 * NOTE: returns a *deep clone* of the input with the v3 shape applied.
 * The caller's original object is never mutated, so a diagnostic logger
 * holding the parsed JSON sees exactly what came off disk.
 */
/**
 * Strip `source_event_id` from any entry that also has `source_ref`.
 * This pattern is corruption from a pre-fix broken writer; self-healing on
 * read lets those files load, and the next write lands a clean file via
 * the fixed upgradeEntriesFileToV3.
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

export const validateEntries = (data: unknown): ValidationResult<EntriesFile> => {
  // Clone FIRST — never mutate the caller's input.
  const cloned = structuredClone(data) as unknown;
  stripCorruptedLegacyField(cloned);
  if (!_entries(cloned)) return { ok: false, errors: _entries.errors ?? [] };
  const file = cloned as EntriesFile;
  liftLegacyFieldToSourceRef(file);
  return { ok: true, value: file };
};

export function formatValidationErrors(errors: ErrorObject[]): string {
  return errors.map((e) => `  ${e.instancePath || '(root)'} ${e.message ?? ''}`).join('\n');
}
