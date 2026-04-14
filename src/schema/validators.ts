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

export const validateEntries = (data: unknown): ValidationResult<EntriesFile> => {
  if (!_entries(data)) return { ok: false, errors: _entries.errors ?? [] };
  const file = data as EntriesFile;
  for (const e of file.entries) {
    if (!('source_event_id' in e)) {
      (e as Entry).source_event_id = null;
    }
  }
  return { ok: true, value: file };
};

export function formatValidationErrors(errors: ErrorObject[]): string {
  return errors.map((e) => `  ${e.instancePath || '(root)'} ${e.message ?? ''}`).join('\n');
}
