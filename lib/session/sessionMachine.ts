'use client';

function uuidv4(): string {
  return crypto.randomUUID();
}
import type { Session, Comparison, ResultSnapshot, ValueScore, Phase } from '@/types/pillars';
import { N } from '@/lib/catalog/values';
import { mapEstimate, laplaceVariances, getRanking, topKProb, posteriorRankProbs } from '@/lib/ranking/btl';
import {
  selectPair,
  createPairSelectorState,
  updatePairSelectorState,
  type PairSelectorState,
} from '@/lib/ranking/pairSelector';
import { analyzeConfidence, shouldStop, getPhase } from '@/lib/ranking/confidence';
import {
  saveSession,
  getSession,
  getComparisons,
  appendComparison,
  undoLastComparison,
  saveResult,
  getMostRecentActiveSession,
} from '@/lib/storage/db';

export interface EngineSnapshot {
  scores: Float64Array;
  variances: Float64Array;
  ranking: number[];
  valueScores: ValueScore[];
  currentPair: [number, number];
  phase: Phase;
  selectorState: PairSelectorState;
}

/** Replay all comparisons through the engine to reconstruct state */
function replayComparisons(comparisons: Comparison[], n: number = N): {
  scores: Float64Array;
  variances: Float64Array;
  ranking: number[];
  selectorState: PairSelectorState;
} {
  const active = comparisons.filter(c => !c.undone);
  const scores = mapEstimate(null, active, n);
  const variances = laplaceVariances(scores, active, n);
  const ranking = getRanking(scores);

  // Rebuild selector state from comparison history
  let selectorState = createPairSelectorState();
  for (const c of comparisons) {
    if (!c.undone) {
      selectorState = updatePairSelectorState(selectorState, [c.winnerId, c.loserId]);
    }
  }

  return { scores, variances, ranking, selectorState };
}

function buildValueScores(
  scores: Float64Array,
  variances: Float64Array,
  ranking: number[],
  comparisons: Comparison[],
  n: number = N
): ValueScore[] {
  const counts = new Array(n).fill(0);
  for (const c of comparisons) {
    if (!c.undone) {
      counts[c.winnerId]++;
      counts[c.loserId]++;
    }
  }

  // Compute rank probability distributions for top2Prob/top25Prob
  const rankProbs = posteriorRankProbs(scores, variances, n, 200); // fewer samples for speed during play

  return ranking.map((valueId, rank) => ({
    valueId,
    score: scores[valueId],
    sigma: Math.sqrt(variances[valueId]),
    rank: rank + 1,
    appearances: counts[valueId],
    top2Prob: topKProb(rankProbs, valueId, 2),
    top25Prob: topKProb(rankProbs, valueId, 25),
  }));
}

export async function createSession(): Promise<{ session: Session; snapshot: EngineSnapshot }> {
  const id = uuidv4();
  const now = Date.now();

  const session: Session = {
    id,
    createdAt: now,
    updatedAt: now,
    phase: 'mapping',
    comparisonCount: 0,
  };

  await saveSession(session);

  // No comparisons yet — pick initial pair
  const scores = new Float64Array(N);
  const variances = new Float64Array(N).fill(PRIOR_VAR_SQRT);
  const ranking = getRanking(scores);
  const selectorState = createPairSelectorState();
  const currentPair = selectPair(selectorState, [], scores, variances, ranking);

  const snapshot: EngineSnapshot = {
    scores,
    variances,
    ranking,
    valueScores: buildValueScores(scores, variances, ranking, [], N),
    currentPair,
    phase: 'mapping',
    selectorState,
  };

  return { session, snapshot };
}

export async function resumeSession(sessionId: string): Promise<{ session: Session; snapshot: EngineSnapshot } | null> {
  const session = await getSession(sessionId);
  if (!session || session.completedAt) return null;

  const comparisons = await getComparisons(sessionId);
  if (comparisons.length === 0) {
    // Fresh session
    const scores = new Float64Array(N);
    const variances = new Float64Array(N).fill(PRIOR_VAR_SQRT);
    const ranking = getRanking(scores);
    const selectorState = createPairSelectorState();
    const currentPair = selectPair(selectorState, [], scores, variances, ranking);
    return {
      session,
      snapshot: { scores, variances, ranking, valueScores: buildValueScores(scores, variances, ranking, [], N), currentPair, phase: 'mapping', selectorState },
    };
  }

  const { scores, variances, ranking, selectorState } = replayComparisons(comparisons);
  const activeComps = comparisons.filter(c => !c.undone);
  const confidence = analyzeConfidence(scores, variances, activeComps);
  const phase = getPhase(comparisons, selectorState.seenValues.size, confidence);

  const currentPair = selectPair(selectorState, comparisons, scores, variances, ranking);
  const valueScores = buildValueScores(scores, variances, ranking, comparisons);

  return {
    session: { ...session, phase },
    snapshot: { scores, variances, ranking, valueScores, currentPair, phase, selectorState },
  };
}

