'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useSessionStore, selectProgress, selectPhaseLabel } from '@/store/useSessionStore';

interface ProgressHeaderProps {
  onUndo: () => void;
}

export function ProgressHeader({ onUndo }: ProgressHeaderProps) {
  const canUndo = useSessionStore(s => s.canUndo);
  const comparisonCount = useSessionStore(s => s.comparisonCount);
  const progress = useSessionStore(selectProgress);
  const phaseLabel = useSessionStore(selectPhaseLabel);

  return (
    <div className="w-full px-4 pt-safe">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-stone-400 font-medium tracking-wide uppercase">
          {phaseLabel}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-500">{comparisonCount} choices</span>

          <AnimatePresence>
            {canUndo && (
              <motion.button
                key="undo"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                onClick={onUndo}
                className="text-xs bg-stone-700 hover:bg-stone-600 text-stone-300 px-3 py-1 rounded-full transition-colors"
              >
                Undo
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-0.5 bg-stone-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-amber-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
