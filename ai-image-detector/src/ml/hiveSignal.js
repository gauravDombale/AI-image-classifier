/* ──────────────────────────────────────────
   src/ml/hiveSignal.js
   Primary API Signal — Hive V3 AI Image Detection
   94% accuracy (2026 benchmark)
   Weight: 50% (replaces HF as primary when key is set)

   Endpoint: POST https://api.thehive.ai/api/v3/ai-generated-image-detection
   Free tier: 100 requests/day
   Returns: binary AI score + source generator (DALL-E, Midjourney, SD, Flux...)
   ────────────────────────────────────────── */

const HIVE_ENDPOINT = 'https://api.thehive.ai/api/v3/ai-generated-image-detection';
const TIMEOUT_MS    = 8000;
const MAX_RETRIES   = 1;

// Classes that are metadata, not generator names
const META_CLASSES = new Set([
  'ai_generated', 'not_ai_generated', 'deepfake',
  'none', 'inconclusive', 'other_image_generators',
]);

// Human-readable generator name map
const GENERATOR_LABELS = {
  dalle:              'DALL·E',
  midjourney:         'Midjourney',
  stablediffusion:    'Stable Diffusion',
  stablediffusionxl:  'Stable Diffusion XL',
  flux:               'Flux',
  flux2:              'Flux 2',
  imagen:             'Imagen',
  imagen4:            'Imagen 4',
  adobefirefly:       'Adobe Firefly',
  gan:                'GAN',
  '4o':               'GPT-4o',
  gptimage1_5:        'GPT-Image',
  grok:               'Grok',
  ideogram:           'Ideogram',
  leonardo:           'Leonardo.AI',
  kandinsky:          'Kandinsky',
  sora:               'Sora',
  runway:             'Runway',
  pika:               'Pika',
  kling:              'Kling',
  luma:               'Luma',
  heygen:             'HeyGen',
  hidream:            'HiDream',
  wan:                'Wan',
  veo3:               'Veo 3',
  gemini:             'Gemini',
};

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
 * Parse Hive V3 response.
 * Returns { aiScore, generator, generatorLabel, deepfakeScore }
 */
function parseHiveResponse(data) {
  const classes = data?.output?.[0]?.classes;
  if (!Array.isArray(classes) || classes.length === 0) return null;

  const scores = {};
  for (const item of classes) {
    scores[item.class] = item.score;
  }

  const aiScore      = scores['ai_generated']     ?? 0;
  const deepfakeScore = scores['deepfake']         ?? 0;

  // Find top source generator (non-meta classes)
  const sourceCandidates = classes
    .filter(c => !META_CLASSES.has(c.class) && c.score > 0.05)
    .sort((a, b) => b.score - a.score);

  const topSource = sourceCandidates[0];
  const generator      = topSource?.class ?? null;
  const generatorLabel = generator ? (GENERATOR_LABELS[generator] ?? generator) : null;

  return { aiScore, generator, generatorLabel, deepfakeScore };
}

/**
 * Run Hive V3 AI image detection.
 * Uses multipart form upload — file is sent to Hive servers.
 *
 * @param {File} file
 * @returns {{ score, confidence, label, detail, generator, generatorLabel }}
 */
export async function hiveDetect(file) {
  const apiKey = import.meta.env.VITE_HIVE_API_KEY;

  if (!apiKey || apiKey === 'your_v3_api_key_here') {
    return {
      score:          50,
      confidence:     0,
      label:          'AI Model Scan',
      detail:         'Hive API key not configured',
      generator:      null,
      generatorLabel: null,
    };
  }

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetchWithTimeout(
        HIVE_ENDPOINT,
        {
          method: 'POST',
          headers: { 'Authorization': `Token ${apiKey}` },
          body: formData,
        },
        TIMEOUT_MS
      );

      // 429 = daily limit hit (100/day on free tier)
      if (res.status === 429) {
        console.warn('[Hive] Daily limit reached (100/day on free tier)');
        return {
          score:          50,
          confidence:     0,
          label:          'AI Model Scan',
          detail:         'Hive API daily limit reached — signal skipped',
          generator:      null,
          generatorLabel: null,
        };
      }

      if (res.status === 401) {
        return {
          score:          50,
          confidence:     0,
          label:          'AI Model Scan',
          detail:         'Hive API key invalid',
          generator:      null,
          generatorLabel: null,
        };
      }

      // 5xx — retry once
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        attempt++;
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }

      if (!res.ok) {
        return {
          score:          50,
          confidence:     0,
          label:          'AI Model Scan',
          detail:         `Hive API error ${res.status}`,
          generator:      null,
          generatorLabel: null,
        };
      }

      const data   = await res.json();
      const parsed = parseHiveResponse(data);

      if (!parsed) {
        return {
          score:          50,
          confidence:     0,
          label:          'AI Model Scan',
          detail:         'Unexpected Hive response format',
          generator:      null,
          generatorLabel: null,
        };
      }

      const { aiScore, generator, generatorLabel, deepfakeScore } = parsed;
      const score = Math.round(aiScore * 100);

      let detail = `Hive V3: ${(aiScore * 100).toFixed(1)}% AI confidence`;
      if (generatorLabel && score >= 70) {
        detail += ` · Likely: ${generatorLabel}`;
      }
      if (deepfakeScore >= 0.5) {
        detail += ` · ⚠ Deepfake detected (${(deepfakeScore * 100).toFixed(0)}%)`;
      }

      return {
        score,
        confidence:     0.92,  // Hive V3 = 94% accuracy → high confidence weight
        label:          'AI Model Scan',
        detail,
        generator,
        generatorLabel,
        deepfakeScore:  Math.round(deepfakeScore * 100),
      };

    } catch (err) {
      if (err.name === 'AbortError') {
        return {
          score: 50, confidence: 0, label: 'AI Model Scan',
          detail: 'Hive API timeout', generator: null, generatorLabel: null,
        };
      }
      if (attempt < MAX_RETRIES) {
        attempt++;
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      return {
        score: 50, confidence: 0, label: 'AI Model Scan',
        detail: 'Hive API network error', generator: null, generatorLabel: null,
      };
    }
  }

  return {
    score: 50, confidence: 0, label: 'AI Model Scan',
    detail: 'Max retries exceeded', generator: null, generatorLabel: null,
  };
}
