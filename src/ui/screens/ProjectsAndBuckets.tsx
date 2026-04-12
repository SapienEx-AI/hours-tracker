import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useProjects } from '@/data/hooks/use-projects';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useAuthStore } from '@/store/auth-store';
import { writeProjects } from '@/data/projects-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { configAddProjectMessage } from '@/data/commit-messages';
import type { Project } from '@/schema/types';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Banner } from '@/ui/components/Banner';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { formatHoursDecimal } from '@/format/format';
import { qk } from '@/data/query-keys';

export function ProjectsAndBuckets(): JSX.Element {
  const projects = useProjects();
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const queryClient = useQueryClient();
  const [newProjName, setNewProjName] = useState('');
  const [newProjId, setNewProjId] = useState('');

  const addProjectMutation = useMutation({
    mutationFn: async () => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      if (!projects.data) throw new Error('Projects not loaded');
      const { owner, repo } = splitRepoPath(dataRepo);
      const next: Project = {
        id: newProjId,
        name: newProjName,
        client: null,
        active: true,
        is_internal: false,
        default_rate_cents: null,
        buckets: [],
      };
      await writeProjects(octokit, {
        owner,
        repo,
        data: { ...projects.data, projects: [...projects.data.projects, next] },
        message: configAddProjectMessage(newProjName),
      });
    },
    onSuccess: () => {
      setNewProjName('');
      setNewProjId('');
      queryClient.invalidateQueries({ queryKey: qk.projects(dataRepo ?? 'none') });
    },
  });

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <h1 className="font-display text-2xl">Projects &amp; Buckets</h1>
      {projects.error && <Banner variant="error">{(projects.error as Error).message}</Banner>}
      <section className="flex items-end gap-2">
        <FieldLabel label="New project id">
          <Input
            value={newProjId}
            onChange={(e) =>
              setNewProjId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
            }
          />
        </FieldLabel>
        <FieldLabel label="Name">
          <Input value={newProjName} onChange={(e) => setNewProjName(e.target.value)} />
        </FieldLabel>
        <Button
          onClick={() => addProjectMutation.mutate()}
          disabled={!newProjId || !newProjName || addProjectMutation.isPending}
        >
          Add
        </Button>
      </section>
      {addProjectMutation.error && (
        <Banner variant="error">{(addProjectMutation.error as Error).message}</Banner>
      )}
      <ul className="flex flex-col gap-2">
        {projects.data?.projects.map((p) => (
          <li key={p.id} className="p-3 rounded border border-partner-border-subtle">
            <div className="flex items-center justify-between">
              <span className="font-display">{p.name}</span>
              <span className="font-mono text-xs text-partner-muted">{p.id}</span>
            </div>
            {p.buckets.length > 0 && (
              <ul className="mt-2 pl-4 font-mono text-sm text-partner-muted">
                {p.buckets.map((b) => (
                  <li key={b.id}>
                    {b.type} · {b.name} · {formatHoursDecimal(b.budgeted_hours_hundredths)}h ·{' '}
                    {b.status}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <Banner variant="info">
        MVP: project add only. Bucket CRUD and full editing is the first post-MVP follow-up
        (see backlog).
      </Banner>
    </div>
  );
}
