import { useState, useMemo } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useProjects } from '@/data/hooks/use-projects';
import { useAllEntries } from '@/data/hooks/use-all-entries';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useAuthStore } from '@/store/auth-store';
import { writeProjects } from '@/data/projects-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { configAddProjectMessage, configAddBucketMessage } from '@/data/commit-messages';
import { computeAllTimeBucketConsumption } from '@/calc';
import type { Project, Bucket, BucketType, ProjectsConfig, Partner } from '@/schema/types';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Banner } from '@/ui/components/Banner';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { qk } from '@/data/query-keys';
import { AddBucketForm } from './projects/AddBucketForm';
import { BucketRow } from './projects/BucketRow';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function updateProject(
  config: ProjectsConfig,
  projectId: string,
  updater: (p: Project) => Project,
): ProjectsConfig {
  return {
    ...config,
    projects: config.projects.map((p) => (p.id === projectId ? updater(p) : p)),
  };
}

function updateBucket(
  project: Project,
  bucketId: string,
  updater: (b: Bucket) => Bucket,
): Project {
  return {
    ...project,
    buckets: project.buckets.map((b) => (b.id === bucketId ? updater(b) : b)),
  };
}

export function ProjectsAndBuckets({ partner }: { partner: Partner }): JSX.Element {
  const projects = useProjects();
  const allEntriesQuery = useAllEntries();
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const queryClient = useQueryClient();
  const [newProjName, setNewProjName] = useState('');
  const [newProjId, setNewProjId] = useState('');

  const allTimeBuckets = useMemo(() => {
    if (!allEntriesQuery.data) return new Map();
    return computeAllTimeBucketConsumption(allEntriesQuery.data);
  }, [allEntriesQuery.data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.projects(dataRepo ?? 'none') });
  };

  const mutation = useMutation({
    mutationFn: async (args: { data: ProjectsConfig; message: string }) => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      const { owner, repo } = splitRepoPath(dataRepo);
      await writeProjects(octokit, {
        owner, repo, data: args.data, message: args.message,
      });
    },
    onSuccess: invalidate,
  });

  function addProject() {
    if (!projects.data) return;
    const next: Project = {
      id: newProjId, name: newProjName, client: null,
      active: true, is_internal: false, default_rate_cents: null, buckets: [],
    };
    mutation.mutate({
      data: { ...projects.data, projects: [...projects.data.projects, next] },
      message: configAddProjectMessage(newProjName),
    }, { onSuccess: () => { setNewProjName(''); setNewProjId(''); } });
  }

  function addBucket(projectId: string, args: {
    id: string; type: BucketType; name: string;
    budgeted_hours: number; rate_cents: number | null;
  }) {
    if (!projects.data) return;
    const newBucket: Bucket = {
      id: args.id, type: args.type, name: args.name,
      budgeted_hours_hundredths: args.budgeted_hours,
      rate_cents: args.rate_cents, status: 'active',
      opened_at: todayISO(), closed_at: null, notes: '',
    };
    mutation.mutate({
      data: updateProject(projects.data, projectId, (p) => ({
        ...p, buckets: [...p.buckets, newBucket],
      })),
      message: configAddBucketMessage(args.id, projectId),
    });
  }

  function closeBucket(projectId: string, bucketId: string) {
    if (!projects.data) return;
    mutation.mutate({
      data: updateProject(projects.data, projectId, (p) =>
        updateBucket(p, bucketId, (b) => ({
          ...b, status: 'closed', closed_at: todayISO(),
        })),
      ),
      message: `config: close bucket ${bucketId} in ${projectId}`,
    });
  }

  function archiveBucket(projectId: string, bucketId: string) {
    if (!projects.data) return;
    mutation.mutate({
      data: updateProject(projects.data, projectId, (p) =>
        updateBucket(p, bucketId, (b) => ({ ...b, status: 'archived' as const })),
      ),
      message: `config: archive bucket ${bucketId} in ${projectId}`,
    });
  }

  const currency = {
    currency_symbol: partner.currency_symbol,
    currency_display_suffix: partner.currency_display_suffix,
  };

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <h1 className="font-display text-2xl">Projects &amp; Buckets</h1>
      {projects.error && <Banner variant="error">{(projects.error as Error).message}</Banner>}
      {mutation.error && <Banner variant="error">{(mutation.error as Error).message}</Banner>}

      <section className="flex items-end gap-2">
        <FieldLabel label="New project id">
          <Input value={newProjId}
            onChange={(e) => setNewProjId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
        </FieldLabel>
        <FieldLabel label="Name">
          <Input value={newProjName} onChange={(e) => setNewProjName(e.target.value)} />
        </FieldLabel>
        <Button onClick={addProject}
          disabled={!newProjId || !newProjName || mutation.isPending}>
          Add project
        </Button>
      </section>

      <ul className="flex flex-col gap-4">
        {projects.data?.projects.map((p) => (
          <li key={p.id} className="p-4 rounded-2xl glass">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-display text-lg">{p.name}</span>
                <span className="font-mono text-xs text-slate-500 ml-2">{p.id}</span>
                {p.is_internal && (
                  <span className="text-xs text-slate-500 ml-2 bg-black/5 px-1 rounded">
                    internal
                  </span>
                )}
              </div>
              <span className={`text-xs ${p.active ? 'text-green-400' : 'text-slate-500'}`}>
                {p.active ? 'active' : 'inactive'}
              </span>
            </div>

            {p.buckets.length > 0 && (
              <div className="flex flex-col gap-1 mb-2">
                {p.buckets.map((b) => (
                  <BucketRow
                    key={b.id}
                    bucket={b}
                    currency={currency}
                    allTimeConsumption={allTimeBuckets.get(b.id)}
                    onClose={() => closeBucket(p.id, b.id)}
                    onArchive={() => archiveBucket(p.id, b.id)}
                    disabled={mutation.isPending}
                  />
                ))}
              </div>
            )}

            <AddBucketForm
              projectId={p.id}
              onAdd={(args) => addBucket(p.id, args)}
              disabled={mutation.isPending}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
