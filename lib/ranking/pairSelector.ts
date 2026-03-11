/**
 * Adaptive pair selection for the BTL ranking session.
 *
 * Stage 1 (coverage): ensure every value appears at least once,
 *   and that the comparison graph is connected.
 * Stage 2 (information): maximize expected information gain,
 *   weighted by entropy, uncertainty, and phase focus.
 */

import type { Comparison } from '@/types/pillars';
import { N, VALUES } from '@/lib/catalog/values';
import { logistic, TAU } from '@/lib/ranking/btl';

export interface PairSelectorState {
  seenValues: Set<number>;
  recentPairs: Array<[number, number]>; // last 10 pairs shown
  comparisonCount: number;
}

export function createPairSelectorState(): PairSelectorState {
  return {
    seenValues: new Set(),
    recentPairs: [],
    comparisonCount: 0,
  };
}

/** Update seen values and recent pairs after a comparison */
export function updatePairSelectorState(
  state: PairSelectorState,
  pair: [number, number]
): PairSelectorState {
  const newSeen = new Set(state.seenValues);
  newSeen.add(pair[0]);
  newSeen.add(pair[1]);

  const newRecent = [...state.recentPairs, pair].slice(-10);

  return {
    seenValues: newSeen,
    recentPairs: newRecent,
    comparisonCount: state.comparisonCount + 1,
  };
}

/** Check if the comparison graph is connected using union-find */
function isGraphConnected(comparisons: Comparison[], n: number): boolean {
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }

  function union(x: number, y: number) {
    parent[find(x)] = find(y);
  }

  const activeComparisons = comparisons.filter(c => !c.undone);
  for (const c of activeComparisons) {
    union(c.winnerId, c.loserId);
  }

  const root = find(0);
  for (let i = 1; i < n; i++) {
    if (find(i) !== root) return false;
  }
  return true;
}

/**
 * Select the next pair to show.
 */
export function selectPair(
  state: PairSelectorState,
  comparisons: Comparison[],
  scores: Float64Array,
  variances: Float64Array,
  ranking: number[], // indices sorted best-first
  n: number = N
): [number, number] {
  const active = comparisons.filter(c => !c.undone);
  const allSeen = state.seenValues.size === n;
  const graphConnected = allSeen && isGraphConnected(active, n);

  // Stage 1: coverage
  if (!allSeen || !graphConnected) {
    return selectCoveragePair(state, active, n);
  }

  // Stage 2: information
  return selectInformationPair(state, scores, variances, ranking, n);
}

function selectCoveragePair(
  state: PairSelectorState,
  active: Comparison[],
  n: number
): [number, number] {
  // Find unseen values
  const unseen = [];
  for (let i = 0; i < n; i++) {
    if (!state.seenValues.has(i)) unseen.push(i);
  }

  if (unseen.length > 0) {
    // Pick a random unseen value
    const newValue = unseen[Math.floor(Math.random() * unseen.length)];

    if (state.seenValues.size === 0) {
      // First pair: pick two unseen values
      const other = unseen.filter(v => v !== newValue);
      if (other.length > 0) {
        const secondValue = other[Math.floor(Math.random() * other.length)];
        return shuffle([newValue, secondValue]) as [number, number];
      }
      return [0, 1]; // fallback for n=1
    }

    // Pair with a random seen value, avoiding recent repeats
    const seenArr = Array.from(state.seenValues);
    const recentSet = new Set(state.recentPairs.flatMap(p => p));
    const freshSeen = seenArr.filter(v => !recentSet.has(v));
    const anchor = freshSeen.length > 0
      ? freshSeen[Math.floor(Math.random() * freshSeen.length)]
      : seenArr[Math.floor(Math.random() * seenArr.length)];

    return shuffle([newValue, anchor]) as [number, number];
  }

  // All seen but graph not connected — find a bridging pair
  // Pick two values from different components
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(x: number, y: number) {
    parent[find(x)] = find(y);
  }

  for (const c of active) union(c.winnerId, c.loserId);

  // Find two values in different components
  const root = find(0);
  for (let i = 1; i < n; i++) {
    if (find(i) !== root) {
      return shuffle([0, i]) as [number, number];
    }
  }

  // Fallback (shouldn't happen)
  return randomPair(n, state.recentPairs);
}

