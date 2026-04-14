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
export const validateEntries = (data: unknown): ValidationResult<EntriesFile> => {
  if (!_entries(data)) return { ok: false, errors: _entries.errors ?? [] };
  // Clone before mutating. EntriesFile is pure JSON so structuredClone is safe.
  const file = structuredClone(data) as EntriesFile;

  // v3 files must not carry the legacy source_event_id field.
  if (file.schema_version === 3) {
    for (let i = 0; i < file.entries.length; i++) {
      const e = file.entries[i] as Entry & { source_event_id?: string | null };
      if ('source_event_id' in e) {
        return {
          ok: false,
          errors: [
            {
              instancePath: `/entries/${i}/source_event_id`,
              schemaPath: '#/properties/entries/items/properties/source_event_id',
              keyword: 'deprecated',
              params: {},
              message:
                'schema_version 3 entries must not carry legacy source_event_id; use source_ref',
            },
          ],
        };
      }
    }
  }

  // Backfill source_ref from legacy versions so downstream code only sees v3 shape.
  for (const e of file.entries) {
    const anyE = e as Entry & { source_event_id?: string | null };
    if (!('source_ref' in e)) {
      const legacyId = anyE.source_event_id;
      if (legacyId === undefined || legacyId === null) {
        (e as Entry).source_ref = null;
      } else {
        (e as Entry).source_ref = { kind: 'calendar', id: legacyId };
      }
      delete anyE.source_event_id;
    }
  }
  return { ok: true, value: file };
};

export function formatValidationErrors(errors: ErrorObject[]): string {
  return errors.map((e) => `  ${e.instancePath || '(root)'} ${e.message ?? ''}`).join('\n');
}
