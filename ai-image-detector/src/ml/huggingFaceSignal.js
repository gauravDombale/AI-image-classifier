/* ──────────────────────────────────────────
   src/ml/huggingFaceSignal.js
   Primary API Signal — HuggingFace Inference
   Model: haywoodsloan/ai-image-detector-deploy
   Labels: "artificial" (AI) | "real" (human)
   Endpoint: router.huggingface.co/hf-inference (updated 2025)
   ────────────────────────────────────────── */

const HF_MODEL   = 'haywoodsloan/ai-image-detector-deploy';
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;
const TIMEOUT_MS = 10000;

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function huggingFaceDetect(file) {
  const apiKey = import.meta.env.VITE_HF_API_KEY;

  if (!apiKey || apiKey === 'hf_xxxxxxxxxxxxxxxxxxxxx') {
    return {
      score:      50,
      confidence: 0,
      label:      'AI Model Scan',
      detail:     'HuggingFace API key not configured',
    };
  }

  try {
    const res = await fetchWithTimeout(
      HF_API_URL,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type':  file.type || 'image/jpeg',
        },
        body: file,
      },
      TIMEOUT_MS
    );

    // Model loading — HF spins up cold models on first request
    if (res.status === 503) {
      return {
        score: 50, confidence: 0,
        label: 'AI Model Scan',
        detail: 'HF model loading — retry in a few seconds',
      };
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        score: 50, confidence: 0,
        label: 'AI Model Scan',
        detail: `HF API error ${res.status}: ${text.slice(0, 80)}`,
      };
    }

    const data = await res.json();

    // Response: [{ label: "artificial", score: 0.9 }, { label: "real", score: 0.1 }]
    if (!Array.isArray(data) || data.length === 0) {
      return { score: 50, confidence: 0, label: 'AI Model Scan', detail: 'Unexpected HF response' };
    }

    const scores = {};
    for (const item of data) {
      scores[item.label?.toLowerCase()] = item.score;
    }

    // "artificial" = AI-generated, "real" = human-made
    const aiScore   = scores['artificial'] ?? scores['ai'] ?? (1 - (scores['real'] ?? 0.5));
    const score     = Math.round(aiScore * 100);
    const realScore = (scores['real'] ?? 1 - aiScore) * 100;

    return {
      score,
      confidence: 0.82,
      label:      'AI Model Scan',
      detail:     `HF Detector: ${score}% AI · ${realScore.toFixed(1)}% Real`,
    };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { score: 50, confidence: 0, label: 'AI Model Scan', detail: 'HF API timeout' };
    }
    return { score: 50, confidence: 0, label: 'AI Model Scan', detail: `HF error: ${err.message}` };
  }
}
