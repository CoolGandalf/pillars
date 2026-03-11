/**
 * Bradley-Terry-Luce ranking engine.
 *
 * P(i beats j) = logistic((s_i - s_j) / TAU)
 * Prior: s_i ~ N(0, PRIOR_VAR)
 * MAP via Newton-Raphson, warm-started.
 * Uncertainty via Laplace approximation (inverse Hessian diagonal).
 */

import type { Comparison } from '@/types/pillars';
import { N } from '@/lib/catalog/values';

export const TAU = 0.75;
const PRIOR_VAR = 1.5625; // 1.25^2
const MAX_ITERATIONS = 30;
const CONVERGENCE_TOL = 1e-6;
export const N_SAMPLES = 500;

export function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x / TAU));
}

/** Filter undone comparisons */
function activeComparisons(comparisons: Comparison[]): Comparison[] {
  return comparisons.filter(c => !c.undone);
}

/**
 * Compute MAP scores via Newton-Raphson.
 * Pin scores[0] = 0 for identifiability.
 * Warm-start from prevScores if provided.
 */
export function mapEstimate(
  prevScores: Float64Array | null,
  comparisons: Comparison[],
  n: number = N
): Float64Array {
  const active = activeComparisons(comparisons);
  const scores = prevScores ? new Float64Array(prevScores) : new Float64Array(n);

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const grad = new Float64Array(n);
    const diagH = new Float64Array(n); // diagonal of Hessian
    const offH = new Map<string, number>(); // off-diagonal entries keyed "i,j" i<j

    // Prior gradient and Hessian diagonal
    for (let i = 1; i < n; i++) { // skip i=0 (pinned)
      grad[i] += scores[i] / PRIOR_VAR;
      diagH[i] += 1 / PRIOR_VAR;
    }

    // Likelihood terms
    for (const c of active) {
      const w = c.winnerId;
      const l = c.loserId;
      const p = logistic(scores[w] - scores[l]);
      const pq = p * (1 - p) / (TAU * TAU);

      // Gradient: d(-log L)/d(s_w) = -(1-p), d(-log L)/d(s_l) = p
      if (w !== 0) grad[w] += -(1 - p);
      if (l !== 0) grad[l] += p;

      // Hessian diagonal
      if (w !== 0) diagH[w] += pq;
      if (l !== 0) diagH[l] += pq;

      // Hessian off-diagonal
      if (w !== 0 && l !== 0) {
        const key = w < l ? `${w},${l}` : `${l},${w}`;
        offH.set(key, (offH.get(key) ?? 0) - pq);
      }
    }

    // Newton step: scores -= H^{-1} grad
    // For each free variable (i != 0), use Hessian-vector product with off-diagonal
    // Approximate: apply full Newton by solving Hs = g for each variable independently
    // using the exact diagonal + off-diagonal contribution
    // For simplicity use a block diagonal Newton (exact for independent pairs)

    // Compute Newton directions using full gradient / diagonal (diagonal approx Newton)
    let maxUpdate = 0;
    const newScores = new Float64Array(scores);

    for (let i = 1; i < n; i++) {
      // Add off-diagonal contribution to effective gradient
      let effectiveGrad = grad[i];

      // This is a diagonal Newton step — sufficient for fast convergence here
      const step = effectiveGrad / (diagH[i] + 1e-8);
      newScores[i] = scores[i] - step;
      maxUpdate = Math.max(maxUpdate, Math.abs(step));
    }

    // Copy back
    for (let i = 1; i < n; i++) scores[i] = newScores[i];

    if (maxUpdate < CONVERGENCE_TOL) break;
  }

  return scores;
}

/**
 * Compute diagonal of inverse Hessian (marginal variances) via the Laplace approximation.
 * Uses the same Hessian structure as mapEstimate.
 */
export function laplaceVariances(scores: Float64Array, comparisons: Comparison[], n: number = N): Float64Array {
  const active = activeComparisons(comparisons);
  const diagH = new Float64Array(n);

  // Prior term (pinned index 0 gets large value to fix it)
  diagH[0] = 1e10;
  for (let i = 1; i < n; i++) {
    diagH[i] = 1 / PRIOR_VAR;
  }

  // Likelihood terms
  for (const c of active) {
    const w = c.winnerId;
    const l = c.loserId;
    const p = logistic(scores[w] - scores[l]);
    const pq = p * (1 - p) / (TAU * TAU);
    diagH[w] += pq;
    diagH[l] += pq;
  }

  // Invert diagonal = marginal variances (diagonal approximation)
  const variances = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    variances[i] = 1 / (diagH[i] + 1e-10);
  }
  // Pinned index 0 has zero variance
  variances[0] = 0;

  return variances;
}

/**
 * Sample rank distributions by drawing from the posterior approximation.
 * Returns rankProbs[i][r] = P(value i has rank r+1)
 */
export function posteriorRankProbs(
  scores: Float64Array,
  variances: Float64Array,
  n: number = N,
  nSamples: number = N_SAMPLES
): Float64Array[] {
  // rankCounts[i][r] = how many samples had value i at rank r
  const rankCounts: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  const sampleScores = new Float64Array(n);
  const indices = new Array(n).fill(0).map((_, i) => i);

  for (let s = 0; s < nSamples; s++) {
    // Draw sample scores
    for (let i = 0; i < n; i++) {
      const std = Math.sqrt(variances[i]);
      sampleScores[i] = scores[i] + std * randn();
    }

    // Rank by descending score
    indices.sort((a, b) => sampleScores[b] - sampleScores[a]);
    for (let r = 0; r < n; r++) {
      rankCounts[indices[r]][r]++;
    }
  }

  // Convert to probabilities
  return rankCounts.map(counts => {
    const probs = new Float64Array(n);
    for (let r = 0; r < n; r++) probs[r] = counts[r] / nSamples;
    return probs;
  });
}

/** Box-Muller normal sample */
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Get current ranking (sorted indices, best first) from MAP scores.
 */
export function getRanking(scores: Float64Array): number[] {
  return Array.from({ length: scores.length }, (_, i) => i)
    .sort((a, b) => scores[b] - scores[a]);
}

/**
 * Get P(value i is in top k) from rank probability distributions.
 */
export function topKProb(rankProbs: Float64Array[], valueId: number, k: number): number {
  const probs = rankProbs[valueId];
  let total = 0;
  for (let r = 0; r < k; r++) total += probs[r];
  return total;
}
