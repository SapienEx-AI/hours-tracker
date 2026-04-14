import { create } from 'zustand';
import { googleProvider, type CalendarProvider } from '@/integrations/calendar/provider';

type State = {
  provider: CalendarProvider;
  connected: boolean;
  lastError: string | null;
  refresh: () => void;
  setError: (msg: string | null) => void;
};

export const useCalendarStore = create<State>((set) => ({
  provider: googleProvider,
  connected: googleProvider.isConnected(),
  lastError: null,
  refresh: () => set({ connected: googleProvider.isConnected() }),
  setError: (msg) => set({ lastError: msg }),
}));
