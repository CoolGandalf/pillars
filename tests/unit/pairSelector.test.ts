import { describe, it, expect } from 'vitest';
import {
  createPairSelectorState,
  updatePairSelectorState,
  selectPair,
} from '@/lib/ranking/pairSelector';
import type { Comparison } from '@/types/pillars';

const N = 10; // use small N for tests

function makeComparison(winnerId: number, loserId: number): Comparison {
  return { sessionId: 'test', winnerId, loserId, timestamp: Date.now() };
}

describe('coverage phase', () => {
  it('ensures all values get seen', () => {
    const state = createPairSelectorState();
    let currentState = state;
    const comparisons: Comparison[] = [];
    const scores = new Float64Array(N);
    const variances = new Float64Array(N).fill(0.5);
    const seen = new Set<number>();

    // Run enough pairs to cover all values
    for (let i = 0; i < N * 2; i++) {
      const ranking = Array.from({ length: N }, (_, i) => i);
      const [a, b] = selectPair(currentState, comparisons, scores, variances, ranking, N);

      seen.add(a);
      seen.add(b);

      // Simulate a choice
      const comp = makeComparison(a, b);
      comparisons.push(comp);
      currentState = updatePairSelectorState(currentState, [a, b]);
    }

    expect(seen.size).toBe(N);
  });

  it('never returns same value vs itself', () => {
    let state = createPairSelectorState();
    const comparisons: Comparison[] = [];
    const scores = new Float64Array(N);
    const variances = new Float64Array(N).fill(0.5);
    const ranking = Array.from({ length: N }, (_, i) => i);

    for (let i = 0; i < 30; i++) {
      const [a, b] = selectPair(state, comparisons, scores, variances, ranking, N);
      expect(a).not.toBe(b);
      comparisons.push(makeComparison(a, b));
      state = updatePairSelectorState(state, [a, b]);
    }
  });

  it('returns valid indices', () => {
    let state = createPairSelectorState();
    const comparisons: Comparison[] = [];
    const scores = new Float64Array(N);
    const variances = new Float64Array(N).fill(0.5);
    const ranking = Array.from({ length: N }, (_, i) => i);

    for (let i = 0; i < 20; i++) {
      const [a, b] = selectPair(state, comparisons, scores, variances, ranking, N);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(N);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(N);
      comparisons.push(makeComparison(a, b));
      state = updatePairSelectorState(state, [a, b]);
    }
  });
});

describe('graph connectivity', () => {
  it('eventually connects all values', () => {
    let state = createPairSelectorState();
    const comparisons: Comparison[] = [];
    const scores = new Float64Array(N);
    const variances = new Float64Array(N).fill(0.5);

    // Run until all seen
    while (state.seenValues.size < N) {
      const ranking = Array.from({ length: N }, (_, i) => i);
      const [a, b] = selectPair(state, comparisons, scores, variances, ranking, N);
      comparisons.push(makeComparison(a, b));
      state = updatePairSelectorState(state, [a, b]);
    }

    // Check connectivity with union-find
    const parent = Array.from({ length: N }, (_, i) => i);
    function find(x: number): number {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    }
    for (const c of comparisons) {
      parent[find(c.winnerId)] = find(c.loserId);
    }
    const root = find(0);
    for (let i = 1; i < N; i++) {
      expect(find(i)).toBe(root);
    }
  });
});
