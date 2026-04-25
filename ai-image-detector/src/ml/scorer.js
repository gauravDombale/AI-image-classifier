/* ──────────────────────────────────────────
   src/ml/scorer.js
   Confidence-weighted ensemble scorer with:
   - Signal disagreement detection → forces UNCERTAIN
   - Reduced confidence when HF is unavailable
   - Full result shape per improvement.md
   ────────────────────────────────────────── */

import { WEIGHTS, VERDICT } from '../utils/constants.js';

const HIGH_VARIANCE_THRESHOLD = 450;   // std deviation of scores
const MIN_CONFIDENT_SIGNALS   = 3;     // minimum needed for high confidence

/**
 * Compute final score + confidence from all signal results.
 * Returns { finalScore, confidence, unavailableSignals }
 */
export function computeFinalScore(signals) {
  let weightedSum  = 0;
  let totalWeight  = 0;
  const activeScores      = [];
  const unavailableSignals = [];

  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const sig = signals[key];
    if (!sig || sig.confidence === 0) {
      unavailableSignals.push(key);
      continue;
    }
    const effectiveWeight = weight * (sig.confidence ?? 1.0);
    weightedSum  += sig.score * effectiveWeight;
    totalWeight  += effectiveWeight;
    activeScores.push(sig.score);
  }

  const raw = totalWeight > 0 ? weightedSum / totalWeight : 50;
  const finalScore = Math.round(Math.min(100, Math.max(0, raw)));

  // ── Signal disagreement detection ──────────────────────────
  let confidence = 'HIGH';
  if (activeScores.length < MIN_CONFIDENT_SIGNALS) {
    confidence = 'LOW';
  } else {
    const mean = activeScores.reduce((s, v) => s + v, 0) / activeScores.length;
    const variance = activeScores.reduce((s, v) => s + (v - mean) ** 2, 0) / activeScores.length;

    const hfSig = signals['huggingface'];
    const hfConfidence = hfSig?.confidence ?? 0;

    if (variance > HIGH_VARIANCE_THRESHOLD && hfConfidence < 0.75) {
      confidence = 'LOW';   // Signals disagree strongly — force uncertain verdict
    } else if (variance > HIGH_VARIANCE_THRESHOLD / 2 || unavailableSignals.includes('huggingface')) {
      confidence = 'MED';
    }
  }

  return { finalScore, confidence, unavailableSignals };
}

/**
 * Derive verdict from score + confidence level.
 * If confidence is LOW, forces UNCERTAIN verdict regardless of score.
 */
export function getVerdict(score, confidence = 'HIGH') {
  // Force uncertain if signals disagree or too few active
  if (confidence === 'LOW') {
    return {
      label:       'UNCERTAIN',
      color:       '#9ca3af',
      confidence:  'Low',
      description: 'Signals disagree or too few signals completed. Result is inconclusive — try a higher resolution image.',
    };
  }

  const match = VERDICT.find(v => score >= v.min && score <= v.max) ?? VERDICT[0];
  if (confidence === 'MED') {
    return { ...match, confidence: 'Moderate' };
  }
  return match;
}
