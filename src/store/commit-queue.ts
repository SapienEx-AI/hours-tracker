import { create } from 'zustand';

const STORAGE_KEY = 'sapienex:hours-tracker:auto_push_delay';
const DEFAULT_DELAY = 10;

export type PendingChange = {
  id: string;
  label: string;
  timestamp: number;
  execute: () => Promise<void>;
};

export type QueueStatus = 'idle' | 'pending' | 'flushing' | 'done';

export type CommitQueueState = {
  status: QueueStatus;
  changes: PendingChange[];
  autoPushDelay: number; // seconds
  flushTimerEnd: number | null; // timestamp when auto-flush fires
  flushError: string | null;

  enqueue: (change: Omit<PendingChange, 'id' | 'timestamp'>) => void;
  flush: () => Promise<void>;
  setAutoPushDelay: (seconds: number) => void;
  clearTimer: () => void;
};

let timerId: ReturnType<typeof setTimeout> | null = null;

function getDelay(): number {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored ? parseInt(stored, 10) : DEFAULT_DELAY;
}

export const useCommitQueue = create<CommitQueueState>((set, get) => ({
  status: 'idle',
  changes: [],
  autoPushDelay: getDelay(),
  flushTimerEnd: null,
  flushError: null,

  enqueue(change) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: PendingChange = { ...change, id, timestamp: Date.now() };
    set((s) => ({
      status: 'pending',
      changes: [...s.changes, entry],
      flushError: null,
    }));

    // Reset the auto-flush timer on every new change.
    if (timerId !== null) clearTimeout(timerId);
    const delay = get().autoPushDelay * 1000;
    const end = Date.now() + delay;
    set({ flushTimerEnd: end });
    timerId = setTimeout(() => {
      get().flush();
    }, delay);
  },

  async flush() {
    const { changes } = get();
    if (changes.length === 0) return;
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    set({ status: 'flushing', flushTimerEnd: null });

    try {
      // Execute each pending change in order.
      for (const change of changes) {
        await change.execute();
      }
      set({ status: 'done', changes: [], flushError: null });
      // After a brief "done" state, return to idle.
      setTimeout(() => {
        const current = get();
        if (current.status === 'done' && current.changes.length === 0) {
          set({ status: 'idle' });
        }
      }, 2000);
    } catch (e) {
      set({ status: 'pending', flushError: (e as Error).message });
    }
  },

  setAutoPushDelay(seconds) {
    window.localStorage.setItem(STORAGE_KEY, String(seconds));
    set({ autoPushDelay: seconds });
  },

  clearTimer() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    set({ flushTimerEnd: null });
  },
}));
