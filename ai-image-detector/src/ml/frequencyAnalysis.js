/* ──────────────────────────────────────────
   src/ml/frequencyAnalysis.js
   Signal 2 — FFT Frequency Domain Analysis
   Weight: 10%

   BIDIRECTIONAL SCORING (baseline 50)
   ────────────────────────────────────────── */

import * as tf from '@tensorflow/tfjs';

export async function frequencyAnalysis(pixelData, width, height) {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = 0.299 * pixelData[i * 4] + 0.587 * pixelData[i * 4 + 1] + 0.114 * pixelData[i * 4 + 2];
  }

  return tf.tidy(() => {
    const grayTensor = tf.tensor2d(gray, [height, width]);
    const spectrum   = tf.spectral.rfft(grayTensor);
    const magnitude  = tf.abs(spectrum);

    const cols        = Math.floor(width / 2) + 1;
    const lowFreqCols = Math.max(1, Math.floor(cols * 0.10));
    const highFreqCol = Math.floor(cols * 0.50);

    const allEnergy  = magnitude.sum().dataSync()[0];
    const lowEnergy  = magnitude.slice([0, 0], [height, lowFreqCols]).sum().dataSync()[0];
    const highEnergy = magnitude.slice([0, highFreqCol], [height, cols - highFreqCol]).sum().dataSync()[0];

    const highRatio = allEnergy > 0 ? highEnergy / allEnergy : 0;
    const lowRatio  = allEnergy > 0 ? lowEnergy  / allEnergy : 0;

    const magValues = Array.from(magnitude.dataSync());
    const sorted    = [...magValues].sort((a, b) => a - b);
    const median    = sorted[Math.floor(sorted.length / 2)];
    const peakCount = magValues.filter(v => v > median * 5).length;
    const peakRatio = peakCount / magValues.length;

    // ── Bidirectional scoring (baseline = 50) ──────────────────
    let score = 50;

    // GAN grid artifacts → strong AI indicator
    if (peakRatio > 0.025)      score += 30;
    else if (peakRatio > 0.012) score += 15;
    else if (peakRatio < 0.003) score -= 10;  // very natural spectrum

    // High frequency energy distribution
    if (highRatio > 0.42)      score += 18;
    else if (highRatio > 0.32) score += 8;
    else if (highRatio < 0.15) score -= 12;  // natural low-freq dominant images

    // Low frequency dominance (natural photos are low-freq dominant)
    if (lowRatio > 0.35)       score -= 15;  // very natural
    else if (lowRatio < 0.04)  score += 10;

    return {
      score:      Math.min(100, Math.max(0, score)),
      confidence: 0.72,
      label:      'Frequency Artifacts',
      detail:     `Peak anomalies: ${(peakRatio * 100).toFixed(2)}% · High-freq ratio: ${(highRatio * 100).toFixed(0)}%`,
    };
  });
}
