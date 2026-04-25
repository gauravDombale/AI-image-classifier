/* ──────────────────────────────────────────
   src/ml/edgeAnalysis.js
   Signal 4 — Edge Sharpness & Uniformity
   Weight: 8%

   BIDIRECTIONAL SCORING (baseline 50)
   ────────────────────────────────────────── */

import * as tf from '@tensorflow/tfjs';

export async function edgeAnalysis(tensor224) {
  return tf.tidy(() => {
    const gray = tensor224.mean(3, true); // [1, 224, 224, 1]

    const sobelX = tf.tensor4d([-1,0,1,-2,0,2,-1,0,1], [3, 3, 1, 1]);
    const sobelY = tf.tensor4d([-1,-2,-1,0,0,0,1,2,1], [3, 3, 1, 1]);

    const gx = tf.conv2d(gray, sobelX, 1, 'same').squeeze([0, 3]);
    const gy = tf.conv2d(gray, sobelY, 1, 'same').squeeze([0, 3]);

    const magnitude = tf.sqrt(tf.add(tf.square(gx), tf.square(gy)));
    const magValues = Array.from(magnitude.dataSync());
    const len       = magValues.length;
    const mean      = magValues.reduce((s, v) => s + v, 0) / len;
    const variance  = magValues.reduce((s, v) => s + (v - mean) ** 2, 0) / len;
    const std       = Math.sqrt(variance);
    const cv        = mean > 0 ? std / mean : 0;  // coefficient of variation

    // ── Bidirectional scoring (baseline = 50) ──────────────────
    let score = 50;

    // CV: Low = unnaturally uniform edges (AI); High = natural irregularity (real)
    if (cv < 1.0)       score += 28;
    else if (cv < 1.5)  score += 14;
    else if (cv > 2.8)  score -= 16;  // naturally irregular edges
    else if (cv > 2.2)  score -= 8;

    // Over-sharpened (high mean, low variance) → AI diffusion artifact
    if (mean > 0.22 && cv < 1.6)  score += 15;

    // Unnaturally smooth / near-featureless
    if (mean < 0.03)               score += 12;

    // Natural optical blur / depth of field
    if (mean > 0.05 && cv > 2.5)  score -= 10;

    return {
      score:      Math.min(100, Math.max(0, score)),
      confidence: 0.62,
      label:      'Edge Uniformity',
      detail:     `Edge CV: ${cv.toFixed(2)} · Mean strength: ${(mean * 255).toFixed(1)}`,
    };
  });
}
