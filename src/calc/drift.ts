import type { Entry, Snapshot } from '@/schema/types';
import { hashEntries } from './hash';

export type DriftDiff = {
  drifted: boolean;
  expectedHash: string;
  actualHash: string;
  added: Entry[];
  removed: string[];
  changed: Entry[];
};

export async function computeDrift(
  snapshot: Snapshot,
  currentEntries: Entry[],
): Promise<DriftDiff> {
  const actualHash = await hashEntries(currentEntries);
  const expectedHash = snapshot.source_hash;
  if (actualHash === expectedHash) {
    return {
      drifted: false,
      expectedHash,
      actualHash,
      added: [],
      removed: [],
      changed: [],
    };
  }

  const snapshotIds = new Set(snapshot.entry_ids);
  const currentById = new Map(currentEntries.map((e) => [e.id, e]));

  const added = currentEntries.filter((e) => !snapshotIds.has(e.id));
  const removed = snapshot.entry_ids.filter((id) => !currentById.has(id));
  const changed: Entry[] =
    added.length === 0 && removed.length === 0
      ? currentEntries.filter((e) => snapshotIds.has(e.id))
      : [];

  return { drifted: true, expectedHash, actualHash, added, removed, changed };
}
