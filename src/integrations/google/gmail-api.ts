export type GmailThreadResult = {
  readonly threadId: string;
  readonly recipientEmails: readonly string[];
};

export type FetchArgs = {
  readonly token: string;
  readonly date: string;
  readonly fetchImpl?: typeof fetch;
};

function nextDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function toGmailDate(date: string): string {
  return date.replace(/-/g, '/');
}

function parseEmails(headerValue: string): string[] {
  return headerValue
    .split(',')
    .map((s) => {
      const m = s.match(/<([^>]+)>/);
      const raw = m && m[1] !== undefined ? m[1] : s.trim();
      return raw.toLowerCase();
    })
    .filter((s) => s.includes('@'));
}

async function fetchMessageList(
  f: typeof fetch,
  token: string,
  after: string,
  before: string,
): Promise<string[]> {
  const q = encodeURIComponent(`in:sent after:${after} before:${before}`);
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}`;
  const resp = await f(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) {
    throw new Error(`Gmail list failed: ${resp.status} ${resp.statusText}`);
  }
  const body = (await resp.json()) as { messages?: Array<{ threadId: string }> };
  return Array.from(new Set((body.messages ?? []).map((m) => m.threadId)));
}

async function fetchThreadRecipients(
  f: typeof fetch,
  token: string,
  threadId: string,
): Promise<string[]> {
  const resp = await f(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!resp.ok) return [];
  const body = (await resp.json()) as {
    messages?: Array<{ payload?: { headers?: Array<{ name: string; value: string }> } }>;
  };
  const recipients = new Set<string>();
  for (const msg of body.messages ?? []) {
    for (const header of msg.payload?.headers ?? []) {
      if (header.name === 'To' || header.name === 'Cc') {
        parseEmails(header.value).forEach((e) => recipients.add(e));
      }
    }
  }
  return Array.from(recipients);
}

export async function fetchSentThreadsForDate(args: FetchArgs): Promise<GmailThreadResult[]> {
  const f = args.fetchImpl ?? fetch;
  const after = toGmailDate(args.date);
  const before = toGmailDate(nextDate(args.date));
  const threadIds = await fetchMessageList(f, args.token, after, before);
  const threads: GmailThreadResult[] = [];
  for (const threadId of threadIds) {
    const recipientEmails = await fetchThreadRecipients(f, args.token, threadId);
    threads.push({ threadId, recipientEmails });
  }
  return threads;
}
