/* ──────────────────────────────────────────
   src/ml/detector.js
   Main orchestrator — runs all 8 signals in parallel

   Primary API signal priority:
   1. Hive V3 (94% accuracy) — if VITE_HIVE_API_KEY is set
   2. HuggingFace (fallback)  — if VITE_HF_API_KEY is set
   3. Neutral 50              — if neither key configured
   ────────────────────────────────────────── */

import * as tf from '@tensorflow/tfjs';
import { mobilenetFeatures } from './mobilenetFeatures.js';
import { frequencyAnalysis  } from './frequencyAnalysis.js';
import { colorStats         } from './colorStats.js';
import { edgeAnalysis       } from './edgeAnalysis.js';
import { textureAnalysis    } from './textureAnalysis.js';
import { noiseAnalysis      } from './noiseAnalysis.js';
import { metadataAnalysis   } from './metadataAnalysis.js';
import { hiveDetect         } from './hiveSignal.js';
import { huggingFaceDetect  } from './huggingFaceSignal.js';
import { computeFinalScore, getVerdict } from './scorer.js';

async function safeSignal(key, fn, onComplete) {
  try {
    const result = await fn();
    onComplete?.(key);
    return { key, result };
  } catch (err) {
    console.warn(`[detector] Signal "${key}" failed:`, err?.message ?? err);
    onComplete?.(key);
    return {
      key,
      result: {
        score:          50,
        confidence:     0,
        label:          key,
        detail:         `Signal error: ${err?.message ?? 'Unknown'}`,
        generator:      null,
        generatorLabel: null,
      },
    };
  }
}

/**
 * Select the best available API signal.
 * HuggingFace is the primary (works with free tier key).
 * Hive is attempted if CF Worker is configured — but silently falls back to HF
 * if Hive returns an error (enterprise-only endpoint returns 404).
 */
async function runPrimaryApiSignal(file) {
  const cfWorkerUrl = import.meta.env.VITE_CF_WORKER_URL;
  const hfKey       = import.meta.env.VITE_HF_API_KEY;

  // Try Hive via CF Worker proxy if configured
  if (cfWorkerUrl) {
    const hiveResult = await hiveDetect(file);
    // Only use Hive result if it has real confidence (not a fallback neutral 50)
    if (hiveResult.confidence > 0) {
      return hiveResult;
    }
  }

  // Fall back to HuggingFace (always active when key is set)
  if (hfKey && hfKey !== 'hf_xxxxxxxxxxxxxxxxxxxxx') {
    const hfResult = await huggingFaceDetect(file);
    return { ...hfResult, generator: null, generatorLabel: null };
  }

  return {
    score: 50, confidence: 0, label: 'AI Model Scan',
    detail: 'No API key configured — add VITE_HF_API_KEY for best accuracy',
    generator: null, generatorLabel: null,
  };
}

export async function runDetection(preprocessed, file, onSignalComplete) {
  const { tensor224, tensor64, pixelData224, pixelData64, width, height, warnings = [] } = preprocessed;

  const results = await Promise.all([
    safeSignal('mobilenet',   () => mobilenetFeatures(tensor224),                   onSignalComplete),
    safeSignal('frequency',   () => frequencyAnalysis(pixelData224, width, height), onSignalComplete),
    safeSignal('color',       () => colorStats(pixelData224),                       onSignalComplete),
    safeSignal('edge',        () => edgeAnalysis(tensor224),                        onSignalComplete),
    safeSignal('texture',     () => textureAnalysis(pixelData64),                   onSignalComplete),
    safeSignal('noise',       () => noiseAnalysis(tensor64),                        onSignalComplete),
    safeSignal('metadata',    () => metadataAnalysis(file),                         onSignalComplete),
    safeSignal('huggingface', () => runPrimaryApiSignal(file),                      onSignalComplete),
  ]);

  tf.dispose([tensor224, tensor64]);

  const signals = {};
  for (const { key, result } of results) {
    signals[key] = result;
  }

  const { finalScore, confidence, unavailableSignals } = computeFinalScore(signals);
  const verdict = getVerdict(finalScore, confidence);

  // Extract generator info from primary API signal
  const apiSignal      = signals['huggingface'];
  const generator      = apiSignal?.generator      ?? null;
  const generatorLabel = apiSignal?.generatorLabel ?? null;
  const deepfakeScore  = apiSignal?.deepfakeScore  ?? 0;

  return {
    finalScore,
    confidence,
    verdict,
    signals,
    warnings,
    unavailableSignals,
    generator,
    generatorLabel,
    deepfakeScore,
  };
}
