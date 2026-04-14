import type { GCalendar, GEvent } from '@/integrations/google/calendar-api';
import { listCalendars, listEvents } from '@/integrations/google/calendar-api';
import { connect, disconnect, getAccessToken, isConnected } from '@/integrations/google/gis-client';

export type CalendarInfo = GCalendar;
export type CalendarEvent = GEvent;

export type CalendarProvider = {
  id: 'google';
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  listCalendars(): Promise<CalendarInfo[]>;
  listEvents(args: {
    calendarId: string;
    timeMin: string;
    timeMax: string;
  }): Promise<CalendarEvent[]>;
};

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const msg = (e as Error).message ?? '';
    if (msg.includes('401')) {
      await getAccessToken();
      return await fn();
    }
    throw e;
  }
}

export const googleProvider: CalendarProvider = {
  id: 'google',
  async connect() {
    await connect();
  },
  disconnect() {
    disconnect();
  },
  isConnected() {
    return isConnected();
  },
  async listCalendars() {
    const token = await getAccessToken();
    return withRetry(() => listCalendars(token));
  },
  async listEvents(args) {
    const token = await getAccessToken();
    return withRetry(() => listEvents(token, args));
  },
};
