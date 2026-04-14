import { create } from 'zustand';

type UiState = {
  focusLogNonce: number;
  bumpFocusLog: () => void;
  entriesPrefilter: { status?: 'needs_review' } | null;
  setEntriesPrefilter: (p: { status?: 'needs_review' } | null) => void;
};

export const useUiStore = create<UiState>((set) => ({
  focusLogNonce: 0,
  bumpFocusLog: () => set((s) => ({ focusLogNonce: s.focusLogNonce + 1 })),
  entriesPrefilter: null,
  setEntriesPrefilter: (p) => set({ entriesPrefilter: p }),
}));
