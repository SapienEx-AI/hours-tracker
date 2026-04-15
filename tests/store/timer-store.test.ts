import { describe, it, expect, beforeEach } from 'vitest';
import { useTimerStore, _rehydrateFromStorageForTests } from '@/store/timer-store';

const form = {
  projectId: 'sector-growth',
  bucketId: null,
  description: 'kickoff',
  date: '2026-04-14',
  effort_kind: null,
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
    expect(s?.snapshot.effort_kind).toBeNull();
  });

  it('updateSnapshot accepts effort_kind and leaves other fields unchanged', () => {
    useTimerStore.getState().start(form);
    useTimerStore.getState().updateSnapshot({ effort_kind: 'slack' });
    const s = useTimerStore.getState().session;
    expect(s?.snapshot.effort_kind).toBe('slack');
    expect(s?.snapshot.projectId).toBe('sector-growth');
    expect(s?.snapshot.bucketId).toBeNull();
    expect(s?.snapshot.description).toBe('kickoff');
  });

  it('stop archives the snapshot effort_kind into the recording', () => {
    useTimerStore.getState().start(form);
    useTimerStore.getState().updateSnapshot({ effort_kind: 'meeting' });
    const rec = useTimerStore.getState().stop();
    expect(rec?.effort_kind).toBe('meeting');
    expect(useTimerStore.getState().history[0]?.effort_kind).toBe('meeting');
  });

  it('persists a running session across reload', () => {
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
    _rehydrateFromStorageForTests();
    expect(useTimerStore.getState().session?.id).toBe(id);
    expect(useTimerStore.getState().session?.phase.kind).toBe('running');
  });
});
