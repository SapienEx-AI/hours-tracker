import { useEffect, useState } from 'react';
import { loadPartnersIndex } from '@/partner/load-partner';
import type { PartnersIndex } from '@/schema/types';
import { Button } from '@/ui/components/Button';
import { Select } from '@/ui/components/Select';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { Banner } from '@/ui/components/Banner';

type Props = {
  onNext: (partnerId: string) => void;
};

export function PartnerStep({ onNext }: Props): JSX.Element {
  const [index, setIndex] = useState<PartnersIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    loadPartnersIndex()
      .then((i) => {
        setIndex(i);
        const firstEnabled = i.partners.find((p) => p.enabled);
        if (firstEnabled) setSelected(firstEnabled.id);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <Banner variant="error">{error}</Banner>;
  if (!index) return <div className="text-partner-muted">Loading organizations…</div>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl">Who are you logging hours for?</h1>
      <FieldLabel label="Organization">
        <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {index.partners
            .filter((p) => p.enabled)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
        </Select>
      </FieldLabel>
      <p className="text-xs text-partner-muted">
        Don&apos;t see your org? Contact SapienEx support.
      </p>
      <Button onClick={() => onNext(selected)} disabled={!selected}>
        Continue →
      </Button>
    </div>
  );
}
