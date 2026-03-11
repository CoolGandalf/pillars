import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PairArena } from '@/components/choice/PairArena';
import { useSessionStore } from '@/store/useSessionStore';
import type { EngineSnapshot } from '@/lib/session/sessionMachine';
import type { Comparison } from '@/types/pillars';

export default function PlayContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionIdParam = searchParams.get('session');
  const freshParam = searchParams.get('fresh');

  const { setSession, applySnapshot, enableUndo, consumeUndo, setLoading, reset } = useSessionStore();
  const sessionIdRef = useRef<string | null>(null);
  const comparisonsRef = useRef<Comparison[]>([]);
  const snapshotRef = useRef<EngineSnapshot | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const { createSession, resumeSession, getOrCreateActiveSession } = await import('@/lib/session/sessionMachine');

        let result;
        if (freshParam) {
          result = await createSession();
        } else if (sessionIdParam) {
          result = await resumeSession(sessionIdParam);
          if (!result) result = await createSession();
        } else {
          result = await getOrCreateActiveSession() ?? await createSession();
        }

        if (!result) return;

        const { session, snapshot } = result;
        sessionIdRef.current = session.id;

        const { getComparisons } = await import('@/lib/storage/db');
        comparisonsRef.current = await getComparisons(session.id);
        snapshotRef.current = snapshot;

        setSession(session.id, snapshot);
        applySnapshot(snapshot, comparisonsRef.current.filter(c => !c.undone).length);
        setInitialized(true);
      } catch (err) {
        console.error('Failed to initialize session:', err);
        setLoading(false);
      }
    }

    reset();
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChoose = async (winnerId: number, loserId: number) => {
    if (!sessionIdRef.current || !snapshotRef.current) return;

    setLoading(true);
    try {
      const { recordChoice } = await import('@/lib/session/sessionMachine');
      const { getComparisons } = await import('@/lib/storage/db');

      const result = await recordChoice(
        sessionIdRef.current,
        snapshotRef.current,
        winnerId,
        loserId
      );

      comparisonsRef.current = await getComparisons(sessionIdRef.current);
      snapshotRef.current = result.snapshot;

      if (result.done) {
        navigate(`/results?session=${sessionIdRef.current}`);
        return;
      }

      applySnapshot(result.snapshot, comparisonsRef.current.filter(c => !c.undone).length);
      enableUndo();
    } catch (err) {
      console.error('Failed to record choice:', err);
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!sessionIdRef.current || !snapshotRef.current) return;
    consumeUndo();

    try {
      const { undoChoice } = await import('@/lib/session/sessionMachine');
      const { getComparisons } = await import('@/lib/storage/db');

      const newSnapshot = await undoChoice(
        sessionIdRef.current,
        comparisonsRef.current,
        snapshotRef.current
      );

      if (!newSnapshot) return;

      comparisonsRef.current = await getComparisons(sessionIdRef.current);
      snapshotRef.current = newSnapshot;
      applySnapshot(newSnapshot, comparisonsRef.current.filter(c => !c.undone).length);
    } catch (err) {
      console.error('Failed to undo:', err);
    }
  };

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-950">
        <div className="text-stone-500 text-sm">Loading your session…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-stone-950 py-4">
      <PairArena onChoose={handleChoose} onUndo={handleUndo} />
    </div>
  );
}
