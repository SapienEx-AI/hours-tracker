const BASE = 'https://www.googleapis.com/calendar/v3';

export type GCalendar = {
  id: string;
  summary: string;
  primary?: boolean;
};

export type GEventDateTime = {
  dateTime?: string;
  date?: string;
  timeZone?: string;
};

export type GEventAttendee = {
  self?: boolean;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
};

export type GEvent = {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string;
  description?: string;
  start: GEventDateTime;
  end: GEventDateTime;
  attendees?: GEventAttendee[];
};

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as { error?: { message?: string } }).error?.message ?? res.statusText;
    throw new Error(`Google Calendar API ${res.status}: ${msg}`);
  }
  return (await res.json()) as T;
}

export async function listCalendars(token: string): Promise<GCalendar[]> {
  const data = await fetchJson<{ items: GCalendar[] }>(
    `${BASE}/users/me/calendarList?minAccessRole=reader`,
    token,
  );
  return data.items ?? [];
}

export async function listEvents(
  token: string,
  args: { calendarId: string; timeMin: string; timeMax: string },
): Promise<GEvent[]> {
  const params = new URLSearchParams({
    timeMin: args.timeMin,
    timeMax: args.timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
  });
  const encoded = encodeURIComponent(args.calendarId);
  const data = await fetchJson<{ items: GEvent[] }>(
    `${BASE}/calendars/${encoded}/events?${params.toString()}`,
    token,
  );
  return data.items ?? [];
}
