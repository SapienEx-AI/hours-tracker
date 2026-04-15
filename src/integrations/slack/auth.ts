export type ValidateArgs = {
  readonly token: string;
  readonly fetchImpl?: typeof fetch;
};

export type ValidateResult = {
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly botUserId: string;
};

export async function validateSlackBotToken(args: ValidateArgs): Promise<ValidateResult> {
  if (!args.token.startsWith('xoxb-')) {
    throw new Error('Slack bot tokens must start with xoxb-');
  }
  const f = args.fetchImpl ?? fetch;
  const resp = await f('https://slack.com/api/auth.test', {
    method: 'POST',
    headers: { Authorization: `Bearer ${args.token}` },
  });
  const body = (await resp.json()) as {
    ok: boolean;
    error?: string;
    team_id?: string;
    team?: string;
    user_id?: string;
  };
  if (!body.ok) throw new Error(`Slack ${body.error ?? 'auth.test failed'}`);
  return {
    workspaceId: body.team_id ?? '',
    workspaceName: body.team ?? '',
    botUserId: body.user_id ?? '',
  };
}

const TOKEN_KEY = 'hours-tracker.slack-token';
const WORKSPACE_KEY = 'hours-tracker.slack-workspace';
const USER_KEY = 'hours-tracker.slack-user-id';

export type SlackSession = {
  readonly token: string;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly botUserId: string;
};

export function loadSlackSession(): SlackSession | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const workspaceId = localStorage.getItem(WORKSPACE_KEY);
  const botUserId = localStorage.getItem(USER_KEY);
  if (!token || !workspaceId || !botUserId) return null;
  return { token, workspaceId, workspaceName: '', botUserId };
}

export function storeSlackSession(session: SlackSession): void {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(WORKSPACE_KEY, session.workspaceId);
  localStorage.setItem(USER_KEY, session.botUserId);
}

export function clearSlackSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(WORKSPACE_KEY);
  localStorage.removeItem(USER_KEY);
}
