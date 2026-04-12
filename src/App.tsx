import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { loadPartner } from '@/partner/load-partner';
import { applyPartnerTheme } from '@/partner/apply-theme';
import type { Partner } from '@/schema/types';
import { AppShell } from '@/ui/layout/AppShell';
import { Banner } from '@/ui/components/Banner';
import { ErrorBoundary } from '@/ui/ErrorBoundary';
import { FirstRun } from '@/ui/screens/FirstRun';
import { QuickLog } from '@/ui/screens/QuickLog';
import { Dashboard } from '@/ui/screens/Dashboard';
import { Entries } from '@/ui/screens/Entries';
import { ProjectsAndBuckets } from '@/ui/screens/ProjectsAndBuckets';
import { Rates } from '@/ui/screens/Rates';
import { Snapshots } from '@/ui/screens/Snapshots';
import { Settings } from '@/ui/screens/Settings';
import { useRoute, type Route } from '@/ui/Router';

function ScreenForRoute({
  route,
  partner,
}: {
  route: Route;
  partner: Partner;
}): JSX.Element {
  switch (route) {
    case 'log':
      return <QuickLog />;
    case 'dashboard':
      return <Dashboard partner={partner} />;
    case 'entries':
      return <Entries partner={partner} />;
    case 'projects':
      return <ProjectsAndBuckets partner={partner} />;
    case 'rates':
      return <Rates partner={partner} />;
    case 'snapshots':
      return <Snapshots partner={partner} />;
    case 'settings':
      return <Settings />;
    default:
      return <QuickLog />;
  }
}

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
      <ErrorBoundary>
        <ScreenForRoute route={route} partner={partner} />
      </ErrorBoundary>
    </AppShell>
  );
}
