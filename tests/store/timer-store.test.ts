import { describe, it, expect, beforeEach } from 'vitest';
import { useTimerStore, _rehydrateFromStorageForTests } from '@/store/timer-store';

const form = {
  projectId: 'sector-growth',
  bucketId: null,
  description: 'kickoff',
  date: '2026-04-14',
  effort: [],
};

describe('timer-store', () => {
  beforeEach(() => {
    localStorage.clear();
    useTimerStore.setState({ session: null, history: [] });
  });

  it('starts a session and exposes it via state', () => {
    useTimerStore.getState().start(form);
    const s = useTimerStore.getState().session;
    expect(s).not.toBeNull();
    expect(s?.snapshot.projectId).toBe('sector-growth');
    expect(s?.phase.kind).toBe('running');
  });

  it('blocks a second start while a session is active (no-op)', () => {
    useTimerStore.getState().start(form);
    const first = useTimerStore.getState().session;
    useTimerStore.getState().start({ ...form, projectId: 'acme' });
    const second = useTimerStore.getState().session;
    expect(second?.id).toBe(first?.id);
    expect(second?.snapshot.projectId).toBe('sector-growth');
  });

  it('pause → resume transitions update phase kind', () => {
    useTimerStore.getState().start(form);
    useTimerStore.getState().pause();
    expect(useTimerStore.getState().session?.phase.kind).toBe('paused');
    useTimerStore.getState().resume();
    expect(useTimerStore.getState().session?.phase.kind).toBe('running');
  });

  it('stop archives the session into history and clears the active session', () => {
    useTimerStore.getState().start(form);
    const id = useTimerStore.getState().session?.id;
    const rec = useTimerStore.getState().stop();
    expect(rec?.id).toBe(id);
    expect(useTimerStore.getState().history[0]?.id).toBe(id);
    expect(useTimerStore.getState().history).toHaveLength(1);
    expect(useTimerStore.getState().session).toBeNull();
  });

  it('abort clears the session from state without archiving', () => {
    useTimerStore.getState().start(form);
    useTimerStore.getState().abort();
    expect(useTimerStore.getState().session).toBeNull();
    expect(useTimerStore.getState().history).toHaveLength(0);
  });

  it('history is capped at 10 entries, newest-first', () => {
    for (let i = 0; i < 12; i++) {
      useTimerStore.getState().start({ ...form, description: `run ${i}` });
      useTimerStore.getState().stop();
    }
    expect(useTimerStore.getState().history).toHaveLength(10);
  });

  it('removeHistory drops a single entry by id', () => {
    useTimerStore.getState().start(form);
    const rec = useTimerStore.getState().stop();
    expect(rec).not.toBeNull();
    useTimerStore.getState().removeHistory(rec!.id);
    expect(useTimerStore.getState().history).toHaveLength(0);
  });

  it('updateSnapshot mutates only the current session snapshot fields', () => {
    useTimerStore.getState().start(form);
    useTimerStore.getState().updateSnapshot({ projectId: 'acme', bucketId: null });
    const s = useTimerStore.getState().session;
    expect(s?.snapshot.projectId).toBe('acme');
    expect(s?.snapshot.bucketId).toBeNull();
    // Unaffected fields preserved:
    expect(s?.snapshot.description).toBe('kickoff');
    expect(s?.snapshot.effort).toEqual([]);
  });

  it('updateSnapshot accepts effort and leaves other fields unchanged', () => {
    useTimerStore.getState().start(form);
    useTimerStore.getState().updateSnapshot({ effort: [{ kind: 'slack', count: 1 }] });
    const s = useTimerStore.getState().session;
    expect(s?.snapshot.effort).toEqual([{ kind: 'slack', count: 1 }]);
    expect(s?.snapshot.projectId).toBe('sector-growth');
    expect(s?.snapshot.bucketId).toBeNull();
    expect(s?.snapshot.description).toBe('kickoff');
  });

  it('stop archives the snapshot effort into the recording', () => {
    useTimerStore.getState().start(form);
    useTimerStore.getState().updateSnapshot({ effort: [{ kind: 'meeting', count: 1 }] });
    const rec = useTimerStore.getState().stop();
    expect(rec?.effort).toEqual([{ kind: 'meeting', count: 1 }]);
    expect(useTimerStore.getState().history[0]?.effort).toEqual([{ kind: 'meeting', count: 1 }]);
  });

  it('normalizes a pre-v6 persisted session (effort_kind/effort_count) into effort: []', async () => {
    // Simulate a timer session persisted by an older build — no effort array,
    // scalar effort_kind/effort_count fields still present. Rehydrate must
    // not crash and must produce an iterable effort array.
    const legacy = {
      state: {
        session: {
          id: 'legacy-sid',
          started_wall: '2026-04-10T12:00:00Z',
          snapshot: {
            projectId: 'sector-growth',
            bucketId: null,
            description: 'legacy',
            date: '2026-04-10',
            effort_kind: 'slack',
            effort_count: 3,
          },
          phase: { kind: 'running', started_at: Date.now(), base_elapsed_ms: 0 },
        },
        history: [
          {
            id: 'legacy-rec-1',
            started_wall: '2026-04-09T12:00:00Z',
            archived_wall: '2026-04-09T13:00:00Z',
            project_id: 'sector-growth',
            bucket_id: null,
            date: '2026-04-09',
            elapsed_ms: 3600000,
            effort_kind: 'meeting',
            effort_count: 1,
          },
          {
            id: 'legacy-rec-2',
            started_wall: '2026-04-08T12:00:00Z',
            archived_wall: '2026-04-08T13:00:00Z',
            project_id: 'sector-growth',
            bucket_id: null,
            date: '2026-04-08',
            elapsed_ms: 1800000,
            // Deliberately missing BOTH effort fields — mimics a pre-v5 session.
          },
        ],
      },
      version: 0,
    };
    // Order matters: setState triggers persist serialization back to
    // localStorage, which would wipe the legacy fixture. Set in-memory
    // state to empty FIRST, then seed the fixture, then rehydrate.
    useTimerStore.setState({ session: null, history: [] });
    localStorage.setItem('hours_tracker.timer.v1', JSON.stringify(legacy));
    await _rehydrateFromStorageForTests();
    const state = useTimerStore.getState();
    expect(Array.isArray(state.session?.snapshot.effort)).toBe(true);
    expect(state.session?.snapshot.effort).toEqual([{ kind: 'slack', count: 3 }]);
    expect(state.history).toHaveLength(2);
    expect(state.history[0]?.effort).toEqual([{ kind: 'meeting', count: 1 }]);
    expect(state.history[1]?.effort).toEqual([]);
    // Spreading the legacy effort must work — this is the regression that
    // surfaced in prod as "A.effort is not iterable".
    expect(() => [...(state.session?.snapshot.effort ?? [])]).not.toThrow();
    expect(() => state.history.map((r) => [...r.effort])).not.toThrow();
  });

  it('persists a running session across reload', async () => {
    useTimerStore.getState().start(form);
    const id = useTimerStore.getState().session?.id;
    // Snapshot persisted JSON before wiping in-memory state. The setState
    // below would also overwrite localStorage with null via persist
    // middleware — restore the snapshot before rehydrating to simulate
    // an actual page reload.
    const persisted = localStorage.getItem('hours_tracker.timer.v1');
    expect(persisted).not.toBeNull();
    useTimerStore.setState({ session: null });
    localStorage.setItem('hours_tracker.timer.v1', persisted!);
    await _rehydrateFromStorageForTests();
    expect(useTimerStore.getState().session?.id).toBe(id);
    expect(useTimerStore.getState().session?.phase.kind).toBe('running');
  });
});
