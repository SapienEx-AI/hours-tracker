import type { EffortKind } from '@/schema/types';

type Props = {
  value: EffortKind | null;
  onChange: (next: EffortKind | null) => void;
  disabled?: boolean;
  className?: string;
};

const GROUPS: ReadonlyArray<{ label: string; kinds: EffortKind[] }> = [
  { label: 'Client-sync', kinds: ['workshop', 'meeting', 'client_training'] },
  {
    label: 'Technical',
    kinds: ['config_work', 'build', 'integration', 'data_work', 'reporting', 'qa'],
  },
  { label: 'Client-async', kinds: ['slack', 'email', 'async_video', 'ticket'] },
  { label: 'Internal', kinds: ['internal_sync', 'documentation', 'peer_review'] },
  { label: 'Growth', kinds: ['learning', 'scoping'] },
  { label: 'Other', kinds: ['other'] },
];

export const EFFORT_KIND_LABEL: Record<EffortKind, string> = {
  workshop: 'Workshop / discovery',
  meeting: 'Meeting / client sync',
  client_training: 'Client training',
  config_work: 'Config work',
  build: 'Build (modules / workflows)',
  integration: 'Integration',
  data_work: 'Data work',
  reporting: 'Reporting / dashboards',
  qa: 'QA / validation',
  slack: 'Slack message',
  email: 'Email',
  async_video: 'Async video (Loom)',
  ticket: 'Ticket response',
  internal_sync: 'Internal sync',
  documentation: 'Documentation',
  peer_review: 'Peer review',
  learning: 'Learning / certification',
  scoping: 'Scoping / SOW',
  other: 'Other',
};

export function EffortKindSelect({
  value,
  onChange,
  disabled = false,
  className = '',
}: Props): JSX.Element {
  return (
    <select
      value={value ?? ''}
      onChange={(e) =>
        onChange(e.target.value === '' ? null : (e.target.value as EffortKind))
      }
      disabled={disabled}
      className={`w-full px-4 py-2.5 rounded-xl glass-input text-slate-800 font-body text-sm transition-all duration-300 focus:outline-none ${className}`}
    >
      <option value="">— none —</option>
      {GROUPS.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.kinds.map((k) => (
            <option key={k} value={k}>
              {EFFORT_KIND_LABEL[k]}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
