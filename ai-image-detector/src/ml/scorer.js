/* ──────────────────────────────────────────
   src/ml/scorer.js
   Confidence-weighted ensemble scorer
   ────────────────────────────────────────── */

import { WEIGHTS, VERDICT } from '../utils/constants.js';

/**
 * Compute final 0–100 score from 7 signal results.
 * Confidence-adjusts each signal: low-confidence signals contribute less.
 * Missing/failed signals are zero-weighted (not penalized).
 *
 * @param {Record<string, { score: number, confidence: number }>} signals
 * @returns {number} Integer 0–100
 */
export function computeFinalScore(signals) {
  let weightedSum  = 0;
  let totalWeight  = 0;

  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const sig = signals[key];
    if (!sig || sig.confidence === 0) continue;  // skip failed/skipped signals

    const effectiveWeight = weight * (sig.confidence ?? 1.0);
    weightedSum  += sig.score * effectiveWeight;
    totalWeight  += effectiveWeight;
  }

  const raw = totalWeight > 0 ? weightedSum / totalWeight : 50;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

/**
 * Derive verdict object from a numeric score.
 *
 * @param {number} score 0–100
 * @returns {{ label, color, confidence, description }}
 */
export function getVerdict(score) {
  return VERDICT.find(v => score >= v.min && score <= v.max) ?? VERDICT[0];
}
