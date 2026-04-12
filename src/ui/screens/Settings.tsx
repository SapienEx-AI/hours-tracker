import { useAuthStore } from '@/store/auth-store';
import { useCommitQueue } from '@/store/commit-queue';
import { Button } from '@/ui/components/Button';
import { Select } from '@/ui/components/Select';
import { Banner } from '@/ui/components/Banner';
import { FieldLabel } from '@/ui/components/FieldLabel';

const DELAY_OPTIONS = [
  { value: 5, label: '5 seconds' },
  { value: 10, label: '10 seconds (default)' },
  { value: 15, label: '15 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '60 seconds' },
];

export function Settings(): JSX.Element {
  const auth = useAuthStore();
  const { autoPushDelay, setAutoPushDelay, changes } = useCommitQueue();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="font-display text-2xl font-bold">Settings</h1>

      <section className="glass rounded-2xl p-5">
        <h2 className="font-display text-base font-semibold mb-3">Account</h2>
        <div className="text-sm space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Partner</span>
            <span className="font-medium text-slate-800">{auth.partnerId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Consultant</span>
            <span className="font-medium text-slate-800">{auth.consultantSlug}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Data repo</span>
            <span className="font-mono text-xs text-slate-600">{auth.dataRepo}</span>
          </div>
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="font-display text-base font-semibold mb-3">Auto-push</h2>
        <p className="text-sm text-slate-500 mb-3">
          Changes are queued and pushed together after a period of inactivity.
          This reduces the number of commits when making rapid edits.
        </p>
        <FieldLabel label="Push delay" hint="Time after last change before auto-pushing">
          <Select
            value={autoPushDelay}
            onChange={(e) => setAutoPushDelay(parseInt(e.target.value, 10))}
          >
            {DELAY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </FieldLabel>
        {changes.length > 0 && (
          <div className="mt-3 text-sm text-amber-600">
            {changes.length} change{changes.length > 1 ? 's' : ''} pending
          </div>
        )}
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="font-display text-base font-semibold mb-3 text-red-600">Danger zone</h2>
        <Banner variant="warning">
          Signing out clears your token and sends you back to the first-run flow.
        </Banner>
        <div className="mt-3">
          <Button variant="danger" onClick={() => auth.signOut()}>Sign out</Button>
        </div>
      </section>
    </div>
  );
}
