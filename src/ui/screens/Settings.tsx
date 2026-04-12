import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/ui/components/Button';
import { Banner } from '@/ui/components/Banner';

export function Settings(): JSX.Element {
  const auth = useAuthStore();
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h1 className="font-display text-2xl">Settings</h1>
      <section className="font-mono text-sm space-y-1">
        <div>
          <span className="text-partner-muted">partner_id:</span> {auth.partnerId}
        </div>
        <div>
          <span className="text-partner-muted">consultant_slug:</span> {auth.consultantSlug}
        </div>
        <div>
          <span className="text-partner-muted">data_repo:</span> {auth.dataRepo}
        </div>
      </section>
      <Banner variant="warning">
        Signing out clears your token and sends you back to the first-run flow.
      </Banner>
      <Button variant="danger" onClick={() => auth.signOut()}>
        Sign out
      </Button>
    </div>
  );
}
