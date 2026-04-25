/* ──────────────────────────────────────────
   src/ml/textureAnalysis.js
   Signal 5 — Texture Regularity (LBP)
   Weight: 7%

   BIDIRECTIONAL SCORING (baseline 50)
   ────────────────────────────────────────── */

export async function textureAnalysis(pixelData64, width = 64, height = 64) {
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = Math.round(
      0.299 * pixelData64[i * 4] +
      0.587 * pixelData64[i * 4 + 1] +
      0.114 * pixelData64[i * 4 + 2]
    );
  }

  const lbpHist = new Array(256).fill(0);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const center = gray[y * width + x];
      const neighbors = [
        gray[(y-1)*width+(x-1)], gray[(y-1)*width+x], gray[(y-1)*width+(x+1)],
        gray[y*width+(x+1)],
        gray[(y+1)*width+(x+1)], gray[(y+1)*width+x], gray[(y+1)*width+(x-1)],
        gray[y*width+(x-1)],
      ];
      let lbp = 0;
      neighbors.forEach((n, i) => { if (n >= center) lbp |= (1 << i); });
      lbpHist[lbp]++;
    }
  }

  const total    = lbpHist.reduce((s, v) => s + v, 0);
  const normHist = lbpHist.map(v => v / (total || 1));
  const dominant = normHist.filter(v => v > 0.015).length;
  const entropy  = -normHist.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0);

  // ── Bidirectional scoring (baseline = 50) ──────────────────
  let score = 50;

  // Few dominant patterns → repetitive AI texture
  if (dominant < 15)       score += 28;
  else if (dominant < 25)  score += 14;
  else if (dominant > 50)  score -= 15;  // diverse real-world texture
  else if (dominant > 40)  score -= 8;

  // Low entropy → repetitive texture → AI
  if (entropy < 4.5)       score += 20;
  else if (entropy < 5.5)  score += 8;
  else if (entropy > 6.8)  score -= 15;  // high complexity → real
  else if (entropy > 6.2)  score -= 7;

  return {
    score:      Math.min(100, Math.max(0, score)),
    confidence: 0.58,
    label:      'Texture Regularity',
    detail:     `LBP entropy: ${entropy.toFixed(2)} · Dominant patterns: ${dominant}/256`,
  };
}
