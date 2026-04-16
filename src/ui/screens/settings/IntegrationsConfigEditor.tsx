import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  loadIntegrationsConfig,
  saveIntegrationsConfig,
} from '@/data/integrations-repo';
import { integrationsMessage } from '@/data/commit-messages';
import {
  validateIntegrationsConfig,
  formatValidationErrors,
} from '@/schema/validators';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useAuthStore } from '@/store/auth-store';
import { splitRepoPath } from '@/data/octokit-client';
import { qk } from '@/data/query-keys';
import { Button } from '@/ui/components/Button';
import { Banner } from '@/ui/components/Banner';
import type { IntegrationsConfig } from '@/schema/types';

export type ParseResult =
  | { ok: true; value: IntegrationsConfig }
  | { ok: false; error: string };

export function parseAndValidateConfigJson(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }
  const v = validateIntegrationsConfig(parsed);
  if (!v.ok) return { ok: false, error: formatValidationErrors(v.errors) };
  return { ok: true, value: v.value };
}

const SAMPLE_CONFIG: IntegrationsConfig = {
  schema_version: 1,
  slack: {
    enabled: false,
    client_channel_prefixes: ['#client-'],
    internal_channel_prefixes: ['#team-'],
  },
  gmail: {
    enabled: false,
    client_domains: ['example-client.com'],
    internal_domains: ['sapienex.com'],
  },
  calendar: {
    workshop_min_duration_minutes: 120,
    client_training_title_keywords: ['training', 'workshop'],
    internal_only_attendee_domains: ['sapienex.com'],
  },
};

function useIntegrationsConfigQuery() {
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  return useQuery({
    queryKey: [...qk.all, 'integrations-config', dataRepo ?? 'none'] as const,
    enabled: !!octokit && !!dataRepo,
    queryFn: async () => {
      if (!octokit || !dataRepo) return null;
      const { owner, repo } = splitRepoPath(dataRepo);
      return loadIntegrationsConfig(octokit, { owner, repo });
    },
  });
}

export function IntegrationsConfigEditor(): JSX.Element {
  const query = useIntegrationsConfigQuery();
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const current = query.data ?? SAMPLE_CONFIG;
  const initial = JSON.stringify(current, null, 2);
  const text = draft ?? initial;

  const save = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      const parsed = parseAndValidateConfigJson(text);
      if (!parsed.ok) throw new Error(parsed.error);
      const { owner, repo } = splitRepoPath(dataRepo);
      await saveIntegrationsConfig(octokit, {
        owner,
        repo,
        config: parsed.value,
        message: integrationsMessage(query.data ? 'update' : 'create'),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...qk.all, 'integrations-config', dataRepo ?? 'none'],
      });
      setDraft(null);
      setErr(null);
    },
    onError: (e) => {
      setErr(e instanceof Error ? e.message : String(e));
    },
  });

  return (
    <div className="glass rounded-xl p-4">
      <div className="font-body font-medium mb-2">integrations.json</div>
      <textarea
        className="w-full h-72 border border-slate-300 rounded px-2 py-1 text-xs font-mono"
        value={text}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
      />
      <div className="flex gap-2 mt-2 items-center">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setDraft(null);
            setErr(null);
          }}
        >
          Reset
        </Button>
        {query.data === null && draft === null && (
          <span className="text-[11px] text-slate-500">
            No config file yet. Sample shown — edit and Save to create.
          </span>
        )}
      </div>
      {err !== null && (
        <Banner variant="error">
          <pre className="text-xs whitespace-pre-wrap">{err}</pre>
        </Banner>
      )}
    </div>
  );
}
