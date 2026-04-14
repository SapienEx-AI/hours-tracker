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

export function SuggestionsPanel({ date, onSelect, onNavigate }: Props): JSX.Element {
  const { connected, provider, refresh, setError, lastError } = useCalendarStore();
  const events = useCalendarEvents(date);

  if (!connected) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-lg">Suggested from calendar</h2>
        <div className="glass rounded-xl p-4 flex flex-col gap-2">
          <div className="text-sm text-slate-600">
            Connect Google Calendar to see suggestions for the selected date.
          </div>
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                try {
                  await provider.connect();
                  refresh();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Connect
            </Button>
            <Button variant="secondary" onClick={() => onNavigate('settings')}>
              Set up in Settings →
            </Button>
          </div>
          {lastError && <Banner variant="error">{lastError}</Banner>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-lg">Suggested from calendar</h2>
      {events.isLoading && (
        <div className="flex flex-col gap-2">
          <div className="glass rounded-xl p-3 h-14 animate-pulse" />
          <div className="glass rounded-xl p-3 h-14 animate-pulse" />
          <div className="glass rounded-xl p-3 h-14 animate-pulse" />
        </div>
      )}
      {events.error && (
        <Banner variant="error">
          {(events.error as Error).message}
        </Banner>
      )}
      {events.data?.length === 0 && (
        <div className="text-sm text-slate-500">No calendar events on this date.</div>
      )}
      {events.data?.map((s) => (
        <SuggestionCard
          key={`${s.calendar_id}:${s.source_event_id}`}
          suggestion={s}
          onClick={onSelect}
        />
      ))}
    </div>
  );
}
