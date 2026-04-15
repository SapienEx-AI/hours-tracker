/**
 * Pure timer-session helpers. Zero React, zero Zustand, zero DOM.
 *
 * The Zustand store in timer-store.ts wraps these with persistence and a
 * BroadcastChannel; this file is the unit-testable kernel.
 */

import type { EffortKind } from '@/schema/types';

export type Form = {
  projectId: string;
  bucketId: string | null;
  description: string;
  date: string;
  effort_kind: EffortKind | null;
};

export type TimerPhase =
  | { kind: 'running'; started_at: number; base_elapsed_ms: number }
  | { kind: 'paused'; elapsed_ms: number }
  | { kind: 'stopped'; elapsed_ms: number };

export type TimerSession = {
  id: string;
  started_wall: string;
  snapshot: Form;
  phase: TimerPhase;
};

export function snapshotFromForm(form: Form): Form {
  return {
    projectId: form.projectId,
    bucketId: form.bucketId,
    description: form.description,
    date: form.date,
    effort_kind: form.effort_kind,
  };
}

export function liveElapsedMs(
  phase: TimerPhase | { kind: 'idle' },
  now: number = Date.now(),
): number {
  if (phase.kind === 'running') {
    const delta = now - phase.started_at;
    // Defensive clamp — if the wall clock goes backwards (DST or manual
    // adjustment) we never let elapsed decrease below the frozen base.
    return Math.max(phase.base_elapsed_ms, phase.base_elapsed_ms + delta);
  }
  if (phase.kind === 'paused' || phase.kind === 'stopped') return phase.elapsed_ms;
  return 0;
}

/**
 * Convert milliseconds to hours_hundredths using banker's rounding
 * (round-half-to-even). Clamped to the schema's 24h ceiling (2400).
 *
 * Banker's rounding instead of round-half-up so timer-derived hours don't
 * systematically over-bill at the half-hundredth boundary.
 */
export function msToHundredths(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  const exact = ms / 36000; // 36000 ms = 0.01 h
  const floor = Math.floor(exact);
  const diff = exact - floor;
  let rounded: number;
  if (diff < 0.5) rounded = floor;
  else if (diff > 0.5) rounded = floor + 1;
  else rounded = floor % 2 === 0 ? floor : floor + 1; // banker's rule
  return Math.min(2400, rounded);
}

function uuidv4(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback — not crypto-strong, fine for a local session id.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function startSession(args: {
  now: number;
  wallIso: string;
  form: Form;
}): TimerSession {
  return {
    id: uuidv4(),
    started_wall: args.wallIso,
    snapshot: snapshotFromForm(args.form),
    phase: { kind: 'running', started_at: args.now, base_elapsed_ms: 0 },
  };
}

export function pauseSession(session: TimerSession, now: number): TimerSession {
  if (session.phase.kind !== 'running') return session;
  const elapsed = liveElapsedMs(session.phase, now);
  return { ...session, phase: { kind: 'paused', elapsed_ms: elapsed } };
}

export function resumeSession(session: TimerSession, now: number): TimerSession {
  if (session.phase.kind !== 'paused') return session;
  return {
    ...session,
    phase: { kind: 'running', started_at: now, base_elapsed_ms: session.phase.elapsed_ms },
  };
}

export function stopSession(session: TimerSession, now: number): TimerSession {
  if (session.phase.kind === 'stopped') return session;
  const elapsed = liveElapsedMs(session.phase, now);
  return { ...session, phase: { kind: 'stopped', elapsed_ms: elapsed } };
}

/**
 * A frozen snapshot of a completed timer session — the "receipt" left
 * behind after the session was loaded into the form. Used to populate the
 * timer panel's recent-history list so users can re-drive a similar entry
 * without retyping context.
 */
export type HistoricalRecording = {
  id: string;
  started_wall: string;
  archived_wall: string;
  project_id: string;
  bucket_id: string | null;
  date: string;
  elapsed_ms: number;
  effort_kind: EffortKind | null;
};

export function sessionToRecording(
  session: TimerSession,
  archivedWall: string,
): HistoricalRecording {
  return {
    id: session.id,
    started_wall: session.started_wall,
    archived_wall: archivedWall,
    project_id: session.snapshot.projectId,
    bucket_id: session.snapshot.bucketId,
    date: session.snapshot.date,
    elapsed_ms: liveElapsedMs(session.phase),
    effort_kind: session.snapshot.effort_kind,
  };
}
