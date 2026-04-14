import type { Route } from '@/ui/Router';
import { useCalendarStore } from '@/store/calendar-store';
import { useCalendarEvents, type Suggestion } from '@/data/hooks/use-calendar-events';
import { Button } from '@/ui/components/Button';
import { Banner } from '@/ui/components/Banner';
import { SuggestionCard } from './SuggestionCard';

type Props = {
  date: string;
  onSelect: (s: Suggestion) => void;
  onNavigate: (r: Route) => void;
};

type CalendarStatus = 'not-connected' | 'loading' | 'empty' | 'has-events' | 'error';

// Calendar uses an indigo/sky palette — distinct from Timer's warm amber/emerald,
// still in the cool family of the outer LogHelpersPanel cyan frame.
const FRAME_BG: Record<CalendarStatus, string> = {
  'not-connected': 'from-white/95 via-white/95 to-slate-50/95',
  loading: 'from-indigo-50 via-white/95 to-white/90',
  empty: 'from-indigo-50/95 via-white/95 to-white/90',
  'has-events': 'from-indigo-50 via-sky-50/95 to-white/90',
  error: 'from-red-50 via-white/95 to-white/90',
};

const FRAME_BORDER: Record<CalendarStatus, string> = {
  'not-connected': 'border-white/40',
  loading: 'border-indigo-300/50',
  empty: 'border-indigo-200/50',
  'has-events':
    'border-indigo-400/50 shadow-[0_0_20px_rgba(99,102,241,0.25),inset_0_0_0_1px_rgba(99,102,241,0.1)]',
  error: 'border-red-300/60',
};

const BADGE: Record<CalendarStatus, { classes: string; dotClass: string; label: string }> = {
  'not-connected': {
    classes: 'bg-slate-200/60 text-slate-600 border-slate-300/50',
    dotClass: 'bg-slate-400',
    label: 'not connected',
  },
  loading: {
    classes: 'bg-indigo-100 text-indigo-700 border-indigo-300/50',
    dotClass: 'bg-indigo-500 animate-pulse',
    label: 'loading',
  },
  empty: {
    classes: 'bg-slate-100 text-slate-500 border-slate-200/60',
    dotClass: 'bg-slate-300',
    label: 'no events',
  },
  'has-events': {
    classes: 'bg-indigo-100 text-indigo-800 border-indigo-300/60',
    dotClass: 'bg-indigo-500',
    label: '',
  },
  error: {
    classes: 'bg-red-100 text-red-800 border-red-300/60',
    dotClass: 'bg-red-500',
    label: 'error',
  },
};

function StatusBadge({
  kind,
  overrideLabel,
}: {
  kind: CalendarStatus;
  overrideLabel: string | undefined;
}): JSX.Element {
  const { classes, label } = BADGE[kind];
  return (
    <span
      className={`ml-auto inline-flex items-center text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border whitespace-nowrap ${classes}`}
    >
      {overrideLabel ?? label}
    </span>
  );
}

function CalendarIcon(): JSX.Element {
  return (
    <svg
      className="w-4 h-4 text-indigo-600 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function Header({
  status,
  badgeLabel,
}: {
  status: CalendarStatus;
  badgeLabel: string | undefined;
}): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <CalendarIcon />
      <h3 className="font-display text-sm text-slate-800 uppercase tracking-wide font-semibold whitespace-nowrap">
        Calendar
      </h3>
      <StatusBadge kind={status} overrideLabel={badgeLabel} />
    </div>
  );
}

export function SuggestionsPanel({ date, onSelect, onNavigate }: Props): JSX.Element {
  const { connected, provider, refresh, setError, lastError } = useCalendarStore();
  const events = useCalendarEvents(date);

  const status: CalendarStatus = !connected
    ? 'not-connected'
    : events.isLoading
      ? 'loading'
      : events.error
        ? 'error'
        : (events.data?.length ?? 0) === 0
          ? 'empty'
          : 'has-events';

  const count = events.data?.length ?? 0;
  const badgeLabel =
    status === 'has-events' ? `${count} event${count === 1 ? '' : 's'}` : undefined;

  const frame = `rounded-xl p-4 flex flex-col gap-3 bg-gradient-to-br ${FRAME_BG[status]} border ${FRAME_BORDER[status]} backdrop-blur-sm transition-all duration-300`;

  if (status === 'not-connected') {
    return (
      <div className={frame}>
        <Header status={status} badgeLabel={undefined} />
        <div className="text-xs text-slate-600 leading-relaxed">
          Connect Google Calendar to pull meeting times into this day&apos;s log.
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={async () => {
              try {
                await provider.connect();
                refresh();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
            className="
              group w-full px-4 py-2.5 rounded-xl font-body text-sm font-semibold text-white
              bg-gradient-to-br from-sky-500 via-indigo-500 to-indigo-700
              hover:from-sky-600 hover:via-indigo-600 hover:to-indigo-800
              shadow-[0_4px_20px_rgba(99,102,241,0.35),0_0_24px_rgba(99,102,241,0.15),inset_0_1px_0_rgba(255,255,255,0.25)]
              hover:shadow-[0_6px_24px_rgba(99,102,241,0.45),0_0_32px_rgba(99,102,241,0.2)]
              hover:-translate-y-0.5 active:translate-y-0
              transition-all duration-200
            "
          >
            <span className="inline-flex items-center gap-2">
              <span>◆</span>
              <span>Connect Google Calendar</span>
            </span>
          </button>
          <Button variant="secondary" onClick={() => onNavigate('settings')}>
            Set up in Settings →
          </Button>
        </div>
        {lastError !== null && <Banner variant="error">{lastError}</Banner>}
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className={frame}>
        <Header status={status} badgeLabel={undefined} />
        <div className="flex flex-col gap-2">
          <SkeletonCard delay={0} />
          <SkeletonCard delay={100} />
          <SkeletonCard delay={200} />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={frame}>
        <Header status={status} badgeLabel={undefined} />
        <Banner variant="error">{(events.error as Error).message}</Banner>
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div className={frame}>
        <Header status={status} badgeLabel={undefined} />
        <div className="py-6 flex flex-col items-center gap-2 text-center">
          <div className="text-2xl text-indigo-300">◇</div>
          <div className="text-xs text-slate-500">
            No calendar events on this date.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={frame}>
      <Header status={status} badgeLabel={badgeLabel} />
      <div className="flex flex-col gap-2">
        {events.data?.map((s) => (
          <SuggestionCard
            key={`${s.calendar_id}:${s.source_event_id}`}
            suggestion={s}
            onClick={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function SkeletonCard({ delay }: { delay: number }): JSX.Element {
  return (
    <div
      className="
        relative rounded-xl overflow-hidden
        bg-gradient-to-br from-indigo-50/40 via-white/40 to-white/30
        border border-indigo-200/40 h-16
      "
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-400/60 to-sky-400/40 animate-pulse" />
      <div className="animate-pulse p-3 pl-4 flex flex-col gap-2">
        <div className="h-3 w-24 rounded bg-slate-200/60" />
        <div className="h-3 w-40 rounded bg-slate-200/60" />
      </div>
    </div>
  );
}
