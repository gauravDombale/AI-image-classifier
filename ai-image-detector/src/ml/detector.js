/* ──────────────────────────────────────────
   src/ml/detector.js
   Main orchestrator — runs all 7 signals in parallel
   ────────────────────────────────────────── */

import * as tf from '@tensorflow/tfjs';
import { mobilenetFeatures } from './mobilenetFeatures.js';
import { frequencyAnalysis  } from './frequencyAnalysis.js';
import { colorStats         } from './colorStats.js';
import { edgeAnalysis       } from './edgeAnalysis.js';
import { textureAnalysis    } from './textureAnalysis.js';
import { noiseAnalysis      } from './noiseAnalysis.js';
import { huggingFaceDetect  } from './huggingFaceSignal.js';
import { computeFinalScore, getVerdict } from './scorer.js';

/**
 * Wrap a signal function so it never throws.
 * On error → returns neutral { score: 50, confidence: 0 }
 */
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
        score:      50,
        confidence: 0,
        label:      key,
        detail:     `Signal error: ${err?.message ?? 'Unknown'}`,
      },
    };
  }
}

/**
 * Run all 7 detection signals in parallel.
 *
 * @param {object} preprocessed  Output from preprocessImage()
 * @param {File}   file          Original File for HF API
 * @param {function} onSignalComplete  (key: string) => void — called as each signal resolves
 * @returns {{ finalScore: number, verdict: object, signals: object }}
 */
export async function runDetection(preprocessed, file, onSignalComplete) {
  const { tensor224, tensor64, pixelData224, pixelData64, width, height } = preprocessed;

  // Run all signals in parallel — each is independently error-safe
  const results = await Promise.all([
    safeSignal('mobilenet',   () => mobilenetFeatures(tensor224),                   onSignalComplete),
    safeSignal('frequency',   () => frequencyAnalysis(pixelData224, width, height), onSignalComplete),
    safeSignal('color',       () => colorStats(pixelData224),                       onSignalComplete),
    safeSignal('edge',        () => edgeAnalysis(tensor224),                        onSignalComplete),
    safeSignal('texture',     () => textureAnalysis(pixelData64),                   onSignalComplete),
    safeSignal('noise',       () => noiseAnalysis(tensor64),                        onSignalComplete),
    safeSignal('huggingface', () => huggingFaceDetect(file),                        onSignalComplete),
  ]);

  // Dispose TF tensors — must happen after all signals complete
  tf.dispose([tensor224, tensor64]);

  // Build signals map
  const signals = {};
  for (const { key, result } of results) {
    signals[key] = result;
  }

  const finalScore = computeFinalScore(signals);
  const verdict    = getVerdict(finalScore);

  return { finalScore, verdict, signals };
}
