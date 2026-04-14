import { describe, it, expect } from 'vitest';
import {
  liveElapsedMs,
  msToHundredths,
  snapshotFromForm,
  startSession,
  pauseSession,
  resumeSession,
  stopSession,
} from '@/store/timer-session';

const formLike = {
  projectId: 'sector-growth',
  bucketId: 'discovery' as string | null,
  description: 'kickoff',
  date: '2026-04-14',
};

describe("msToHundredths (banker's rounding to nearest 0.01h)", () => {
  it('converts exactly one hour to 100 hundredths', () => {
    expect(msToHundredths(3600000)).toBe(100);
  });
  it('converts 30 minutes to 50 hundredths', () => {
    expect(msToHundredths(1800000)).toBe(50);
  });
  it('converts 36 seconds (0.01h exact) to 1', () => {
    expect(msToHundredths(36000)).toBe(1);
  });
  it('rounds 17999 ms (just under half a hundredth) to 0', () => {
    expect(msToHundredths(17999)).toBe(0);
  });
  it("rounds 18000 ms (exactly half) using banker's rule to 0 (even)", () => {
    expect(msToHundredths(18000)).toBe(0);
  });
  it("rounds 54000 ms (exactly 1.5 hundredths) using banker's rule to 2 (even)", () => {
    expect(msToHundredths(54000)).toBe(2);
  });
  it('clamps above-24h to 2400', () => {
    expect(msToHundredths(3600000 * 25)).toBe(2400);
  });
  it('returns 0 for zero or negative ms', () => {
    expect(msToHundredths(0)).toBe(0);
    expect(msToHundredths(-500)).toBe(0);
  });
});

describe('snapshotFromForm', () => {
  it('captures projectId, bucketId, description, and date verbatim', () => {
    expect(snapshotFromForm(formLike)).toEqual(formLike);
  });
});

describe('startSession', () => {
  it('produces a Running session with zeroed base_elapsed_ms and captured snapshot', () => {
    const now = 1712000000000;
    const s = startSession({ now, wallIso: '2026-04-14T09:17:00Z', form: formLike });
    expect(s.phase.kind).toBe('running');
    if (s.phase.kind === 'running') {
      expect(s.phase.started_at).toBe(now);
      expect(s.phase.base_elapsed_ms).toBe(0);
    }
    expect(s.snapshot).toEqual(formLike);
    expect(s.started_wall).toBe('2026-04-14T09:17:00Z');
    expect(s.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('liveElapsedMs', () => {
  it('returns 0 when phase kind is idle (defensive)', () => {
    expect(liveElapsedMs({ kind: 'idle' })).toBe(0);
  });
  it('returns base_elapsed_ms + (now - started_at) when Running', () => {
    expect(
      liveElapsedMs({ kind: 'running', started_at: 1000, base_elapsed_ms: 500 }, 2500),
    ).toBe(2000);
  });
  it('returns frozen elapsed_ms when Paused', () => {
    expect(liveElapsedMs({ kind: 'paused', elapsed_ms: 9999 })).toBe(9999);
  });
  it('returns frozen elapsed_ms when Stopped', () => {
    expect(liveElapsedMs({ kind: 'stopped', elapsed_ms: 12345 })).toBe(12345);
  });
});

describe('pauseSession / resumeSession / stopSession', () => {
  it('pause freezes the live elapsed at the moment of the call', () => {
    const s = startSession({ now: 1000, wallIso: '', form: formLike });
    const paused = pauseSession(s, 2500);
    expect(paused.phase.kind).toBe('paused');
    if (paused.phase.kind === 'paused') expect(paused.phase.elapsed_ms).toBe(1500);
  });

  it('resume starts a fresh Running with base_elapsed_ms = frozen paused value', () => {
    const s = startSession({ now: 1000, wallIso: '', form: formLike });
    const paused = pauseSession(s, 2500);
    const resumed = resumeSession(paused, 5000);
    expect(resumed.phase.kind).toBe('running');
    if (resumed.phase.kind === 'running') {
      expect(resumed.phase.base_elapsed_ms).toBe(1500);
      expect(resumed.phase.started_at).toBe(5000);
    }
  });

  it('stop freezes elapsed whether called from Running or Paused', () => {
    const s = startSession({ now: 1000, wallIso: '', form: formLike });
    const stoppedFromRunning = stopSession(s, 3500);
    if (stoppedFromRunning.phase.kind === 'stopped') {
      expect(stoppedFromRunning.phase.elapsed_ms).toBe(2500);
    }
    const paused = pauseSession(s, 3500);
    const stoppedFromPaused = stopSession(paused, 9999);
    if (stoppedFromPaused.phase.kind === 'stopped') {
      expect(stoppedFromPaused.phase.elapsed_ms).toBe(2500);
    }
  });

  it('snapshot is byte-identical across all transitions', () => {
    const s = startSession({ now: 1000, wallIso: '', form: formLike });
    const p = pauseSession(s, 2000);
    const r = resumeSession(p, 3000);
    const st = stopSession(r, 5000);
    expect(p.snapshot).toBe(s.snapshot);
    expect(r.snapshot).toBe(s.snapshot);
    expect(st.snapshot).toBe(s.snapshot);
  });
});
