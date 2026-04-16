/**
 * Wrapper that conditionally applies the per-field magic-fill animation
 * to its children. Used by LogForm to wrap fields that just received a
 * value from one of the Assist-panel sources (Timer, Calendar,
 * QuickActivity, historical redrive).
 */

// Stagger order for the magic-fill cascade. Matches the visual top-to-bottom
// field order so the sweep streak and per-field pulses stay in sync.
export const FLASH_ORDER: ReadonlyArray<string> = [
  'date',
  'projectId',
  'effort',
  'hoursHundredths',
  'bucketId',
  'description',
];

export type FlashTone = { r: number; g: number; b: number } | null;

type Props = {
  field: string;
  flashFields: ReadonlySet<string>;
  nonce: number;
  tone: FlashTone;
  children: React.ReactNode;
};

export function FieldFlash({
  field,
  flashFields,
  nonce,
  tone,
  children,
}: Props): JSX.Element {
  const shouldFlash = nonce > 0 && flashFields.has(field);
  if (!shouldFlash) return <>{children}</>;
  const idx = FLASH_ORDER.indexOf(field);
  const delayMs = idx >= 0 ? idx * 90 : 0;
  const toneStyle =
    tone !== null
      ? ({
          '--magic-r': tone.r,
          '--magic-g': tone.g,
          '--magic-b': tone.b,
        } as React.CSSProperties)
      : {};
  return (
    <div
      key={`${field}-${nonce}`}
      className="anim-field-magic"
      style={{ '--field-delay': `${delayMs}ms`, ...toneStyle } as React.CSSProperties}
    >
      <span className="anim-field-shimmer" />
      {children}
    </div>
  );
}
