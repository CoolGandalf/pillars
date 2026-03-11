'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { HeroPillars } from '@/components/results/HeroPillars';
import { Top25List } from '@/components/results/Top25List';
import { ShareCard } from '@/components/share/ShareCard';
import type { ResultSnapshot, Value } from '@/types/pillars';
import { VALUE_MAP } from '@/lib/catalog/values';

interface ResultsState {
  snapshot: ResultSnapshot;
  hero: [Value, Value];
  top25Values: Value[];
}

export default function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session');

  const [results, setResults] = useState<ResultsState | null>(null);
  const [sharing, setSharing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionId) {
      router.push('/');
      return;
    }

    async function load() {
      try {
        const { getResult } = await import('@/lib/storage/db');
        const snapshot = await getResult(sessionId!);
        if (!snapshot) {
          router.push('/');
          return;
        }

        const hero: [Value, Value] = [
          VALUE_MAP.get(snapshot.top2[0])!,
          VALUE_MAP.get(snapshot.top2[1])!,
        ];
        const top25Values = snapshot.top25.map(id => VALUE_MAP.get(id)!).filter(Boolean);

        setResults({ snapshot, hero, top25Values });
      } catch (err) {
        console.error('Failed to load results:', err);
        router.push('/');
      }
    }
    load();
  }, [sessionId, router]);

  const handleShare = async () => {
    if (!results || sharing) return;
    setSharing(true);
    try {
      const { shareOrDownload, buildShareText } = await import('@/lib/share/exportCard');
      const text = buildShareText(results.hero[0].name, results.hero[1].name);
      await shareOrDownload(text);
    } catch (err) {
      console.error('Share failed:', err);
    } finally {
      setSharing(false);
    }
  };

  const handleCopyText = async () => {
    if (!results) return;
    const text = `My Pillars right now: ${results.hero[0].name} + ${results.hero[1].name}\n\nThe two values I protected most when tradeoffs got real.`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard not available
    }
  };

  if (!results) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-950">
        <div className="text-stone-500 text-sm">Loading your results…</div>
      </div>
    );
  }

  const top10 = results.top25Values.slice(0, 10);

  return (
    <main className="min-h-screen bg-stone-950 px-4 py-8">
      <div className="max-w-lg mx-auto flex flex-col gap-8">
        <HeroPillars
          value1={results.hero[0]}
          value2={results.hero[1]}
          tier={results.snapshot.confidenceTier}
          comparisonCount={results.snapshot.totalComparisons}
        />

        <motion.div
          className="flex flex-col gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <button
            onClick={handleShare}
            disabled={sharing}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-semibold rounded-2xl transition-colors disabled:opacity-60"
          >
            {sharing ? 'Preparing…' : 'Share top 2'}
          </button>
          <button
            onClick={handleCopyText}
            className="w-full py-3 text-stone-400 hover:text-stone-300 text-sm border border-stone-800 hover:border-stone-700 rounded-2xl transition-colors"
          >
            Copy summary text
          </button>
        </motion.div>

        <Top25List values={results.top25Values} />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="pb-8"
        >
          <button
            onClick={() => router.push('/play?fresh=1')}
            className="w-full py-3 text-stone-600 hover:text-stone-400 text-sm transition-colors"
          >
            Start a new run
          </button>
        </motion.div>
      </div>

      <div
        ref={shareCardRef}
        className="fixed -left-[9999px] top-0 pointer-events-none"
        aria-hidden="true"
      >
        <ShareCard
          value1={results.hero[0]}
          value2={results.hero[1]}
          top10={top10}
        />
      </div>
    </main>
  );
}
