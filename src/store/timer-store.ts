import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  startSession,
  pauseSession,
  resumeSession,
  stopSession,
  type TimerSession,
  type Form,
} from './timer-session';

type State = {
  session: TimerSession | null;
  start: (form: Form) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  abort: () => void;
  discard: () => void;
};

const STORAGE_KEY = 'hours_tracker.timer.v1';
const CHANNEL_NAME = 'hours_tracker.timer';

function nowMs(): number {
  return Date.now();
}

function nowIso(): string {
  return new Date().toISOString();
}

export const useTimerStore = create<State>()(
  persist(
    (set, get) => ({
      session: null,
      start: (form) => {
        if (get().session !== null) return; // one active session at a time
        const next = startSession({ now: nowMs(), wallIso: nowIso(), form });
        set({ session: next });
        broadcast({ kind: 'replace', session: next });
      },
      pause: () => {
        const s = get().session;
        if (s === null) return;
        const next = pauseSession(s, nowMs());
        set({ session: next });
        broadcast({ kind: 'replace', session: next });
      },
      resume: () => {
        const s = get().session;
        if (s === null) return;
        const next = resumeSession(s, nowMs());
        set({ session: next });
        broadcast({ kind: 'replace', session: next });
      },
      stop: () => {
        const s = get().session;
        if (s === null) return;
        const next = stopSession(s, nowMs());
        set({ session: next });
        broadcast({ kind: 'replace', session: next });
      },
      abort: () => {
        set({ session: null });
        broadcast({ kind: 'clear' });
      },
      discard: () => {
        set({ session: null });
        broadcast({ kind: 'clear' });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ session: state.session }),
    },
  ),
);

// ─── Cross-tab broadcast ───

type Message =
  | { kind: 'replace'; session: TimerSession }
  | { kind: 'clear' };

let channel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<Message>) => {
      const msg = event.data;
      if (msg.kind === 'replace') {
        useTimerStore.setState({ session: msg.session });
      } else if (msg.kind === 'clear') {
        useTimerStore.setState({ session: null });
      }
    };
  }
} catch {
  channel = null;
}

function broadcast(msg: Message): void {
  if (channel !== null) channel.postMessage(msg);
}

/**
 * Test-only: simulates a page reload by reading localStorage back into the
 * store. The persist middleware does this automatically on first import,
 * but tests want to exercise rehydrate after they wipe in-memory state.
 */
export function _rehydrateFromStorageForTests(): void {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return;
  try {
    const parsed = JSON.parse(raw) as { state: { session: TimerSession | null } };
    if (parsed.state?.session !== undefined) {
      useTimerStore.setState({ session: parsed.state.session });
    }
  } catch {
    // corrupt storage — leave state alone
  }
}
