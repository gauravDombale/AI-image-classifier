/* ──────────────────────────────────────────
   src/ml/detector.js
   Main orchestrator — runs all 9 signals in parallel

   Signal Priority (API signals):
   1. Sightengine (38% weight) — professional commercial API, genai + deepfake
   2. HuggingFace  (22% weight) — fine-tuned open model
   ────────────────────────────────────────── */

import * as tf from '@tensorflow/tfjs';
import { mobilenetFeatures  } from './mobilenetFeatures.js';
import { frequencyAnalysis  } from './frequencyAnalysis.js';
import { colorStats         } from './colorStats.js';
import { edgeAnalysis       } from './edgeAnalysis.js';
import { textureAnalysis    } from './textureAnalysis.js';
import { noiseAnalysis      } from './noiseAnalysis.js';
import { metadataAnalysis   } from './metadataAnalysis.js';
import { huggingFaceDetect  } from './huggingFaceSignal.js';
import { sightengineDetect  } from './sightengineSignal.js';
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
        score:      50,
        confidence: 0,
        label:      key,
        detail:     `Signal error: ${err?.message ?? 'Unknown'}`,
      },
    };
  }
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
    safeSignal('huggingface', () => huggingFaceDetect(file),                        onSignalComplete),
    safeSignal('sightengine', () => sightengineDetect(file),                        onSignalComplete),
  ]);

  tf.dispose([tensor224, tensor64]);

  const signals = {};
  for (const { key, result } of results) {
    signals[key] = result;
  }

  const { finalScore, confidence, unavailableSignals } = computeFinalScore(signals);
  const verdict = getVerdict(finalScore, confidence);

  // Surface deepfake score from Sightengine
  const deepfakeScore = signals['sightengine']?.deepfakeScore ?? 0;

  return {
    finalScore,
    confidence,
    verdict,
    signals,
    warnings,
    unavailableSignals,
    generator:      null,
    generatorLabel: null,
    deepfakeScore,
  };
}
