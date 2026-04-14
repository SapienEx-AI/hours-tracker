import { useState } from 'react';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { useCalendarConfig } from '@/data/hooks/use-calendar-config';
import { useCalendarStore } from '@/store/calendar-store';
import { writeCalendarConfig } from '@/data/calendar-config-repo';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useAuthStore } from '@/store/auth-store';
import { splitRepoPath } from '@/data/octokit-client';
import { qk } from '@/data/query-keys';
import { Button } from '@/ui/components/Button';
import { Banner } from '@/ui/components/Banner';
import type { CalendarConfig } from '@/schema/types';

export function CalendarSection(): JSX.Element {
  const { provider, connected, lastError, refresh, setError } = useCalendarStore();
  const config = useCalendarConfig();
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const calendars = useQuery({
    queryKey: [...qk.all, 'calendar-list', connected] as const,
    enabled: connected,
    staleTime: 300_000,
    queryFn: () => provider.listCalendars(),
  });

  const saveConfig = useMutation({
    mutationFn: async (next: CalendarConfig) => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      const { owner, repo } = splitRepoPath(dataRepo);
      await writeCalendarConfig(octokit, {
        owner,
        repo,
        config: next,
        action: config.data ? 'update' : 'connect',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.calendarConfig(dataRepo ?? 'none') });
    },
  });

  async function handleConnect() {
    setBusy(true);
    setError(null);
    try {
      await provider.connect();
      refresh();
      if (!config.data) {
        const initial: CalendarConfig = {
          schema_version: 1,
          provider: 'google',
          enabled_calendars: ['primary'],
          last_connected_at: new Date().toISOString(),
        };
        await saveConfig.mutateAsync(initial);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleDisconnect() {
    provider.disconnect();
    refresh();
  }

  function toggleCalendar(id: string, checked: boolean) {
    if (!config.data) return;
    const next = new Set(config.data.enabled_calendars);
    if (checked) next.add(id);
    else next.delete(id);
    const updated: CalendarConfig = {
      ...config.data,
      enabled_calendars: [...next],
    };
    saveConfig.mutate(updated);
  }

  const enabledSet = new Set(config.data?.enabled_calendars ?? []);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg">Calendar integration</h2>
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-body font-medium">Google Calendar</div>
            <div className="text-xs text-slate-500">
              {connected ? 'Connected' : 'Not connected'}
            </div>
          </div>
          {connected ? (
            <Button variant="secondary" onClick={handleDisconnect}>Disconnect</Button>
          ) : (
            <Button onClick={handleConnect} disabled={busy}>
              {busy ? 'Connecting…' : 'Connect'}
            </Button>
          )}
        </div>
        {lastError && <Banner variant="error">{lastError}</Banner>}
        {connected && calendars.isLoading && (
          <div className="text-sm text-slate-500">Loading your calendars…</div>
        )}
        {connected && calendars.error && (
          <Banner variant="error">{(calendars.error as Error).message}</Banner>
        )}
        {connected && calendars.data && (
          <div className="flex flex-col gap-1 mt-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Calendars to include
            </div>
            {calendars.data.map((c) => {
              const key = c.primary ? 'primary' : c.id;
              return (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={enabledSet.has(key)}
                    onChange={(e) => toggleCalendar(key, e.target.checked)}
                    disabled={saveConfig.isPending}
                  />
                  <span>{c.summary}</span>
                  {c.primary && <span className="text-xs text-slate-400">(primary)</span>}
                </label>
              );
            })}
          </div>
        )}
        {config.data?.last_connected_at && (
          <div className="text-xs text-slate-400 mt-3">
            Last connected: {config.data.last_connected_at.slice(0, 10)}
          </div>
        )}
      </div>
    </section>
  );
}
