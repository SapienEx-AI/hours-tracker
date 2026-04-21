import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  startSession,
  pauseSession,
  resumeSession,
  stopSession,
  sessionToRecording,
  type TimerSession,
  type Form,
  type HistoricalRecording,
} from './timer-session';

type State = {
  session: TimerSession | null;
  history: HistoricalRecording[];
  start: (form: Form) => void;
  pause: () => void;
  resume: () => void;
  /** Stop the running/paused session: captures the final elapsed, archives
   *  it into history (capped at MAX_HISTORY, most recent first), AND keeps
   *  the session around in its stopped phase so the confirmation UI can
   *  render Load/Dismiss buttons. Returns the archived recording or null
   *  if no session was active. */
  stop: () => HistoricalRecording | null;
  /** Abort an in-progress session WITHOUT archiving — the ✕ during run. */
  abort: () => void;
  /** Update mutable fields on the current session's snapshot (project/bucket
   *  during inline edits). No-op if no session. */
  updateSnapshot: (
    updates: Partial<Pick<Form, 'projectId' | 'bucketId' | 'date' | 'effort'>>,
  ) => void;
  /** Remove a single historical recording by id. */
  removeHistory: (id: string) => void;
};

const STORAGE_KEY = 'hours_tracker.timer.v1';
const CHANNEL_NAME = 'hours_tracker.timer';
const MAX_HISTORY = 10;

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
      history: [],
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
        if (s === null) return null;
        // Archive to history and clear the session in one go — the recording
        // lives in Recent with a LATEST highlight so the user can redrive
        // without a dedicated confirmation banner.
        const stopped = stopSession(s, nowMs());
        const rec = sessionToRecording(stopped, nowIso());
        const nextHistory = [rec, ...get().history].slice(0, MAX_HISTORY);
        set({ session: null, history: nextHistory });
        broadcast({ kind: 'clear' });
        return rec;
      },
      abort: () => {
        // Abort discards without archiving — the ✕ in running/paused state.
        set({ session: null });
        broadcast({ kind: 'clear' });
      },
      updateSnapshot: (updates) => {
        const s = get().session;
        if (s === null) return;
        const next: TimerSession = {
          ...s,
          snapshot: { ...s.snapshot, ...updates },
        };
        set({ session: next });
        broadcast({ kind: 'replace', session: next });
      },
      removeHistory: (id) => {
        set({ history: get().history.filter((r) => r.id !== id) });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ session: state.session, history: state.history }),
      // Legacy stopped sessions from older builds are now expected again,
      // so no rehydration migration needed — stop() archives + keeps the
      // session for the confirmation UI.
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
