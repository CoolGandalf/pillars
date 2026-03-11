/**
 * Confidence calculations and stopping criteria.
 */

import type { Comparison } from '@/types/pillars';
import type { Phase } from '@/types/pillars';
import { N } from '@/lib/catalog/values';
import { posteriorRankProbs, topKProb, getRanking } from '@/lib/ranking/btl';

export interface ConfidenceResult {
  ranking: number[];        // value IDs, best-first
  top2Probs: number[];      // P(value i is in top 2)
  top25Probs: number[];     // P(value i is in top 25)
  top2Stable: boolean;
  boundaryConfident: boolean;
  rankProbs: Float64Array[];
}

/**
 * Run the full confidence analysis.
 */
export function analyzeConfidence(
  scores: Float64Array,
  variances: Float64Array,
  comparisons: Comparison[],
  n: number = N
): ConfidenceResult {
  const ranking = getRanking(scores);
  const rankProbs = posteriorRankProbs(scores, variances, n);

  const top2Probs = Array.from({ length: n }, (_, i) => topKProb(rankProbs, i, 2));
  const top25Probs = Array.from({ length: n }, (_, i) => topKProb(rankProbs, i, 25));

  const top2Stable = isTop2Stable(rankProbs, ranking, n);
  const boundaryConfident = isBoundaryConfident(rankProbs, ranking, 25, n);

  return { ranking, top2Probs, top25Probs, top2Stable, boundaryConfident, rankProbs };
}

/**
 * Check if the same two values appear in the top 2 in >= threshold of posterior samples.
 */
export function isTop2Stable(
  rankProbs: Float64Array[],
  ranking: number[],
  n: number = N,
  threshold = 0.85
): boolean {
  // The current top 2 set
  const t1 = ranking[0];
  const t2 = ranking[1];

  // P(both t1 and t2 are in top 2) ≈ P(t1 in top 2) * P(t2 in top 2) (approx, not exact)
  // Better: compute directly from rank probs
  const p1 = topKProb(rankProbs, t1, 2);
  const p2 = topKProb(rankProbs, t2, 2);

  // Both must be stable; check no outsider has high top-2 probability
  const pBothStable = Math.min(p1, p2);
  if (pBothStable < threshold) return false;

  // No other value should have P(top 2) > 0.20
  for (let i = 0; i < n; i++) {
    if (i === t1 || i === t2) continue;
    if (topKProb(rankProbs, i, 2) > 0.20) return false;
  }

  return true;
}

/**
 * Check if the rank 25/26 boundary is confident.
 */
export function isBoundaryConfident(
  rankProbs: Float64Array[],
  ranking: number[],
  cutoff = 25,
  n: number = N
): boolean {
  if (n <= cutoff) return true;

  // No value ranked 26-30 should have P(rank <= 25) > 0.40
  const limit = Math.min(cutoff + 5, n);
  for (let r = cutoff; r < limit; r++) {
    const valueId = ranking[r];
    if (topKProb(rankProbs, valueId, cutoff) > 0.40) return false;
  }

  return true;
}

/**
 * Appearance counts per value from active comparisons.
 */
export function getAppearanceCounts(
  comparisons: Comparison[],
  ranking: number[],
  n: number = N
): number[] {
  const counts = new Array(n).fill(0);
  for (const c of comparisons) {
    if (c.undone) continue;
    counts[c.winnerId]++;
    counts[c.loserId]++;
  }
  return counts;
}

/**
 * Check minimum appearance requirements.
 */
export function hasMinimumAppearances(
  comparisons: Comparison[],
  ranking: number[],
  n: number = N
): boolean {
  const counts = getAppearanceCounts(comparisons, ranking, n);

  // Top 2: each shown >= 5 times
  for (let r = 0; r < 2; r++) {
    if (counts[ranking[r]] < 5) return false;
  }
  // Top 10: each shown >= 3 times
  for (let r = 0; r < Math.min(10, n); r++) {
    if (counts[ranking[r]] < 3) return false;
  }
  // Top 25: each shown >= 2 times
  for (let r = 0; r < Math.min(25, n); r++) {
    if (counts[ranking[r]] < 2) return false;
  }

  return true;
}

/**
 * Check full stopping criteria.
 */
export function shouldStop(
  confidence: ConfidenceResult,
  comparisons: Comparison[],
  n: number = N
): { stop: boolean; hardCap: boolean } {
  const active = comparisons.filter(c => !c.undone);
  const count = active.length;
  const hardCap = n + 80;

  if (count >= hardCap) return { stop: true, hardCap: true };

  // Only start checking after N+20 comparisons
  if (count < n + 20) return { stop: false, hardCap: false };

  const meetsAll =
    confidence.top2Stable &&
    confidence.boundaryConfident &&
    hasMinimumAppearances(active, confidence.ranking, n);

  return { stop: meetsAll, hardCap: false };
}

/**
 * Determine current phase based on engine state.
 */
export function getPhase(
  comparisons: Comparison[],
  seenCount: number,
  confidence: ConfidenceResult | null,
  n: number = N
): Phase {
  const active = comparisons.filter(c => !c.undone).length;

  if (seenCount < n || active < n) return 'mapping';

  if (confidence && confidence.top2Stable && active >= n + 20) return 'locking';

  return 'refining';
}
