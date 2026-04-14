import type { Octokit } from '@octokit/rest';
import type { CalendarConfig } from '@/schema/types';
import { validateCalendarConfig, formatValidationErrors } from '@/schema/validators';
import { readJsonFile, writeJsonFile, FileNotFoundError } from './github-file';
import { calendarConfigMessage } from './commit-messages';

const CONFIG_PATH = 'config/calendar.json';

export async function loadCalendarConfig(
  octokit: Octokit,
  args: { owner: string; repo: string },
): Promise<CalendarConfig | null> {
  try {
    const read = await readJsonFile<CalendarConfig>(octokit, {
      owner: args.owner,
      repo: args.repo,
      path: CONFIG_PATH,
    });
    const v = validateCalendarConfig(read.data);
    if (!v.ok) {
      throw new Error(`calendar.json failed validation:\n${formatValidationErrors(v.errors)}`);
    }
    return v.value;
  } catch (e) {
    if (e instanceof FileNotFoundError) return null;
    throw e;
  }
}

export async function writeCalendarConfig(
  octokit: Octokit,
  args: {
    owner: string;
    repo: string;
    config: CalendarConfig;
    action: 'connect' | 'disconnect' | 'update';
  },
): Promise<void> {
  const v = validateCalendarConfig(args.config);
  if (!v.ok) {
    throw new Error(`calendar config failed validation:\n${formatValidationErrors(v.errors)}`);
  }
  await writeJsonFile(octokit, {
    owner: args.owner,
    repo: args.repo,
    path: CONFIG_PATH,
    content: args.config,
    message: calendarConfigMessage(args.action),
  });
}