export async function getOrCreateActiveSession(): Promise<{ session: Session; snapshot: EngineSnapshot } | null> {
  const existing = await getMostRecentActiveSession();
  if (existing) return resumeSession(existing.id);
  return null;
}

export interface TickResult {
  session: Session;
  snapshot: EngineSnapshot;
  done: boolean;
  hardCap: boolean;
}

export async function recordChoice(
  sessionId: string,
  prevSnapshot: EngineSnapshot,
  winnerId: number,
  loserId: number
): Promise<TickResult> {
  const comparison: Comparison = {
    sessionId,
    winnerId,
    loserId,
    timestamp: Date.now(),
  };

  await appendComparison(comparison);

  const comparisons = await getComparisons(sessionId);
  const activeComps = comparisons.filter(c => !c.undone);

  // Warm-start MAP from previous scores
  const scores = mapEstimate(prevSnapshot.scores, activeComps);
  const variances = laplaceVariances(scores, activeComps);
  const ranking = getRanking(scores);

  // Update selector state
  const selectorState = updatePairSelectorState(prevSnapshot.selectorState, [winnerId, loserId]);

  // Analyze confidence
  const confidence = analyzeConfidence(scores, variances, activeComps);
  const { stop, hardCap } = shouldStop(confidence, activeComps);
  const phase = stop ? 'done' : getPhase(comparisons, selectorState.seenValues.size, confidence);

  const now = Date.now();
  const session = await getSession(sessionId);
  const updatedSession: Session = {
    ...(session!),
    phase,
    comparisonCount: activeComps.length,
    updatedAt: now,
    completedAt: stop ? now : undefined,
  };
  await saveSession(updatedSession);

  if (stop) {
    // Save result snapshot
    const top2: [number, number] = [ranking[0], ranking[1]];
    const top25 = ranking.slice(0, 25);
    const result: ResultSnapshot = {
      id: uuidv4(),
      sessionId,
      createdAt: now,
      top2,
      top25,
      fullRanking: Array.from(ranking),
      totalComparisons: activeComps.length,
      confidenceTier: hardCap ? 'likely' : 'locked',
    };
    await saveResult(result);

    const valueScores = buildValueScores(scores, variances, ranking, comparisons);
    return {
      session: updatedSession,
      snapshot: { scores, variances, ranking, valueScores, currentPair: [ranking[0], ranking[1]], phase: 'done', selectorState },
      done: true,
      hardCap,
    };
  }

  const nextPair = selectPair(selectorState, comparisons, scores, variances, ranking);
  const valueScores = buildValueScores(scores, variances, ranking, comparisons);

  return {
    session: updatedSession,
    snapshot: { scores, variances, ranking, valueScores, currentPair: nextPair, phase, selectorState },
    done: false,
    hardCap: false,
  };
}

export async function undoChoice(
  sessionId: string,
  comparisons: Comparison[],
  prevSnapshot: EngineSnapshot
): Promise<EngineSnapshot | null> {
  const success = await undoLastComparison(sessionId);
  if (!success) return null;

  const updatedComparisons = await getComparisons(sessionId);
  const { scores, variances, ranking, selectorState } = replayComparisons(updatedComparisons);

  const activeComps = updatedComparisons.filter(c => !c.undone);
  const confidence = analyzeConfidence(scores, variances, activeComps);
  const phase = getPhase(updatedComparisons, selectorState.seenValues.size, confidence);
  const nextPair = selectPair(selectorState, updatedComparisons, scores, variances, ranking);
  const valueScores = buildValueScores(scores, variances, ranking, updatedComparisons);

  const session = await getSession(sessionId);
  if (session) {
    await saveSession({ ...session, phase, comparisonCount: activeComps.length, updatedAt: Date.now() });
  }

  return { scores, variances, ranking, valueScores, currentPair: nextPair, phase, selectorState };
}

const PRIOR_VAR_SQRT = 1.25;
