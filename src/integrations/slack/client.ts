export type SlackChannelThread = {
  readonly channelName: string;
  readonly threadTs: string;
};

export type SlackDmThread = {
  readonly participantEmails: readonly string[];
  readonly threadTs: string;
};

export type SlackActivityResult = {
  readonly channelThreads: readonly SlackChannelThread[];
  readonly dmThreads: readonly SlackDmThread[];
};

export type FetchArgs = {
  readonly token: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly date: string;
  readonly fetchImpl?: typeof fetch;
};

async function slackGet<T>(url: string, token: string, f: typeof fetch): Promise<T> {
  const doFetch = async (): Promise<Response> =>
    f(url, { headers: { Authorization: `Bearer ${token}` } });
  let resp = await doFetch();
  if (resp.status === 429) {
    const retry = parseInt(resp.headers.get('Retry-After') ?? '0', 10) * 1000;
    await new Promise((r) => setTimeout(r, retry));
    resp = await doFetch();
  }
  if (!resp.ok) throw new Error(`Slack HTTP ${resp.status}`);
  const body = (await resp.json()) as { ok?: boolean; error?: string } & T;
  if (body.ok === false) throw new Error(`Slack API error: ${body.error ?? 'unknown'}`);
  return body;
}

function dayWindow(date: string): { after: number; before: number } {
  const start = Date.parse(`${date}T00:00:00Z`) / 1000;
  return { after: start, before: start + 86400 };
}

function collectThreadIds(
  messages: Array<{ ts: string; user?: string; thread_ts?: string }>,
  userId: string,
): Set<string> {
  const threadIds = new Set<string>();
  for (const msg of messages) {
    if (msg.user !== userId) continue;
    threadIds.add(msg.thread_ts ?? msg.ts);
  }
  return threadIds;
}

async function fetchChannelThreads(
  f: typeof fetch,
  token: string,
  userId: string,
  after: number,
  before: number,
): Promise<SlackChannelThread[]> {
  const channelsBody = await slackGet<{
    channels: Array<{ id: string; name: string }>;
  }>(
    `https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=1000`,
    token,
    f,
  );
  const channelThreads: SlackChannelThread[] = [];
  for (const ch of channelsBody.channels) {
    const historyBody = await slackGet<{
      messages: Array<{ ts: string; user?: string; thread_ts?: string }>;
    }>(
      `https://slack.com/api/conversations.history?channel=${ch.id}&oldest=${after}&latest=${before}&limit=200`,
      token,
      f,
    );
    for (const tts of collectThreadIds(historyBody.messages, userId)) {
      channelThreads.push({ channelName: ch.name, threadTs: tts });
    }
  }
  return channelThreads;
}

async function fetchDmThreads(
  f: typeof fetch,
  token: string,
  userId: string,
  after: number,
  before: number,
): Promise<SlackDmThread[]> {
  const dmsBody = await slackGet<{
    channels: Array<{ id: string; user?: string }>;
  }>(
    `https://slack.com/api/conversations.list?types=im&limit=1000`,
    token,
    f,
  );
  const dmThreads: SlackDmThread[] = [];
  for (const dm of dmsBody.channels) {
    const historyBody = await slackGet<{
      messages: Array<{ ts: string; user?: string; thread_ts?: string }>;
    }>(
      `https://slack.com/api/conversations.history?channel=${dm.id}&oldest=${after}&latest=${before}&limit=200`,
      token,
      f,
    );
    const threadIds = collectThreadIds(historyBody.messages, userId);
    if (threadIds.size === 0) continue;
    let email = '';
    if (dm.user) {
      const userBody = await slackGet<{ user: { profile: { email?: string } } }>(
        `https://slack.com/api/users.info?user=${dm.user}`,
        token,
        f,
      );
      email = userBody.user.profile.email?.toLowerCase() ?? '';
    }
    for (const tts of threadIds) {
      dmThreads.push({ participantEmails: email ? [email] : [], threadTs: tts });
    }
  }
  return dmThreads;
}

export async function fetchSlackActivityForDate(
  args: FetchArgs,
): Promise<SlackActivityResult> {
  const f = args.fetchImpl ?? fetch;
  const { after, before } = dayWindow(args.date);
  const channelThreads = await fetchChannelThreads(f, args.token, args.userId, after, before);
  const dmThreads = await fetchDmThreads(f, args.token, args.userId, after, before);
  return { channelThreads, dmThreads };
}
