type Props = {
  computedRepo: string;
};

export function ConnectInstructions({ computedRepo }: Props): JSX.Element {
  return (
    <>
      <p className="font-body text-sm text-partner-muted">
        You need a fine-grained Personal Access Token scoped to your private data repo{' '}
        <span className="font-mono">{computedRepo || '(enter slug below)'}</span>.
      </p>
      <ol className="list-decimal list-inside font-body text-sm text-partner-muted space-y-1">
        <li>
          <a
            className="underline hover:text-partner-cyan"
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noreferrer"
          >
            Open GitHub token settings ↗
          </a>
        </li>
        <li>
          Name: <span className="font-mono">hours-tracker</span>
        </li>
        <li>
          Repository access → &quot;Only select repositories&quot; →{' '}
          <span className="font-mono">{computedRepo || 'your repo'}</span>
        </li>
        <li>Permissions → Contents: Read and write</li>
        <li>Generate and paste below.</li>
      </ol>
    </>
  );
}
