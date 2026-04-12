import { useState } from 'react';
import { PartnerStep } from './first-run/PartnerStep';
import { ConnectStep } from './first-run/ConnectStep';

export function FirstRun(): JSX.Element {
  const [step, setStep] = useState<'partner' | 'connect'>('partner');
  const [partnerId, setPartnerId] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xl glass-strong rounded-2xl p-8 glow-cyan">
        {step === 'partner' && (
          <PartnerStep
            onNext={(id) => {
              setPartnerId(id);
              setStep('connect');
            }}
          />
        )}
        {step === 'connect' && partnerId && (
          <ConnectStep partnerId={partnerId} onBack={() => setStep('partner')} />
        )}
      </div>
    </div>
  );
}
