import { useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSessionStore } from '@/store/useSessionStore';
import { VALUE_MAP } from '@/lib/catalog/values';
import { ValueCard } from './ValueCard';
import { ProgressHeader } from './ProgressHeader';

interface PairArenaProps {
  onChoose: (winnerId: number, loserId: number) => Promise<void>;
  onUndo: () => Promise<void>;
  onSkip: () => Promise<void>;
}

export function PairArena({ onChoose, onUndo, onSkip }: PairArenaProps) {
  const currentPair = useSessionStore(s => s.currentPair);
  const isLoading = useSessionStore(s => s.isLoading);
  const phase = useSessionStore(s => s.phase);
  const skipCount = useSessionStore(s => s.skipCount);

  const currentValues = useMemo(() => {
    if (!currentPair) return null;
    const a = VALUE_MAP.get(currentPair[0]);
    const b = VALUE_MAP.get(currentPair[1]);
    if (!a || !b) return null;
    return { a, b };
  }, [currentPair]);

  const pairKey = currentPair?.join(',') ?? '';

  // Compute skip availability using same logic as sessionMachine.canSkip
  const skipAllowed = phase === 'mapping' || (phase === 'refining' && skipCount < 5);

  const handleChoose = useCallback(async (winnerId: number, loserId: number) => {
    if (isLoading) return;
    await onChoose(winnerId, loserId);
  }, [onChoose, isLoading]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isLoading || !currentValues) return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleChoose(currentValues.a.id, currentValues.b.id);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleChoose(currentValues.b.id, currentValues.a.id);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onUndo();
      } else if (e.key === 'ArrowRight' && skipAllowed) {
        e.preventDefault();
        onSkip();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleChoose, onUndo, onSkip, isLoading, currentValues, skipAllowed]);

  if (!currentValues) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-stone-500 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 w-full max-w-lg mx-auto px-4 pb-safe gap-4">
      <ProgressHeader onUndo={onUndo} onSkip={onSkip} skipAllowed={skipAllowed} />

      {/* Prompt */}
      <p className="text-center text-stone-400 text-sm px-4">
        If these conflicted, which matters more right now?
      </p>

      {/* Card arena */}
      <AnimatePresence mode="wait">
        <motion.div
          key={pairKey}
          className="flex flex-col flex-1 gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <ValueCard
            value={currentValues.a}
            position="top"
            onChoose={() => handleChoose(currentValues.a.id, currentValues.b.id)}
            disabled={isLoading}
          />

          <div className="flex items-center gap-3 px-2">
            <div className="flex-1 h-px bg-stone-700" />
            <span className="text-xs text-stone-500 font-medium">vs</span>
            <div className="flex-1 h-px bg-stone-700" />
          </div>

          <ValueCard
            value={currentValues.b}
            position="bottom"
            onChoose={() => handleChoose(currentValues.b.id, currentValues.a.id)}
            disabled={isLoading}
          />
        </motion.div>
      </AnimatePresence>

      {/* Keyboard hint (desktop) */}
      <p className="hidden sm:block text-center text-xs text-stone-600 pb-4">
        ↑ / ↓ choose · ← undo · → skip
      </p>
    </div>
  );
}
