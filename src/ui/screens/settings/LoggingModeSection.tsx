import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useProfile } from '@/data/hooks/use-profile';
import { updateProfile } from '@/data/profile-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { qk } from '@/data/query-keys';
import { Banner } from '@/ui/components/Banner';
import { Select } from '@/ui/components/Select';
import type { LoggingMode, Profile } from '@/schema/types';

export function LoggingModeSection(): JSX.Element {
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const profile = useProfile();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (nextMode: LoggingMode) => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      if (!profile.data) throw new Error('Profile not loaded');
      const { owner, repo } = splitRepoPath(dataRepo);
      const next: Profile = { ...profile.data, logging_mode: nextMode };
      await updateProfile(octokit, { owner, repo, profile: next });
      return next;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.profile(dataRepo ?? 'none') });
    },
  });

  if (profile.isLoading) {
    return <div className="text-slate-500">Loading…</div>;
  }
  if (profile.error) {
    return (
      <Banner variant="error">
        Failed to load profile: {(profile.error as Error).message}
      </Banner>
    );
  }
  const current: LoggingMode = profile.data?.logging_mode ?? 'hours';

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg text-slate-800">Logging mode</h2>
      <p className="text-xs text-slate-500 max-w-prose leading-relaxed">
        <b>Hours</b>: default layout for hourly consultants.{' '}
        <b>Effort</b>: promote the Activity field and collapse billing controls — best for
        full-time HubSpot leads tracking activities (workshops, Slack, emails, meetings).{' '}
        <b>Both</b>: everything visible.
      </p>
      <div className="max-w-xs">
        <Select
          value={current}
          onChange={(e) => mutation.mutate(e.target.value as LoggingMode)}
          disabled={mutation.isPending}
        >
          <option value="hours">Hours</option>
          <option value="effort">Effort</option>
          <option value="both">Both</option>
        </Select>
      </div>
      {mutation.error && (
        <Banner variant="error">
          Failed to save: {(mutation.error as Error).message}
        </Banner>
      )}
    </section>
  );
}
