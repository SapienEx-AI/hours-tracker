import type { Project } from '@/schema/types';

type Props = {
  projects: Project[];
  projectId: string;
  bucketId: string | null;
  onChangeProject: (id: string) => void;
  onChangeBucket: (id: string | null) => void;
};

/**
 * Inline project + bucket selector shown inside the Timer card during
 * running/paused states. Changes here propagate immediately to the form
 * (via callbacks wired in QuickLog) so the user can re-target the active
 * timer without leaving the panel.
 */
export function TimerInlineEdit({
  projects,
  projectId,
  bucketId,
  onChangeProject,
  onChangeBucket,
}: Props): JSX.Element {
  const selectedProject = projects.find((p) => p.id === projectId);
  const activeBuckets =
    selectedProject?.buckets.filter((b) => b.status !== 'archived') ?? [];

  return (
    <div className="grid grid-cols-[64px_1fr] gap-x-2 gap-y-1.5 items-center">
      <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
        project
      </span>
      <select
        value={projectId}
        onChange={(e) => onChangeProject(e.target.value)}
        className="
          w-full px-2.5 py-1.5 rounded-lg glass-input
          text-sm text-slate-800 font-body
          focus:outline-none focus:border-amber-400/50
          transition-all duration-150
        "
      >
        <option value="">— select —</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
        bucket
      </span>
      <select
        value={bucketId ?? ''}
        onChange={(e) => onChangeBucket(e.target.value || null)}
        disabled={selectedProject === undefined}
        className="
          w-full px-2.5 py-1.5 rounded-lg glass-input
          text-sm text-slate-800 font-body
          focus:outline-none focus:border-amber-400/50
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-150
        "
      >
        <option value="">(none — general billable)</option>
        {activeBuckets.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
            {b.status === 'closed' ? ' (closed)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
