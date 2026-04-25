/* ──────────────────────────────────────────
   src/ml/huggingFaceSignal.js
   Signal 7 — Hugging Face Fine-tuned Detector
   Weight: 50% (PRIMARY SIGNAL)
   ────────────────────────────────────────── */

const HF_API_URL = 'https://api-inference.huggingface.co/models/umm-maybe/AI-image-detector';
const TIMEOUT_MS = 6000;
const MAX_RETRIES = 1;

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse HF response — handles multiple possible label formats:
 * - { label: "artificial", score: 0.92 }
 * - { label: "ai_generated", score: 0.92 }
 * - { label: "LABEL_1", score: 0.92 }  (positional fallback)
 * - { label: "real", score: 0.08 }     → invert
 */
function parseHFResponse(data) {
  if (!Array.isArray(data) || data.length === 0) return null;

  // Sort by score descending so we know which label "won"
  const sorted = [...data].sort((a, b) => b.score - a.score);

  // Strategy 1: Find explicit AI label
  const aiKeywords  = ['artificial', 'ai', 'fake', 'generated', 'synthetic', 'label_1'];
  const realKeywords = ['real', 'human', 'authentic', 'natural', 'label_0'];

  for (const item of sorted) {
    const lbl = (item.label ?? '').toLowerCase();
    if (aiKeywords.some(k => lbl.includes(k))) {
      // Found explicit AI label — use its score directly
      return Math.round(item.score * 100);
    }
  }

  for (const item of sorted) {
    const lbl = (item.label ?? '').toLowerCase();
    if (realKeywords.some(k => lbl.includes(k))) {
      // Found real label — invert its score
      return Math.round((1 - item.score) * 100);
    }
  }

  // Strategy 2: Positional fallback
  // HF image classifiers typically put "real/safe" first, "AI" second
  // If we have exactly 2 labels, assume [real, artificial] ordering
  if (data.length === 2) {
    const [first, second] = data;
    // Whichever has higher score wins — if second wins, likely AI label
    if (second.score > first.score) {
      return Math.round(second.score * 100);
    } else {
      // First label won — treat as "real" label, invert
      return Math.round((1 - first.score) * 100);
    }
  }

  return null;
}

export async function huggingFaceDetect(file) {
  const apiKey = import.meta.env.VITE_HF_API_KEY;

  if (!apiKey || apiKey === 'hf_xxxxxxxxxxxxxxxxxxxxx') {
    return { score: 50, confidence: 0, label: 'AI Model Scan', detail: 'HF API key not configured' };
  }

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    try {
      const res = await fetchWithTimeout(
        HF_API_URL,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': file.type },
          body: file,
        },
        TIMEOUT_MS
      );

      if (res.status === 429) {
        return { score: 50, confidence: 0, label: 'AI Model Scan', detail: 'HF API rate limited — skipped' };
      }

      // Model still loading — retry once after delay
      if (res.status === 503 && attempt < MAX_RETRIES) {
        attempt++;
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      if (!res.ok) {
        return { score: 50, confidence: 0, label: 'AI Model Scan', detail: `HF API error ${res.status}` };
      }

      const data = await res.json();
      const score = parseHFResponse(data);

      if (score === null) {
        console.warn('[HF] Could not parse response:', data);
        return { score: 50, confidence: 0, label: 'AI Model Scan', detail: 'Could not parse HF response' };
      }

      // Find the raw score for display
      const rawLabel = data.find(d => ['artificial','ai','fake','generated','synthetic'].some(k => d.label?.toLowerCase().includes(k)));
      const displayPct = rawLabel ? (rawLabel.score * 100).toFixed(1) : score;

      return {
        score,
        confidence: 0.88,  // Fine-tuned model → high confidence
        label:      'AI Model Scan',
        detail:     `Fine-tuned model: ${displayPct}% AI confidence · Model: umm-maybe/AI-image-detector`,
      };

    } catch (err) {
      if (err.name === 'AbortError') {
        return { score: 50, confidence: 0, label: 'AI Model Scan', detail: 'HF API timeout' };
      }
      if (attempt < MAX_RETRIES) {
        attempt++;
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      return { score: 50, confidence: 0, label: 'AI Model Scan', detail: 'HF API network error' };
    }
  }

  return { score: 50, confidence: 0, label: 'AI Model Scan', detail: 'Max retries exceeded' };
}