function selectInformationPair(
  state: PairSelectorState,
  scores: Float64Array,
  variances: Float64Array,
  ranking: number[],
  n: number
): [number, number] {
  const recentSet = buildRecentSet(state.recentPairs);

  // Top 6 and boundary band (ranks 18-32) get focus weight boost
  const focusSet = new Set<number>();
  for (let r = 0; r < Math.min(6, n); r++) focusSet.add(ranking[r]);
  for (let r = 17; r < Math.min(32, n); r++) focusSet.add(ranking[r]);

  // Sample candidate pairs and score them
  const nCandidates = Math.min(250, Math.floor(n * (n - 1) / 2));
  let bestScore = -Infinity;
  let bestPair: [number, number] = [0, 1];

  // Generate random candidate pairs
  const attempts = nCandidates * 3;
  let evaluated = 0;

  for (let attempt = 0; attempt < attempts && evaluated < nCandidates; attempt++) {
    const i = Math.floor(Math.random() * n);
    let j = Math.floor(Math.random() * (n - 1));
    if (j >= i) j++;

    const key = pairKey(i, j);
    if (recentSet.has(key)) continue;
    evaluated++;

    const p = logistic(scores[i] - scores[j]);
    const entropy = binaryEntropy(p);
    const uncertainty = Math.sqrt(variances[i]) + Math.sqrt(variances[j]);
    const focusWeight = (focusSet.has(i) || focusSet.has(j)) ? 2.0 : 1.0;
    const score = entropy * uncertainty * focusWeight;

    if (score > bestScore) {
      bestScore = score;
      bestPair = [i, j];
    }
  }

  return shuffle(bestPair) as [number, number];
}

function binaryEntropy(p: number): number {
  if (p <= 0 || p >= 1) return 0;
  return -p * Math.log(p) - (1 - p) * Math.log(1 - p);
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a},${b}` : `${b},${a}`;
}

function buildRecentSet(recentPairs: Array<[number, number]>): Set<string> {
  return new Set(recentPairs.map(([a, b]) => pairKey(a, b)));
}

function randomPair(n: number, recentPairs: Array<[number, number]>): [number, number] {
  const recentSet = buildRecentSet(recentPairs);
  for (let attempt = 0; attempt < 100; attempt++) {
    const i = Math.floor(Math.random() * n);
    let j = Math.floor(Math.random() * (n - 1));
    if (j >= i) j++;
    if (!recentSet.has(pairKey(i, j))) return [i, j];
  }
  return [0, 1];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  if (Math.random() < 0.5) [a[0], a[1]] = [a[1], a[0]];
  return a;
}

/** Force top-4 round-robin when top-2 is unstable */
export function forcedCheckPair(
  ranking: number[],
  comparisons: Comparison[],
  state: PairSelectorState
): [number, number] | null {
  const top4 = ranking.slice(0, 4);
  const recentSet = buildRecentSet(state.recentPairs);

  // Find a top-4 pair not shown recently
  for (let i = 0; i < top4.length; i++) {
    for (let j = i + 1; j < top4.length; j++) {
      const key = pairKey(top4[i], top4[j]);
      if (!recentSet.has(key)) return [top4[i], top4[j]];
    }
  }
  return null;
}

/** Force boundary check among ranks 22-28 */
export function boundaryCheckPair(
  ranking: number[],
  state: PairSelectorState
): [number, number] | null {
  const start = Math.max(0, 21);
  const end = Math.min(ranking.length - 1, 27);
  const boundary = ranking.slice(start, end + 1);
  const recentSet = buildRecentSet(state.recentPairs);

  for (let i = 0; i < boundary.length; i++) {
    for (let j = i + 1; j < boundary.length; j++) {
      const key = pairKey(boundary[i], boundary[j]);
      if (!recentSet.has(key)) return [boundary[i], boundary[j]];
    }
  }
  return null;
}
