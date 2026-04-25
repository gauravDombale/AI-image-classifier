/* ──────────────────────────────────────────
   src/ml/noiseAnalysis.js
   Signal 6 — Noise Pattern Analysis (PRNU)
   Weight: 7%

   BIDIRECTIONAL SCORING (baseline 50)
   ────────────────────────────────────────── */

import * as tf from '@tensorflow/tfjs';

export async function noiseAnalysis(tensor64) {
  return tf.tidy(() => {
    const gray = tensor64.mean(3, true); // [1, 64, 64, 1]

    const kernel = [
       1,  4,  7,  4,  1,
       4, 16, 26, 16,  4,
       7, 26, 41, 26,  7,
       4, 16, 26, 16,  4,
       1,  4,  7,  4,  1,
    ].map(v => v / 273);

    const gaussKernel = tf.tensor4d(kernel, [5, 5, 1, 1]);
    const blurred     = tf.conv2d(gray, gaussKernel, 1, 'same');
    const noise       = tf.sub(gray, blurred).squeeze([0, 3]);

    const noiseValues = Array.from(noise.dataSync());
    const len         = noiseValues.length;
    const mean        = noiseValues.reduce((s, v) => s + v, 0) / len;
    const variance    = noiseValues.reduce((s, v) => s + (v - mean) ** 2, 0) / len;
    const std         = Math.sqrt(variance);

    const kurtosis = std > 0
      ? noiseValues.reduce((s, v) => s + ((v - mean) / std) ** 4, 0) / len
      : 3;

    const side = 64;
    let autocorr = 0;
    for (let i = 0; i < side - 1; i++) {
      for (let j = 0; j < side - 1; j++) {
        autocorr += (noiseValues[i * side + j] - mean) * (noiseValues[i * side + j + 1] - mean);
      }
    }
    const normAutocorr = variance > 0 ? Math.abs(autocorr / (variance * side * side)) : 0;

    // ── Bidirectional scoring (baseline = 50) ──────────────────
    let score = 50;

    // High autocorrelation → structured synthetic noise → AI
    if (normAutocorr > 0.35)      score += 28;
    else if (normAutocorr > 0.18) score += 14;
    else if (normAutocorr < 0.05) score -= 12;  // chaotic natural noise → real

    // Near-Gaussian kurtosis (≈3) → AI denoising process noise
    if (kurtosis < 3.2)       score += 18;
    else if (kurtosis < 4.0)  score += 8;
    else if (kurtosis > 6.5)  score -= 12;  // heavy-tailed real sensor noise
    else if (kurtosis > 5.5)  score -= 6;

    // Suspiciously low variance → no noise at all → AI
    if (variance < 0.00003)       score += 14;
    else if (variance > 0.0008)   score -= 10;  // lots of natural grain → real

    return {
      score:      Math.min(100, Math.max(0, score)),
      confidence: 0.62,
      label:      'Noise Fingerprint',
      detail:     `Autocorr: ${normAutocorr.toFixed(3)} · Kurtosis: ${kurtosis.toFixed(2)}`,
    };
  });
}
