import type { CalendarEvent } from './provider';

export type FormStatePrefill = {
  date: string;
  hours_hundredths: number;
  description: string;
  source_event_id: string;
  start_label: string;
  end_label: string;
};

const ROUND_MIN = 15;

function userDeclined(ev: CalendarEvent): boolean {
  const self = ev.attendees?.find((a) => a.self);
  return self?.responseStatus === 'declined';
}

function isAllDay(ev: CalendarEvent): boolean {
  return !ev.start.dateTime || !ev.end.dateTime;
}

function roundUpToStep(minutes: number, step: number): number {
  // Round UP (ceiling) to the nearest step. Meetings tend to run slightly over,
  // and rounding down would hide a real 7-min meeting entirely. Enforces a
  // minimum of one step so any nonzero-duration event produces a suggestion.
  if (minutes <= 0) return 0;
  return Math.max(step, Math.ceil(minutes / step) * step);
}

function localMidnightAfter(dateStr: string): number {
  // dateStr is YYYY-MM-DD in the browser's local timezone.
  const [y, m, d] = dateStr.split('-').map((s) => parseInt(s, 10));
  const nextDay = new Date(y ?? 0, (m ?? 1) - 1, (d ?? 0) + 1, 0, 0, 0, 0);
  return nextDay.getTime();
}

function formatHm(date: Date): string {
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

export function eventToFormState(
  event: CalendarEvent,
  selectedDate: string,
): FormStatePrefill | null {
  if (userDeclined(event)) return null;
  if (isAllDay(event)) return null;
  const startMs = Date.parse(event.start.dateTime!);
  const endMsRaw = Date.parse(event.end.dateTime!);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMsRaw)) return null;

  const midnightMs = localMidnightAfter(selectedDate);
  const endMs = Math.min(endMsRaw, midnightMs);
  if (endMs <= startMs) return null;

  const durationMin = (endMs - startMs) / 60_000;
  const roundedMin = roundUpToStep(durationMin, ROUND_MIN);
  if (roundedMin <= 0) return null;

  // roundedMin is a multiple of 15, so (roundedMin * 100 / 60) is an integer.
  const hours_hundredths = Math.round((roundedMin * 100) / 60);

  return {
    date: selectedDate,
    hours_hundredths,
    description: event.summary ?? '',
    source_event_id: event.id,
    start_label: formatHm(new Date(startMs)),
    end_label: formatHm(new Date(endMs)),
  };
}
