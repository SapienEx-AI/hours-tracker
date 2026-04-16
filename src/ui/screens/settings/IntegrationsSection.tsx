import { useState } from 'react';
import {
  validateSlackBotToken,
  loadSlackSession,
  storeSlackSession,
  clearSlackSession,
} from '@/integrations/slack/auth';
import { slackAppManifestJson } from '@/integrations/slack/manifest';
import { Button } from '@/ui/components/Button';
import { Banner } from '@/ui/components/Banner';
import {
  IntegrationsConfigEditor,
  parseAndValidateConfigJson,
} from './IntegrationsConfigEditor';

export { parseAndValidateConfigJson };

function SlackConnectCard(): JSX.Element {
  const existing = loadSlackSession();
  const [showForm, setShowForm] = useState(false);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [, force] = useState({});

  const handleSave = async (): Promise<void> => {
    setBusy(true);
    setErr(null);
    try {
      const result = await validateSlackBotToken({ token });
      storeSlackSession({
        token,
        workspaceId: result.workspaceId,
        workspaceName: result.workspaceName,
        botUserId: result.botUserId,
      });
      setShowForm(false);
      setToken('');
      force({});
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = (): void => {
    clearSlackSession();
    force({});
  };

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-body font-medium">Slack</div>
          <div className="text-xs text-slate-500">
            {existing ? `Connected to workspace ${existing.workspaceId}` : 'Not connected'}
          </div>
        </div>
        {existing ? (
          <Button variant="secondary" onClick={handleDisconnect}>
            Disconnect
          </Button>
        ) : (
          <Button onClick={() => setShowForm(true)} disabled={showForm}>
            Connect
          </Button>
        )}
      </div>
      {showForm && !existing && <SlackConnectForm
        token={token}
        setToken={setToken}
        busy={busy}
        err={err}
        onSave={handleSave}
        onCancel={() => setShowForm(false)}
      />}
    </div>
  );
}

type SlackConnectFormProps = {
  token: string;
  setToken: (v: string) => void;
  busy: boolean;
  err: string | null;
  onSave: () => void;
  onCancel: () => void;
};

function SlackConnectForm({
  token,
  setToken,
  busy,
  err,
  onSave,
  onCancel,
}: SlackConnectFormProps): JSX.Element {
  const manifest = slackAppManifestJson();
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(manifest);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers — user can still select-all + copy from the textarea.
    }
  };

  return (
    <div className="space-y-3 mt-2 text-xs">
      <ol className="space-y-2 list-decimal list-inside text-slate-700">
        <li>
          <button
            type="button"
            onClick={handleCopy}
            className="text-sky-700 underline"
          >
            {copied ? 'Copied ✓' : 'Copy app manifest'}
          </button>
        </li>
        <li>
          <a
            href="https://api.slack.com/apps?new_app=1"
            target="_blank"
            rel="noreferrer"
            className="text-sky-700 underline"
          >
            Open Slack app creator →
          </a>{' '}
          choose <b>From a manifest</b>, pick your workspace, paste the
          manifest, review, and click <b>Create</b>.
        </li>
        <li>
          In the new app page, go to <b>Install App</b> and click{' '}
          <b>Install to Workspace</b>. Grant the requested scopes.
        </li>
        <li>
          Open <b>OAuth &amp; Permissions</b>, copy the{' '}
          <b>Bot User OAuth Token</b> (starts with <code>xoxb-</code>), and
          paste it below.
        </li>
      </ol>
      <details className="text-[11px] text-slate-500">
        <summary className="cursor-pointer">Show manifest</summary>
        <textarea
          readOnly
          rows={10}
          className="w-full mt-1 border border-slate-200 rounded px-2 py-1 text-[11px] font-mono bg-slate-50"
          value={manifest}
          onFocus={(e) => e.currentTarget.select()}
        />
      </details>
      <input
        type="password"
        className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono"
        placeholder="xoxb-..."
        value={token}
        onChange={(e) => setToken(e.target.value.trim())}
      />
      <div className="flex gap-2">
        <Button onClick={onSave} disabled={busy || token.length === 0}>
          {busy ? 'Validating…' : 'Save'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {err !== null && <Banner variant="error">{err}</Banner>}
    </div>
  );
}

function GmailConnectCard(): JSX.Element {
  return (
    <div className="glass rounded-xl p-4">
      <div className="font-body font-medium">Gmail</div>
      <div className="text-xs text-slate-500 mt-1">
        Uses the same Google account as Calendar. The token scope has been
        extended — re-connect Calendar in the section above to grant Gmail
        read-only access, then enable Gmail in the config below.
      </div>
    </div>
  );
}

export function IntegrationsSection(): JSX.Element {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg">Effort source integrations</h2>
      <SlackConnectCard />
      <GmailConnectCard />
      <IntegrationsConfigEditor />
    </section>
  );
}
