import { useEffect, useState } from 'react';
import { loadPartner } from '@/partner/load-partner';
import { applyPartnerTheme } from '@/partner/apply-theme';
import { makeOctokit } from '@/data/octokit-client';
import type { Partner } from '@/schema/types';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { Banner } from '@/ui/components/Banner';
import { validateDataRepo } from './validate-data-repo';
import { ConnectInstructions } from './ConnectInstructions';
import { useAuthStore } from '@/store/auth-store';

const OWNER = 'SapienEx-AI';

type Props = {
  partnerId: string;
  onBack: () => void;
};

function getLogoStyle(partner: Partner): React.CSSProperties {
  const base: React.CSSProperties = { height: '40px', width: 'auto' };
  if (partner.theme.mode === 'dark' && partner.assets.logo_dark_filter) {
    return { ...base, filter: partner.assets.logo_dark_filter };
  }
  return base;
}

function sanitizeSlug(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

async function attemptConnect(args: {
  partner: Partner;
  partnerId: string;
  token: string;
  slug: string;
}): Promise<{ ok: true; dataRepo: string } | { ok: false; error: string }> {
  const octokit = makeOctokit(args.token);
  const repo = `${args.partner.data_repo_prefix}${args.slug}`;
  const result = await validateDataRepo(octokit, {
    owner: OWNER,
    repo,
    partnerId: args.partnerId,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, dataRepo: `${OWNER}/${repo}` };
}

export function ConnectStep({ partnerId, onBack }: Props): JSX.Element {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [consultantSlug, setConsultantSlug] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const completeFirstRun = useAuthStore((s) => s.completeFirstRun);

  useEffect(() => {
    loadPartner(partnerId)
      .then((p) => {
        setPartner(p);
        applyPartnerTheme(p);
      })
      .catch((e: Error) => setError(e.message));
  }, [partnerId]);

  if (error && !partner) return <Banner variant="error">{error}</Banner>;
  if (!partner) return <div className="text-slate-500">Loading partner…</div>;

  const computedRepo = `${OWNER}/${partner.data_repo_prefix}${consultantSlug}`;

  async function handleConnect() {
    if (!partner) return;
    setError(null);
    setBusy(true);
    try {
      const result = await attemptConnect({
        partner,
        partnerId,
        token,
        slug: consultantSlug,
      });
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      completeFirstRun({
        partnerId,
        consultantSlug,
        dataRepo: result.dataRepo,
        token,
      });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <img
        src={`${import.meta.env.BASE_URL}partners/${partner.id}/${partner.assets.logo}`}
        alt={partner.display_name}
        style={getLogoStyle(partner)}
      />
      <h1 className="font-display text-2xl">Connect your GitHub data repo</h1>
      <ConnectInstructions computedRepo={computedRepo} />
      <FieldLabel label="Consultant slug" hint="lowercase, numbers, dashes only — e.g. prash">
        <Input
          value={consultantSlug}
          onChange={(e) => setConsultantSlug(sanitizeSlug(e.target.value))}
        />
      </FieldLabel>
      <FieldLabel label="Personal Access Token">
        <Input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="github_pat_..."
        />
      </FieldLabel>
      {error && <Banner variant="error">{error}</Banner>}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack} disabled={busy}>
          ← Back
        </Button>
        <Button onClick={handleConnect} disabled={busy || !consultantSlug || !token}>
          {busy ? 'Connecting…' : 'Connect →'}
        </Button>
      </div>
    </div>
  );
}
