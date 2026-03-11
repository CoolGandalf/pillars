'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Value } from '@/types/pillars';

interface ValueCardProps {
  value: Value;
  position: 'top' | 'bottom';
  onChoose: () => void;
  disabled?: boolean;
}

export function ValueCard({ value, position, onChoose, disabled = false }: ValueCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const handlePointerDown = () => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setShowDetail(true);
    }, 350);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!didLongPress.current && !disabled) {
      onChoose();
    }
  };

  const handlePointerLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const bg = position === 'top'
    ? 'bg-stone-900 border-stone-700'
    : 'bg-stone-800 border-stone-600';

  return (
    <>
      <motion.button
        className={`
          w-full flex-1 rounded-2xl border ${bg}
          flex flex-col items-center justify-center px-6 py-8
          cursor-pointer select-none relative overflow-hidden
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        whileTap={{ scale: 0.98 }}
        whileHover={{ scale: 1.005 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        disabled={disabled}
        aria-label={`${value.name}. ${value.definition}. Double tap to choose.`}
        role="button"
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center leading-tight mb-3">
          {value.name}
        </h2>
        <p className="text-sm sm:text-base text-stone-300 text-center leading-relaxed max-w-xs">
          {value.definition}
        </p>

        {value.detail && (
          <p className="mt-3 text-xs text-stone-500 text-center">
            Hold to learn more
          </p>
        )}
      </motion.button>

      {/* Detail overlay */}
      {showDetail && value.detail && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setShowDetail(false)}
        >
          <motion.div
            className="bg-stone-800 border border-stone-600 rounded-2xl p-6 w-full max-w-sm"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-2">{value.name}</h3>
            <p className="text-stone-300 text-sm leading-relaxed mb-1">{value.definition}</p>
            <p className="text-stone-400 text-sm leading-relaxed">{value.detail}</p>
            <button
              className="mt-4 w-full py-2 text-sm text-stone-400 border border-stone-600 rounded-xl"
              onClick={() => setShowDetail(false)}
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
