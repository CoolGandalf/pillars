import { describe, it, expect } from 'vitest';
import {
  logistic,
  mapEstimate,
  laplaceVariances,
  posteriorRankProbs,
  getRanking,
  topKProb,
  TAU,
} from '@/lib/ranking/btl';
import type { Comparison } from '@/types/pillars';

function makeComparison(winnerId: number, loserId: number, sessionId = 'test'): Comparison {
  return { sessionId, winnerId, loserId, timestamp: Date.now() };
}

describe('logistic', () => {
  it('returns 0.5 for zero input', () => {
    expect(logistic(0)).toBeCloseTo(0.5);
  });

  it('returns near 1 for large positive input', () => {
    expect(logistic(10)).toBeGreaterThan(0.99);
  });

  it('returns near 0 for large negative input', () => {
    expect(logistic(-10)).toBeLessThan(0.01);
  });

  it('is symmetric: logistic(x) + logistic(-x) = 1', () => {
    expect(logistic(1.5) + logistic(-1.5)).toBeCloseTo(1);
  });
});

describe('mapEstimate', () => {
  it('initializes to zeros when no prev scores', () => {
    const comparisons: Comparison[] = [];
    const scores = mapEstimate(null, comparisons, 5);
    expect(scores.length).toBe(5);
    expect(scores[0]).toBe(0); // pinned
  });

  it('recovers known ordering from synthetic data', () => {
    // True scores: value 0 > 1 > 2 > 3 > 4
    // Generate comparisons based on true ordering
    const n = 5;
    const trueScores = [2, 1, 0, -1, -2];
    const comparisons: Comparison[] = [];

    // All pairs
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        // Winner is the one with higher true score
        const winner = trueScores[i] > trueScores[j] ? i : j;
        const loser = winner === i ? j : i;
        comparisons.push(makeComparison(winner, loser));
      }
    }

    const scores = mapEstimate(null, comparisons, n);
    const ranking = getRanking(scores);

    // Should recover 0 > 1 > 2 > 3 > 4
    expect(ranking[0]).toBe(0);
    expect(ranking[1]).toBe(1);
    expect(ranking[4]).toBe(4);
  });

  it('ignores undone comparisons', () => {
    const comparisons: Comparison[] = [
      makeComparison(1, 0), // 1 beats 0
      { ...makeComparison(0, 1), undone: true }, // undone
    ];

    const scores = mapEstimate(null, comparisons, 3);
    // With only 1 beating 0, value 1 should score higher than 0
    expect(scores[1]).toBeGreaterThan(scores[0]);
  });

  it('warm starts from previous scores', () => {
    const n = 5;
    const comparisons = [makeComparison(1, 2), makeComparison(1, 3)];
    const prev = mapEstimate(null, comparisons, n);
    const withWarm = mapEstimate(prev, [...comparisons, makeComparison(1, 4)], n);
    // Both should rank value 1 highly
    const rank1 = getRanking(withWarm);
    expect(rank1[0]).toBe(1);
  });
});

describe('laplaceVariances', () => {
  it('returns n variances', () => {
    const scores = new Float64Array(5);
    const comparisons: Comparison[] = [];
    const variances = laplaceVariances(scores, comparisons, 5);
    expect(variances.length).toBe(5);
  });

  it('pinned index 0 has zero variance', () => {
    const scores = new Float64Array(5);
    const comparisons = [makeComparison(1, 2)];
    const variances = laplaceVariances(scores, comparisons, 5);
    expect(variances[0]).toBe(0);
  });

  it('values with more comparisons have lower variance', () => {
    const n = 4;
    const manyComparisons = [
      makeComparison(1, 2),
      makeComparison(1, 3),
      makeComparison(1, 2),
      makeComparison(1, 3),
    ];
    const fewComparisons = [makeComparison(2, 3)];

    const scores = new Float64Array(n);
    const allComp = [...manyComparisons, ...fewComparisons];
    const variances = laplaceVariances(scores, allComp, n);

    // Value 1 appears 4 times, value 2 appears 3 times, value 3 appears 3 times
    // Pinned: value 0 has 0 variance
    // Value 1 should have lower variance than any with fewer appearances
    expect(variances[1]).toBeLessThan(variances[0] + 1); // 0 is pinned so it's 0
  });
});

describe('posteriorRankProbs + topKProb', () => {
  it('returns rank probs for all values', () => {
    const n = 5;
    const scores = new Float64Array([0, 2, 1, -1, -2]);
    const variances = new Float64Array(n).fill(0.1);
    const rankProbs = posteriorRankProbs(scores, variances, n, 200);

    expect(rankProbs.length).toBe(n);
    expect(rankProbs[0].length).toBe(n);

    // Each row sums to 1
    for (let i = 0; i < n; i++) {
      const sum = Array.from(rankProbs[i]).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 1);
    }
  });

  it('top-1 prob is highest for value with best score', () => {
    const n = 5;
    // Value 3 has best score
    const scores = new Float64Array([0, 0.5, 0.3, 2.0, -1]);
    const variances = new Float64Array(n).fill(0.01); // low variance = deterministic
    const rankProbs = posteriorRankProbs(scores, variances, n, 500);

    const top1Prob3 = topKProb(rankProbs, 3, 1);
    expect(top1Prob3).toBeGreaterThan(0.9); // Should be rank 1 almost always
  });
});

describe('getRanking', () => {
  it('sorts by descending score', () => {
    const scores = new Float64Array([0, -1, 3, 1, -2]);
    const ranking = getRanking(scores);
    expect(ranking[0]).toBe(2); // score 3
    expect(ranking[1]).toBe(3); // score 1
    expect(ranking[2]).toBe(0); // score 0
    expect(ranking[3]).toBe(1); // score -1
    expect(ranking[4]).toBe(4); // score -2
  });
});
