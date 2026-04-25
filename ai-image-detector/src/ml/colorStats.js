/* ──────────────────────────────────────────
   src/ml/colorStats.js
   Signal 3 — Color Distribution Statistics
   Weight: 8%

   BIDIRECTIONAL SCORING (baseline 50)
   ────────────────────────────────────────── */

export async function colorStats(pixelData) {
  const n = pixelData.length / 4;
  const r = new Float32Array(n);
  const g = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    r[i] = pixelData[i * 4];
    g[i] = pixelData[i * 4 + 1];
    b[i] = pixelData[i * 4 + 2];
  }

  function channelStats(arr) {
    const len  = arr.length;
    const mean = arr.reduce((s, v) => s + v, 0) / len;
    const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / len;
    const std  = Math.sqrt(variance);
    const skewness = std > 0
      ? arr.reduce((s, v) => s + ((v - mean) / std) ** 3, 0) / len
      : 0;
    return { mean, std, skewness };
  }

  function histEntropy(arr) {
    const bins  = new Array(32).fill(0);
    arr.forEach(v => bins[Math.floor(Math.min(v, 254) / 8)]++);
    const total = arr.length;
    return -bins.reduce((s, c) => {
      const p = c / total;
      return s + (p > 0 ? p * Math.log2(p) : 0);
    }, 0);
  }

  const rS = channelStats(r);
  const gS = channelStats(g);
  const bS = channelStats(b);

  const avgStd   = (rS.std + gS.std + bS.std) / 3;
  const entropy  = (histEntropy(r) + histEntropy(g) + histEntropy(b)) / 3;
  const avgSkew  = Math.abs(rS.skewness + gS.skewness + bS.skewness) / 3;

  // ── Bidirectional scoring (baseline = 50) ──────────────────
  let score = 50;

  // Color std: AI → unnaturally uniform; Real → wide variance
  if (avgStd < 28)       score += 25;
  else if (avgStd < 40)  score += 12;
  else if (avgStd > 65)  score -= 15;  // natural wide color range
  else if (avgStd > 55)  score -= 8;

  // Histogram entropy: AI → smooth; Real → noisy/complex
  if (entropy < 3.2)       score += 22;
  else if (entropy < 4.0)  score += 10;
  else if (entropy > 4.8)  score -= 15;  // complex natural distribution
  else if (entropy > 4.4)  score -= 7;

  // Skewness: near-zero = overly symmetric = AI indicator
  if (avgSkew < 0.15)      score += 10;
  else if (avgSkew > 0.8)  score -= 8;  // natural asymmetry

  return {
    score:      Math.min(100, Math.max(0, score)),
    confidence: 0.58,
    label:      'Color Distribution',
    detail:     `Avg σ: ${avgStd.toFixed(1)} · Entropy: ${entropy.toFixed(2)} · Skew: ${avgSkew.toFixed(2)}`,
  };
}
