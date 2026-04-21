import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { EffortItem } from '@/schema/types';
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
const PERSIST_VERSION = 1;   // bump when the rehydrated shape changes

// Pre-v6 persisted sessions carry effort_kind/effort_count scalars; v6 uses
// an effort: EffortItem[] array. Normalize any legacy shape on load so
// consumers that spread/iterate .effort don't crash with "not iterable".
type LegacyEffortShape = {
  effort?: EffortItem[];
  effort_kind?: string | null;
  effort_count?: number | null;
};

function normalizeEffort(obj: LegacyEffortShape | undefined | null): EffortItem[] {
  if (!obj) return [];
  if (Array.isArray(obj.effort)) return obj.effort;
  if (
    obj.effort_kind !== null && obj.effort_kind !== undefined &&
    obj.effort_count !== null && obj.effort_count !== undefined
  ) {
    return [{ kind: obj.effort_kind as EffortItem['kind'], count: obj.effort_count }];
  }
  return [];
}

function migratePersistedState(state: unknown): Pick<State, 'session' | 'history'> {
  const s = state as { session?: unknown; history?: unknown } | null | undefined;
  if (!s || typeof s !== 'object') return { session: null, history: [] };
  const sessionRaw = s.session as
    | (TimerSession & { snapshot?: LegacyEffortShape })
    | null
    | undefined;
  const session: TimerSession | null = sessionRaw
    ? {
        ...sessionRaw,
        snapshot: {
          ...(sessionRaw.snapshot as Form),
          effort: normalizeEffort(sessionRaw.snapshot),
        },
      }
    : null;
  const historyRaw = Array.isArray(s.history) ? (s.history as LegacyEffortShape[]) : [];
  const history: HistoricalRecording[] = historyRaw.map((rec) => ({
    ...(rec as HistoricalRecording),
    effort: normalizeEffort(rec),
  }));
  return { session, history };
}

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
      version: PERSIST_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ session: state.session, history: state.history }),
      // migrate runs when stored version < PERSIST_VERSION (e.g. pre-v6
      // builds that had no version field). onRehydrateStorage runs on
      // every rehydrate regardless of version — belt-and-suspenders so a
      // same-version stored blob missing effort[] still normalizes.
      migrate: (persistedState, _v) =>
        migratePersistedState(persistedState) as unknown as State,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const normalized = migratePersistedState(state);
        state.session = normalized.session;
        state.history = normalized.history;
      },
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
 * Test-only: simulates a page reload. Routes through zustand's real
 * rehydrate() so the migrate + merge path runs — a hand-rolled read-and-
 * setState would skip those and hide bugs like "pre-v6 session effort is
 * not iterable."
 */
export async function _rehydrateFromStorageForTests(): Promise<void> {
  await useTimerStore.persist.rehydrate();
}
