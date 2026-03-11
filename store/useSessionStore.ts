'use client';

import { create } from 'zustand';
import type { Phase, ValueScore } from '@/types/pillars';
import type { EngineSnapshot } from '@/lib/session/sessionMachine';
import { VALUE_MAP } from '@/lib/catalog/values';

interface SessionStore {
  // State
  sessionId: string | null;
  phase: Phase;
  currentPair: [number, number] | null;
  valueScores: ValueScore[];
  comparisonCount: number;
  canUndo: boolean;
  undoAvailableUntil: number | null; // timestamp
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  setSession: (sessionId: string, snapshot: EngineSnapshot) => void;
  applySnapshot: (snapshot: EngineSnapshot, comparisonCount: number) => void;
  enableUndo: () => void;
  consumeUndo: () => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessionId: null,
  phase: 'mapping',
  currentPair: null,
  valueScores: [],
  comparisonCount: 0,
  canUndo: false,
  undoAvailableUntil: null,
  isLoading: false,
  isInitialized: false,

  setSession: (sessionId, snapshot) => {
    set({
      sessionId,
      phase: snapshot.phase,
      currentPair: snapshot.currentPair,
      valueScores: snapshot.valueScores,
      comparisonCount: 0,
      canUndo: false,
      undoAvailableUntil: null,
      isLoading: false,
      isInitialized: true,
    });
  },

  applySnapshot: (snapshot, comparisonCount) => {
    set({
      phase: snapshot.phase,
      currentPair: snapshot.currentPair,
      valueScores: snapshot.valueScores,
      comparisonCount,
      isLoading: false,
    });
  },

  enableUndo: () => {
    const until = Date.now() + 3000;
    set({ canUndo: true, undoAvailableUntil: until });

    setTimeout(() => {
      const current = get();
      if (current.undoAvailableUntil === until) {
        set({ canUndo: false, undoAvailableUntil: null });
      }
    }, 3100);
  },

  consumeUndo: () => {
    set({ canUndo: false, undoAvailableUntil: null });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  reset: () => set({
    sessionId: null,
    phase: 'mapping',
    currentPair: null,
    valueScores: [],
    comparisonCount: 0,
    canUndo: false,
    undoAvailableUntil: null,
    isLoading: false,
    isInitialized: false,
  }),
}));

// Selectors
export const selectCurrentValues = (state: SessionStore) => {
  if (!state.currentPair) return null;
  const a = VALUE_MAP.get(state.currentPair[0]);
  const b = VALUE_MAP.get(state.currentPair[1]);
  if (!a || !b) return null;
  return { a, b };
};

export const selectProgress = (state: SessionStore): number => {
  // Rough progress estimate based on comparison count
  const n = 117;
  const target = n + 60; // midpoint of typical range
  return Math.min(0.97, state.comparisonCount / target);
};

export const selectPhaseLabel = (state: SessionStore): string => {
  switch (state.phase) {
    case 'mapping': return 'Mapping what matters';
    case 'refining': return 'Refining your ranking';
    case 'locking': return 'Locking in your pillars';
    case 'done': return 'Done';
  }
};
