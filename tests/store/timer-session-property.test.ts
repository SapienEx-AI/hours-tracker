import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  startSession,
  pauseSession,
  resumeSession,
  stopSession,
  liveElapsedMs,
  msToHundredths,
} from '@/store/timer-session';

const snapshot = {
  projectId: 'p',
  bucketId: null,
  description: '',
  date: '2026-04-14',
  effort_kind: null,
};

describe('Timer session invariants', () => {
  it('live elapsed is monotonic under arbitrary start/pause/resume/stop sequences', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.constant('pause' as const),
            fc.constant('resume' as const),
            fc.constant('stop' as const),
          ),
          { maxLength: 20 },
        ),
        fc.array(fc.integer({ min: 1, max: 1_000_000 }), { minLength: 21, maxLength: 21 }),
        (ops, ticks) => {
          let clock = 0;
          let session = startSession({ now: clock, wallIso: '', form: snapshot });
          let prevElapsed = 0;
          for (let i = 0; i < ops.length; i++) {
            clock += ticks[i]!;
            if (session.phase.kind === 'stopped') break;
            const op = ops[i]!;
            if (op === 'pause' && session.phase.kind === 'running') {
              session = pauseSession(session, clock);
            } else if (op === 'resume' && session.phase.kind === 'paused') {
              session = resumeSession(session, clock);
            } else if (op === 'stop') {
              session = stopSession(session, clock);
            }
            const now = clock + 1;
            const el = liveElapsedMs(session.phase, now);
            expect(el).toBeGreaterThanOrEqual(prevElapsed);
            prevElapsed = el;
          }
        },
      ),
    );
  });

  it('msToHundredths returns an integer in [0, 2400] for any input', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1_000_000_000, max: 1_000_000_000 }), (ms) => {
        const h = msToHundredths(ms);
        expect(Number.isInteger(h)).toBe(true);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(2400);
      }),
    );
  });
});
