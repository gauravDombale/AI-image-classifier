/* ──────────────────────────────────────────
   src/ml/scorer.js
   API-First ensemble scorer:
   1. Sightengine has first priority — if confident, it drives the final score
   2. HuggingFace acts as secondary anchor if Sightengine is unavailable
   3. Local signals (MobileNet, FFT, etc.) still show in cards but don't
      override the API verdict
   ────────────────────────────────────────── */

import { WEIGHTS, VERDICT } from '../utils/constants.js';

/**
 * Compute final score with API-first priority.
 * Returns { finalScore, confidence, unavailableSignals }
 */
export function computeFinalScore(signals) {
  const unavailableSignals = [];
  const seSig = signals['sightengine'];
  const hfSig = signals['huggingface'];

  // ── Priority 1: Sightengine (commercial API) ───────────────────
  if (seSig && seSig.confidence > 0) {
    // Use SE score directly — it's the most reliable signal
    // Do NOT blend with HF: if they disagree (SE=93%, HF=0%), SE wins
    const finalScore = Math.max(0, Math.min(100, seSig.score));
    const confidence = (finalScore < 25 || finalScore > 69) ? 'HIGH' : 'MED';

    const localKeys = ['mobilenet', 'frequency', 'color', 'edge', 'texture', 'noise', 'metadata'];
    for (const key of localKeys) {
      if (!signals[key] || signals[key].confidence === 0) unavailableSignals.push(key);
    }
    return { finalScore, confidence, unavailableSignals };
  }

  // ── Priority 2: HuggingFace only (Sightengine unavailable) ────
  if (hfSig && hfSig.confidence > 0) {
    unavailableSignals.push('sightengine');
    let finalScore = hfSig.score;

    // Blend in local signals at 25% total weight
    let localSum = 0, localCount = 0;
    const localKeys = ['mobilenet', 'frequency', 'color', 'edge', 'texture', 'noise', 'metadata'];
    for (const key of localKeys) {
      const sig = signals[key];
      if (sig && sig.confidence > 0) { localSum += sig.score; localCount++; }
      else unavailableSignals.push(key);
    }

    if (localCount > 0) {
      const localAvg = localSum / localCount;
      finalScore = Math.round(hfSig.score * 0.75 + localAvg * 0.25);
    }

    finalScore = Math.max(0, Math.min(100, finalScore));
    const confidence = localCount >= 3 ? 'MED' : 'LOW';
    return { finalScore, confidence, unavailableSignals };
  }

  // ── Priority 3: Local signals only (no APIs available) ────────
  unavailableSignals.push('sightengine', 'huggingface');

  let weightedSum = 0, totalWeight = 0;
  const activeScores = [];
  const localKeys = ['mobilenet', 'frequency', 'color', 'edge', 'texture', 'noise', 'metadata'];

  for (const key of localKeys) {
    const sig = signals[key];
    const weight = WEIGHTS[key] ?? 0.10;
    if (!sig || sig.confidence === 0) { unavailableSignals.push(key); continue; }
    const effectiveWeight = weight * (sig.confidence ?? 1.0);
    weightedSum += sig.score * effectiveWeight;
    totalWeight += effectiveWeight;
    activeScores.push(sig.score);
  }

  const raw = totalWeight > 0 ? weightedSum / totalWeight : 50;
  const finalScore = Math.round(Math.min(100, Math.max(0, raw)));
  const confidence = activeScores.length >= 4 ? 'MED' : 'LOW';

  return { finalScore, confidence, unavailableSignals };
}

/**
 * Derive verdict from score + confidence level.
 * If confidence is LOW, forces UNCERTAIN verdict regardless of score.
 */
export function getVerdict(score, confidence = 'HIGH') {
  if (confidence === 'LOW') {
    return {
      label:       'UNCERTAIN',
      color:       '#9ca3af',
      confidence:  'Low',
      description: 'API signals unavailable — result based on local analysis only. Try again or check your API keys.',
    };
  }

  const match = VERDICT.find(v => score >= v.min && score <= v.max) ?? VERDICT[0];
  if (confidence === 'MED') {
    return { ...match, confidence: 'Moderate' };
  }
  return match;
}
