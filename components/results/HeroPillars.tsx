'use client';

import { motion } from 'framer-motion';
import type { Value } from '@/types/pillars';
import { ConfidenceBadge } from './ConfidenceBadge';

interface HeroPillarsProps {
  value1: Value;
  value2: Value;
  tier: 'locked' | 'likely';
  comparisonCount: number;
}

export function HeroPillars({ value1, value2, tier, comparisonCount }: HeroPillarsProps) {
  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="text-center mb-6"
      >
        <p className="text-xs font-medium text-stone-500 uppercase tracking-widest mb-1">
          Your Pillars
        </p>
        <p className="text-sm text-stone-400">
          These were your clearest anchors across {comparisonCount} choices.
        </p>
      </motion.div>

      <div className="flex gap-3 mb-4">
        {[value1, value2].map((value, i) => (
          <motion.div
            key={value.id}
            className="flex-1 bg-stone-900 border border-stone-700 rounded-2xl p-5 text-center"
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.45, delay: i * 0.12, type: 'spring', stiffness: 300, damping: 25 }}
          >
            <div className="text-xs text-amber-500 font-semibold mb-1">
              #{i + 1}
            </div>
            <h2 className="text-xl font-bold text-white mb-2 leading-tight">
              {value.name}
            </h2>
            <p className="text-xs text-stone-400 leading-relaxed">
              {value.definition}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="flex justify-center">
        <ConfidenceBadge tier={tier} />
      </div>
    </div>
  );
}
