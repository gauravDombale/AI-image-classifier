/* ──────────────────────────────────────────
   src/ml/sightengineSignal.js
   Primary API Signal — Sightengine AI + Deepfake Detection
   Models: genai (AI-generated) + deepfake (face swap)
   Routed via CF Worker proxy at /sightengine
   Credentials: SE_API_USER + SE_API_SECRET stored as CF Worker secrets
   ────────────────────────────────────────── */

const CF_WORKER_URL    = import.meta.env.VITE_CF_WORKER_URL;
const SE_PROXY_URL     = CF_WORKER_URL ? `${CF_WORKER_URL}/sightengine` : null;
const TIMEOUT_MS       = 12000;

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
 * Run Sightengine AI detection via CF Worker proxy.
 * Returns ai_generated score (0-100) + deepfake score.
 *
 * Response shape from Sightengine:
 * { "type": { "ai_generated": 0.97, "deepfake": 0.01 } }
 */
export async function sightengineDetect(file) {
  if (!SE_PROXY_URL) {
    return {
      score:          50,
      confidence:     0,
      label:          'Sightengine Scan',
      detail:         'CF Worker URL not configured — add VITE_CF_WORKER_URL',
      deepfakeScore:  0,
    };
  }

  if (!file || file.size === 0) {
    return {
      score:         50,
      confidence:    0,
      label:         'Sightengine Scan',
      detail:        'Skipped: selected image file is empty',
      deepfakeScore: 0,
    };
  }

  try {
    const formData = new FormData();
    formData.append('image', file, file.name || 'upload');

    const res = await fetchWithTimeout(
      SE_PROXY_URL,
      { method: 'POST', body: formData },
      TIMEOUT_MS
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let detail = errText.slice(0, 120);
      try {
        const parsed = JSON.parse(errText);
        detail = parsed.error || parsed.detail || parsed.sightengine?.error?.message || detail;
      } catch {
        // Keep raw text preview.
      }
      return {
        score: 50, confidence: 0,
        label: 'Sightengine Scan',
        detail: `Sightengine error ${res.status}: ${detail}`,
        deepfakeScore: 0,
      };
    }

    const data = await res.json();

    if (data.status !== 'success' || !data.type) {
      return {
        score: 50, confidence: 0,
        label: 'Sightengine Scan',
        detail: `Sightengine error: ${data.error?.message ?? 'Unknown'}`,
        deepfakeScore: 0,
      };
    }

    const aiGenerated  = data.type.ai_generated  ?? 0;
    const deepfakeRaw  = data.type.deepfake       ?? 0;
    const score        = Math.round(aiGenerated * 100);
    const deepfakeScore = Math.round(deepfakeRaw * 100);
    const generators = data.type.ai_generators ?? {};
    const topGenerator = Object.entries(generators)
      .sort((a, b) => b[1] - a[1])[0];

    let detail = `Sightengine: ${score}% AI-generated`;
    if (topGenerator && topGenerator[1] >= 0.2) {
      detail += ` · ${topGenerator[0]} ${(topGenerator[1] * 100).toFixed(0)}%`;
    }
    if (deepfakeScore >= 30) {
      detail += ` · Deepfake: ${deepfakeScore}%`;
    }

    return {
      score,
      confidence:  0.88,  // Sightengine is a professional-grade commercial API
      label:       'Sightengine Scan',
      detail,
      deepfakeScore,
    };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { score: 50, confidence: 0, label: 'Sightengine Scan', detail: 'Sightengine timeout', deepfakeScore: 0 };
    }
    return { score: 50, confidence: 0, label: 'Sightengine Scan', detail: `Network error: ${err.message}`, deepfakeScore: 0 };
  }
}
