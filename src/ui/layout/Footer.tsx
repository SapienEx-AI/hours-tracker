/**
 * Footer — the ONLY place in the app where "SapienEx" appears in branding.
 * Spec §8.1: muted text color, 11px, no logo, one line, zero visual weight.
 */
export function Footer(): JSX.Element {
  return (
    <footer className="px-6 py-3 border-t border-partner-border-subtle flex justify-end">
      <span className="font-body text-[11px] text-partner-muted">
        Powered by <span className="font-mono">SapienEx</span>
      </span>
    </footer>
  );
}
