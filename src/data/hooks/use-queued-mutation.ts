import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCommitQueue } from '@/store/commit-queue';
import { qk } from '@/data/query-keys';

type QueuedMutationArgs<TArgs> = {
  /** Human-readable label shown in the FAB (e.g., "Edit entry sprosty") */
  label: (args: TArgs) => string;
  /** The actual async write operation */
  mutationFn: (args: TArgs) => Promise<void>;
  /** Query keys to invalidate after the entire queue flushes */
  invalidateKeys?: readonly (readonly unknown[])[];
};

/**
 * Drop-in replacement for useMutation that routes through the commit queue.
 *
 * Instead of executing immediately, the mutation is enqueued. The queue
 * batches changes and flushes after the auto-push delay, reducing commits
 * for rapid edits.
 *
 * Returns { mutate, isPending } matching the useMutation API shape so
 * screens can swap with minimal changes.
 */
export function useQueuedMutation<TArgs>(config: QueuedMutationArgs<TArgs>) {
  const enqueue = useCommitQueue((s) => s.enqueue);
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    (args: TArgs, options?: { onSuccess?: () => void }) => {
      setError(null);
      setIsPending(true);
      enqueue({
        label: config.label(args),
        execute: async () => {
          try {
            await config.mutationFn(args);
            // Invalidate caches after each successful write so the UI
            // stays fresh even while other queued changes are still pending.
            const keys = config.invalidateKeys ?? [qk.all];
            for (const key of keys) {
              queryClient.invalidateQueries({ queryKey: [...key] });
            }
            options?.onSuccess?.();
          } catch (e) {
            setError(e as Error);
            throw e;
          } finally {
            setIsPending(false);
          }
        },
      });
      // Mark as not-pending immediately since the queue handles execution.
      // The FAB shows the real commit status.
      setTimeout(() => setIsPending(false), 100);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enqueue, config, queryClient],
  );

  return { mutate, isPending, error };
}
