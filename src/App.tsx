import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { loadPartner } from '@/partner/load-partner';
import { applyPartnerTheme } from '@/partner/apply-theme';
import type { Partner } from '@/schema/types';
import { AppShell } from '@/ui/layout/AppShell';
import { Banner } from '@/ui/components/Banner';
import { FirstRun } from '@/ui/screens/FirstRun';
import { useRoute } from '@/ui/Router';

export default function App(): JSX.Element {
  const auth = useAuthStore();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [partnerError, setPartnerError] = useState<string | null>(null);
  const [route, setRoute] = useRoute();

  // Rehydrate auth on mount.
  useEffect(() => {
    auth.rehydrateFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load + apply partner theme when partnerId becomes known.
  useEffect(() => {
    if (!auth.partnerId) return;
    let cancelled = false;
    loadPartner(auth.partnerId)
      .then((p) => {
        if (cancelled) return;
        setPartner(p);
        applyPartnerTheme(p);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setPartnerError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.partnerId]);

  if (!auth.partnerId || !auth.token) return <FirstRun />;
  if (partnerError) {
    return (
      <div className="p-6">
        <Banner variant="error">Failed to load partner: {partnerError}</Banner>
      </div>
    );
  }
  if (!partner) {
    return <div className="p-6 text-partner-muted">Loading partner…</div>;
  }

  return (
    <AppShell
      partner={partner}
      consultantDisplayName={auth.consultantSlug ?? ''}
      onSignOut={() => auth.signOut()}
      route={route}
      onNavigate={setRoute}
    >
      <div className="text-partner-muted font-mono text-sm">
        Route: <span className="text-partner-text">{route}</span>. Screens land in Phase 8.
      </div>
    </AppShell>
  );
}
