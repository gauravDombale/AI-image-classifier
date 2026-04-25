/* ──────────────────────────────────────────
   src/ml/mobilenetFeatures.js
   Signal 1 — MobileNet v3 Semantic Embedding
   Weight: 10%

   BIDIRECTIONAL SCORING (baseline 50):
   - Score > 50 → AI indicators detected
   - Score < 50 → Real photo indicators detected
   - Score = 50 → Neutral / uncertain
   ────────────────────────────────────────── */

import * as mobilenet from '@tensorflow-models/mobilenet';
import * as tf from '@tensorflow/tfjs';

let _model = null;

export async function loadMobileNet() {
  if (_model) return _model;
  _model = await mobilenet.load({ version: 2, alpha: 1.0 });
  return _model;
}

export async function mobilenetFeatures(tensor224) {
  if (!_model) throw new Error('MobileNet not loaded.');

  return tf.tidy(() => {
    const embedding = _model.infer(tensor224, true);
    const values    = Array.from(embedding.dataSync());

    // L2 Norm
    const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0));

    // Activation Sparsity
    const sparsity = values.filter(v => Math.abs(v) < 0.01).length / values.length;

    // Kurtosis
    const mean     = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const kurtosis = variance > 0
      ? values.reduce((s, v) => s + (v - mean) ** 4, 0) / (values.length * variance ** 2)
      : 3;

    // ── Bidirectional scoring (baseline = 50) ──────────────────
    let score = 50;

    // Norm: AI images tend to have lower norm
    if (norm < 12)       score += 25;
    else if (norm < 18)  score += 12;
    else if (norm > 28)  score -= 12;  // clearly real
    else if (norm > 35)  score -= 20;

    // Sparsity: AI images have higher sparsity
    if (sparsity > 0.70)       score += 20;
    else if (sparsity > 0.55)  score += 10;
    else if (sparsity < 0.30)  score -= 12;
    else if (sparsity < 0.20)  score -= 20;

    // Kurtosis: peaky distributions → AI
    if (kurtosis > 7)       score += 10;
    else if (kurtosis > 5)  score += 5;
    else if (kurtosis < 2)  score -= 8;

    return {
      score:      Math.min(100, Math.max(0, score)),
      confidence: 0.65,
      label:      'Embedding Anomaly',
      detail:     `L2 norm: ${norm.toFixed(1)} · Sparsity: ${(sparsity * 100).toFixed(0)}% · Kurtosis: ${kurtosis.toFixed(1)}`,
    };
  });
}
