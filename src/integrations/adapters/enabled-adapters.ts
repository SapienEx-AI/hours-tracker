import type { DigestRow, EffortSourceAdapter, SourceKind } from './types';

export type DigestError = { readonly source: SourceKind; readonly message: string };
export type ComposeResult = {
  readonly rows: readonly DigestRow[];
  readonly errors: readonly DigestError[];
};

export async function composeDigest(
  adapters: readonly EffortSourceAdapter[],
  date: string,
): Promise<ComposeResult> {
  const settled = await Promise.allSettled(adapters.map((a) => a.fetchDailyDigest(date)));
  const rows: DigestRow[] = [];
  const errors: DigestError[] = [];
  settled.forEach((r, i) => {
    const source = adapters[i]!.source;
    if (r.status === 'fulfilled') {
      rows.push(...r.value);
    } else {
      errors.push({
        source,
        message: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  });
  return { rows, errors };
}
