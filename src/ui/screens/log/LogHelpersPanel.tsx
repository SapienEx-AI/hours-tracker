import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Route } from '@/ui/Router';
import type { EffortKind, Project } from '@/schema/types';
import type { Suggestion } from '@/data/hooks/use-calendar-events';
import type { Form, HistoricalRecording } from '@/store/timer-session';
import { SapienExMark } from '@/ui/components/SapienExMark';
import { AnimatedHeight } from '@/ui/components/AnimatedHeight';
import { SuggestionsPanel } from './SuggestionsPanel';
import { TimerCard } from './TimerCard';
import { QuickActivityCard, type QuickAction } from './QuickActivityCard';

// Viewport must be at least this wide for horizontal stacking to fit.
const MIN_WIDTH_FOR_HORIZONTAL = 1280;
// Content height (timer + calendar + gap) thresholds as fraction of viewport.
// Hysteresis: enter horizontal above UPPER, exit horizontal only below LOWER.
// The gap prevents oscillation when re-layout changes content heights.
const ENTER_HORIZONTAL_RATIO = 0.72;
const EXIT_HORIZONTAL_RATIO = 0.5;

/**
 * Observes a child element's bounding height and reports it upward.
 * Used by LogHelpersPanel to measure each card so it can decide when the
 * combined content would be too tall for vertical stacking.
 */
function MeasuredBlock({
  onHeight,
  children,
}: {
  onHeight: (h: number) => void;
  children: ReactNode;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current === null) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h !== undefined) onHeight(h);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [onHeight]);
  return <div ref={ref}>{children}</div>;
}

type Props = {
  form: Form;
  projects: Project[];
  onSelectSuggestion: (s: Suggestion) => void;
  onRedriveRecording: (rec: HistoricalRecording) => void;
  onChangeProject: (id: string) => void;
  onChangeBucket: (id: string | null) => void;
  onChangeEffortKind: (k: EffortKind | null) => void;
  onQuickActivity: (action: QuickAction) => void;
  onBounceProject: () => void;
  onNavigate: (r: Route) => void;
};

/**
 * SapienEx-branded "intelligence shell" for alt-input providers (timer,
 * calendar, future). The shell mirrors the app's outer-frame brand
 * grammar: deep navy → indigo → cyan gradient, white-on-low-opacity
 * text, inset white-line borders, cyan glow accents. Inner provider
 * cards keep their colored state palettes and read as light-glass
 * islands within the dark branded shell.
 */
export function LogHelpersPanel({
  form,
  projects,
  onSelectSuggestion,
  onRedriveRecording,
  onChangeProject,
  onChangeBucket,
  onChangeEffortKind,
  onQuickActivity,
  onBounceProject,
  onNavigate,
}: Props): JSX.Element {
  const [isWide, setIsWide] = useState(false);
  const [timerHeight, setTimerHeight] = useState(0);
  const [calendarHeight, setCalendarHeight] = useState(0);
  const [viewport, setViewport] = useState(() => {
    if (typeof window === 'undefined') return { w: 0, h: 0 };
    return { w: window.innerWidth, h: window.innerHeight };
  });

  useEffect(() => {
    const onResize = (): void => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Decide whether horizontal stacking is needed, with hysteresis so small
  // post-relayout height jitter doesn't bounce us between layouts.
  useEffect(() => {
    if (viewport.w === 0 || viewport.h === 0) return;
    const combined = timerHeight + calendarHeight + 16; // 16px ~ inter-card gap
    const widthOk = viewport.w >= MIN_WIDTH_FOR_HORIZONTAL;
    const threshold = isWide
      ? viewport.h * EXIT_HORIZONTAL_RATIO
      : viewport.h * ENTER_HORIZONTAL_RATIO;
    const next = widthOk && combined > threshold;
    if (next !== isWide) {
      setIsWide(next);
    }
  }, [timerHeight, calendarHeight, viewport, isWide]);

  const onTimerHeight = useCallback((h: number) => setTimerHeight(h), []);
  const onCalendarHeight = useCallback((h: number) => setCalendarHeight(h), []);
  // Light glass shell that fits the workspace tone:
  //  - Frosted white base with a faint cyan-to-lavender wash
  //  - Single soft cyan glow in the top-right for ambient warmth
  //  - Subtle white inset rim highlight on top edge
  // Reads as "premium glass surface" without the dark heaviness.
  const layeredBg = `
    radial-gradient(120% 80% at 95% 0%, rgba(107,207,238,0.18), transparent 55%),
    linear-gradient(160deg, rgba(255,255,255,0.65) 0%, rgba(238,242,255,0.55) 60%, rgba(245,243,255,0.5) 100%)
  `;

  return (
    <div
      className="
        relative rounded-2xl p-5 overflow-hidden backdrop-blur-xl
        shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_0_0_1px_rgba(107,207,238,0.18),0_8px_32px_-8px_rgba(30,77,168,0.18),0_0_60px_-20px_rgba(107,207,238,0.25)]
        w-full lg:w-fit shrink-0
      "
      style={{ background: layeredBg }}
    >
      {/* Top rim-light — subtle bright edge */}
      <div className="pointer-events-none absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" />

      <div className="relative flex flex-col gap-4">
        {/* Header — SapienEx mark + ASSIST title on a refined glass pill */}
        <div
          className="
            -mx-2 -mt-1 px-3 py-2 rounded-xl
            bg-white/40
            shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7),inset_0_-1px_0_rgba(107,207,238,0.15),0_0_16px_rgba(107,207,238,0.08)]
            flex items-center gap-2.5
          "
        >
          <SapienExMark variant="light" label="hide" size="md" position="inline" />
          <h2 className="font-display text-sm text-slate-800 uppercase tracking-[0.18em] font-semibold whitespace-nowrap">
            Assist
          </h2>
        </div>

        {/* Card layout: vertical below xl, horizontal at xl+ so the panel
            spreads its cards into a row when the viewport gives us room and
            the combined column would otherwise be too tall. The flip is
            animated via the View Transitions API in `useAnimatedBreakpoint`. */}
        <div
          className={`flex gap-4 ${isWide ? 'flex-row items-start' : 'flex-col'}`}
        >
          {/* Each card is a fixed 360px wide so the panel itself wraps
              tightly around its content. Vertical ≈ 400px panel, horizontal
              ≈ 776px panel. Per-provider widths can be tuned later. */}
          <div className="w-[360px] max-w-full">
            <MeasuredBlock onHeight={onTimerHeight}>
              <AnimatedHeight>
                <TimerCard
                  form={form}
                  projects={projects}
                  onChangeProject={onChangeProject}
                  onChangeBucket={onChangeBucket}
                  onChangeEffortKind={onChangeEffortKind}
                  onRedrive={onRedriveRecording}
                />
              </AnimatedHeight>
            </MeasuredBlock>
          </div>

          <div className="w-[360px] max-w-full">
            <MeasuredBlock onHeight={onCalendarHeight}>
              <AnimatedHeight>
                <SuggestionsPanel
                  date={form.date}
                  onSelect={onSelectSuggestion}
                  onNavigate={onNavigate}
                />
              </AnimatedHeight>
            </MeasuredBlock>
          </div>

          <div className="w-[360px] max-w-full">
            <AnimatedHeight>
              <QuickActivityCard
                projectSelected={form.projectId !== ''}
                onPrefill={onQuickActivity}
                onBounceProject={onBounceProject}
              />
            </AnimatedHeight>
          </div>
        </div>
      </div>
    </div>
  );
}
