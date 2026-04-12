import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useRates } from '@/data/hooks/use-rates';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useAuthStore } from '@/store/auth-store';
import { writeRates } from '@/data/rates-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { configAddRateMessage } from '@/data/commit-messages';
import { formatCents } from '@/format/format';
import type { Partner } from '@/schema/types';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { Banner } from '@/ui/components/Banner';
import { qk } from '@/data/query-keys';

export function Rates({ partner }: { partner: Partner }): JSX.Element {
  const rates = useRates();
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const queryClient = useQueryClient();
  const [dollars, setDollars] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  const currency = {
    currency_symbol: partner.currency_symbol,
    currency_display_suffix: partner.currency_display_suffix,
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!octokit || !dataRepo || !rates.data) throw new Error('Not ready');
      const { owner, repo } = splitRepoPath(dataRepo);
      const rateCents = Math.round(parseFloat(dollars) * 100);
      await writeRates(octokit, {
        owner,
        repo,
        data: {
          ...rates.data,
          default_rate_history: [
            ...rates.data.default_rate_history,
            { effective_from: effectiveFrom, rate_cents: rateCents, note },
          ],
        },
        message: configAddRateMessage(rateCents, effectiveFrom),
      });
    },
    onSuccess: () => {
      setDollars('');
      setNote('');
      queryClient.invalidateQueries({ queryKey: qk.rates(dataRepo ?? 'none') });
    },
  });

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <h1 className="font-display text-2xl">Rates</h1>
      <table className="w-full font-mono text-sm">
        <thead>
          <tr className="text-left text-partner-muted">
            <th>Effective from</th>
            <th>Rate</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {rates.data?.default_rate_history.map((r) => (
            <tr key={r.effective_from} className="border-t border-black/5">
              <td className="py-1">{r.effective_from}</td>
              <td className="py-1">{formatCents(r.rate_cents, currency)}</td>
              <td className="py-1 text-partner-muted">{r.note ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section className="flex items-end gap-2">
        <FieldLabel label="New rate (dollars)">
          <Input
            type="number"
            step="0.01"
            value={dollars}
            onChange={(e) => setDollars(e.target.value)}
          />
        </FieldLabel>
        <FieldLabel label="Effective from">
          <Input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
        </FieldLabel>
        <FieldLabel label="Note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </FieldLabel>
        <Button onClick={() => addMutation.mutate()} disabled={!dollars || addMutation.isPending}>
          Add
        </Button>
      </section>
      {addMutation.error && (
        <Banner variant="error">{(addMutation.error as Error).message}</Banner>
      )}
      <Banner variant="info">
        Bulk rate update tool (spec §7 row 9) lands in post-MVP.
      </Banner>
    </div>
  );
}
