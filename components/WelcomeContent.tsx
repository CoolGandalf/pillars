'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import type { Session } from '@/types/pillars';

export default function WelcomeContent() {
  const router = useRouter();
  const [existingSession, setExistingSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    async function checkForSession() {
      try {
        const { getMostRecentActiveSession } = await import('@/lib/storage/db');
        const session = await getMostRecentActiveSession();
        setExistingSession(session ?? null);
      } catch {
        // IndexedDB not available
      } finally {
        setLoaded(true);
      }
    }
    checkForSession();
  }, []);

  const handleResume = () => {
    if (starting || !existingSession) return;
    setStarting(true);
    router.push(`/play?session=${existingSession.id}`);
  };

  const handleBegin = () => {
    if (starting) return;
    setStarting(true);
    router.push('/play');
  };

  const handleStartFresh = () => {
    if (starting) return;
    setStarting(true);
    router.push('/play?fresh=1');
  };

  return (
    <motion.div
      className="w-full max-w-sm flex flex-col items-center gap-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight mb-2">Pillars</h1>
        <p className="text-stone-400 text-sm leading-relaxed max-w-xs">
          Discover your core values through fast, honest tradeoffs.
        </p>
      </div>

      <div className="w-full space-y-3">
        {[
          { n: '1', text: "You'll see two values at a time." },
          { n: '2', text: "Pick the one you'd protect if they conflicted." },
          { n: '3', text: 'Your top 2 core values emerge.' },
        ].map(item => (
          <div key={item.n} className="flex items-start gap-3">
            <span className="text-amber-500 font-mono text-sm font-bold flex-shrink-0 mt-0.5">
              {item.n}
            </span>
            <p className="text-stone-300 text-sm leading-relaxed">{item.text}</p>
          </div>
        ))}
      </div>

      <p className="text-stone-600 text-xs text-center">
        ~130–170 choices · 5–7 minutes · no account needed
      </p>

      {loaded ? (
        <div className="w-full space-y-3">
          {existingSession ? (
            <>
              <button
                onClick={handleResume}
                disabled={starting}
                className="w-full py-4 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-semibold rounded-2xl transition-colors disabled:opacity-60"
              >
                Resume your run
                <span className="block text-xs font-normal opacity-70 mt-0.5">
                  {existingSession.comparisonCount} choices made
                </span>
              </button>
              <button
                onClick={handleStartFresh}
                disabled={starting}
                className="w-full py-3 text-stone-400 hover:text-stone-300 text-sm transition-colors"
              >
                Start fresh
              </button>
            </>
          ) : (
            <button
              onClick={handleBegin}
              disabled={starting}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-semibold rounded-2xl transition-colors disabled:opacity-60"
            >
              {starting ? 'Starting…' : 'Begin'}
            </button>
          )}
        </div>
      ) : (
        <div className="w-full py-4 text-center text-stone-600 text-sm">Loading…</div>
      )}
    </motion.div>
  );
}
