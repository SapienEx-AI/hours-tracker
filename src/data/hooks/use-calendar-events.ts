import { useQuery } from '@tanstack/react-query';
import { useMonthEntries } from './use-month-entries';
import { useCalendarConfig } from './use-calendar-config';
import { useCalendarStore } from '@/store/calendar-store';
import { qk } from '@/data/query-keys';
import { eventToFormState, type FormStatePrefill } from '@/integrations/calendar/event-to-entry';
import type { CalendarEvent } from '@/integrations/calendar/provider';

export type Suggestion = FormStatePrefill & {
  logged: boolean;
  calendar_id: string;
};

function dateBoundsISO(date: string): { timeMin: string; timeMax: string } {
  const [y, m, d] = date.split('-').map((s) => parseInt(s, 10));
  const start = new Date(y ?? 0, (m ?? 1) - 1, d ?? 0, 0, 0, 0, 0);
  const end = new Date(y ?? 0, (m ?? 1) - 1, d ?? 0, 23, 59, 59, 999);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

export function useCalendarEvents(date: string) {
  const { provider, connected } = useCalendarStore();
  const config = useCalendarConfig();
  const month = date.slice(0, 7);
  const entries = useMonthEntries(month);

  const enabled = connected && !!config.data && config.data.enabled_calendars.length > 0;

  return useQuery({
    queryKey: [...qk.all, 'calendar-events', date, config.data?.enabled_calendars ?? []] as const,
    enabled,
    staleTime: 120_000,
    queryFn: async (): Promise<Suggestion[]> => {
      if (!config.data) return [];
      const { timeMin, timeMax } = dateBoundsISO(date);
      const perCalendar = await Promise.all(
        config.data.enabled_calendars.map(async (calendarId) => {
          const events: CalendarEvent[] = await provider.listEvents({
            calendarId,
            timeMin,
            timeMax,
          });
          return events
            .map((ev) => ({ calendarId, prefill: eventToFormState(ev, date) }))
            .filter((x): x is { calendarId: string; prefill: FormStatePrefill } => x.prefill !== null);
        }),
      );
      const flat = perCalendar.flat();
      const loggedIds = new Set(
        (entries.data?.entries ?? [])
          .map((e) => e.source_event_id)
          .filter((v): v is string => !!v),
      );
      return flat
        .map((x) => ({
          ...x.prefill,
          calendar_id: x.calendarId,
          logged: loggedIds.has(x.prefill.source_event_id),
        }))
        .sort((a, b) => a.start_label.localeCompare(b.start_label));
    },
  });
}
