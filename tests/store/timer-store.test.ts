import { describe, it, expect, beforeEach } from 'vitest';
import { useTimerStore, _rehydrateFromStorageForTests } from '@/store/timer-store';

const form = {
  projectId: 'sector-growth',
  bucketId: null,
  description: 'kickoff',
  date: '2026-04-14',
};

describe('timer-store', () => {
  beforeEach(() => {
    localStorage.clear();
    useTimerStore.setState({ session: null });
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

  it('pause → resume → stop transitions update phase kind', () => {
    useTimerStore.getState().start(form);
    useTimerStore.getState().pause();
    expect(useTimerStore.getState().session?.phase.kind).toBe('paused');
    useTimerStore.getState().resume();
    expect(useTimerStore.getState().session?.phase.kind).toBe('running');
    useTimerStore.getState().stop();
    expect(useTimerStore.getState().session?.phase.kind).toBe('stopped');
  });

  it('abort clears the session from state', () => {
    useTimerStore.getState().start(form);
    useTimerStore.getState().abort();
    expect(useTimerStore.getState().session).toBeNull();
  });

  it('discard after stop clears the session', () => {
    useTimerStore.getState().start(form);
    useTimerStore.getState().stop();
    useTimerStore.getState().discard();
    expect(useTimerStore.getState().session).toBeNull();
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
