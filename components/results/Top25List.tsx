'use client';

import { motion } from 'framer-motion';
import type { Value } from '@/types/pillars';

interface Top25ListProps {
  values: Value[];
}

export function Top25List({ values }: Top25ListProps) {
  return (
    <div className="w-full">
      <h3 className="text-xs font-medium text-stone-500 uppercase tracking-widest mb-3 px-1">
        Your top 25
      </h3>
      <div className="space-y-1">
        {values.map((value, i) => (
          <motion.div
            key={value.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-stone-900/50 border border-stone-800/50"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.015 }}
          >
            <span className={`
              text-xs font-mono w-6 text-right flex-shrink-0
              ${i < 2 ? 'text-amber-500 font-bold' : i < 10 ? 'text-stone-400' : 'text-stone-600'}
            `}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <span className={`
                text-sm font-medium
                ${i < 2 ? 'text-white' : 'text-stone-200'}
              `}>
                {value.name}
              </span>
            </div>
            <span className="text-xs text-stone-600 flex-shrink-0 hidden sm:block max-w-[160px] truncate">
              {value.definition}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
