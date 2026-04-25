/* ──────────────────────────────────────────
   src/App.jsx
   Main application state machine
   ────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { motion, AnimatePresence } from 'framer-motion';

import { loadMobileNet }   from './ml/mobilenetFeatures.js';
import { runDetection }    from './ml/detector.js';
import { preprocessImage, InvalidFileError } from './utils/imageUtils.js';
import { getScoreColor } from './utils/constants.js';

import Header        from './components/Header.jsx';
import DropZone      from './components/DropZone.jsx';
import LoadingState  from './components/LoadingState.jsx';
import ScoreGauge    from './components/ScoreGauge.jsx';
import ResultBanner  from './components/ResultBanner.jsx';

const PHASES = {
  IDLE:           'idle',
  LOADING_MODELS: 'loading_models',
  ANALYZING:      'analyzing',
  DONE:           'done',
  ERROR:          'error',
};

export default function App() {
  const [phase,            setPhase]            = useState(PHASES.LOADING_MODELS);
  const [modelReady,       setModelReady]        = useState(false);
  const [backendName,      setBackendName]       = useState('WebGL');
  const [imageURL,         setImageURL]          = useState(null);
  const [result,           setResult]            = useState(null);
  const [completedSignals, setCompletedSignals]  = useState(new Set());
  const [error,            setError]             = useState(null);

  const currentFileRef = useRef(null);
  const currentURLRef  = useRef(null);

  // ── Model initialization on mount ─────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Prefer WebGL for GPU acceleration
        await tf.setBackend('webgl');
        await tf.ready();

        const backend = tf.getBackend();
        if (!cancelled) setBackendName(backend === 'webgl' ? 'WebGL' : backend.toUpperCase());

        await loadMobileNet();

        if (!cancelled) {
          setModelReady(true);
          setPhase(PHASES.IDLE);
        }
      } catch (err) {
        console.error('[App] Model init failed:', err);
        if (!cancelled) {
          // Try CPU fallback
          try {
            await tf.setBackend('cpu');
            await tf.ready();
            await loadMobileNet();
            if (!cancelled) {
              setBackendName('CPU');
              setModelReady(true);
              setPhase(PHASES.IDLE);
            }
          } catch (cpuErr) {
            if (!cancelled) {
              setError('Failed to initialize ML models. Please refresh the page.');
              setPhase(PHASES.ERROR);
            }
          }
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Handle file selection ──────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    if (!modelReady) return;

    // Revoke previous object URL
    if (currentURLRef.current) {
      URL.revokeObjectURL(currentURLRef.current);
      currentURLRef.current = null;
    }

    currentFileRef.current = file;
    setResult(null);
    setError(null);
    setCompletedSignals(new Set());

    try {
      const preprocessed = await preprocessImage(file);

      currentURLRef.current = preprocessed.objectURL;
      setImageURL(preprocessed.objectURL);
      setPhase(PHASES.ANALYZING);

      const onSignalComplete = (key) => {
        setCompletedSignals(prev => new Set([...prev, key]));
      };

      const detection = await runDetection(preprocessed, file, onSignalComplete);
      setResult(detection);
      setPhase(PHASES.DONE);

    } catch (err) {
      if (err instanceof InvalidFileError) {
        setError(err.message);
        setPhase(PHASES.IDLE);
      } else {
        console.error('[App] Detection failed:', err);
        setError('Analysis failed. Please try a different image.');
        setPhase(PHASES.ERROR);
      }
    }
  }, [modelReady]);

  // ── Reset ──────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (currentURLRef.current) {
      URL.revokeObjectURL(currentURLRef.current);
      currentURLRef.current = null;
    }
    setPhase(PHASES.IDLE);
    setImageURL(null);
    setResult(null);
    setError(null);
    setCompletedSignals(new Set());
    currentFileRef.current = null;
  }, []);

  const scoreColor = result ? getScoreColor(result.finalScore) : 'var(--accent-cyan)';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header modelReady={modelReady} backendName={backendName} />

      <main style={{ flex: 1, maxWidth: '860px', width: '100%', margin: '0 auto', padding: '32px 20px 48px' }}>

        {/* ── Global error ── */}
        {phase === PHASES.ERROR && (
          <div style={{
            padding: '16px 20px',
            background: 'rgba(255,59,92,0.08)',
            border: '1px solid rgba(255,59,92,0.3)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            color: 'var(--score-danger)',
            marginBottom: '24px',
          }}>
            ⚠ {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ── IDLE: show drop zone ── */}
          {phase === PHASES.IDLE && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {/* Hero text */}
              <div style={{ textAlign: 'center', marginBottom: '36px' }}>
                <h1 style={{
                  fontFamily:    'var(--font-display)',
                  fontWeight:    800,
                  fontSize:      'clamp(28px, 5vw, 42px)',
                  color:         'var(--text-primary)',
                  lineHeight:    1.15,
                  letterSpacing: '-0.02em',
                  marginBottom:  '12px',
                }}>
                  Is this image{' '}
                  <span style={{ color: 'var(--accent-cyan)' }}>AI-generated?</span>
                </h1>
              <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize:   '15px',
                  color:      'var(--text-secondary)',
                  maxWidth:   '520px',
                  margin:     '0 auto',
                  lineHeight: 1.7,
                }}>
                   Drop any image — we'll tell you if it's AI-generated or real.
                </p>
              </div>

              <DropZone onFile={handleFile} disabled={!modelReady} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '28px' }}>
                {['⚡ Instant Results', '🎯 High Accuracy', '📷 HEIC · TIFF · BMP · PNG · JPG', '🔒 Secure'].map(pill => (
                  <span key={pill} style={{
                    fontFamily:    'var(--font-mono)',
                    fontSize:      '11px',
                    color:         'var(--text-secondary)',
                    padding:       '5px 12px',
                    background:    'var(--bg-card)',
                    border:        '1px solid var(--border-subtle)',
                    borderRadius:  '999px',
                    letterSpacing: '0.04em',
                  }}>
                    {pill}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── LOADING MODELS / ANALYZING ── */}
          {(phase === PHASES.LOADING_MODELS || phase === PHASES.ANALYZING) && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <LoadingState
                phase={phase}
                imageURL={imageURL}
                completedSignals={completedSignals}
              />
            </motion.div>
          )}

          {/* ── DONE: results ── */}
          {phase === PHASES.DONE && result && (
            <motion.div
              key="done"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {/* Clean result card */}
              <div style={{
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                gap:            '28px',
                padding:        '40px 24px',
                background:     'var(--bg-card)',
                border:         `1px solid ${scoreColor}33`,
                borderRadius:   'var(--radius-lg)',
                boxShadow:      `0 0 40px ${scoreColor}18`,
              }}>

                {/* Image preview */}
                {imageURL && (
                  <img
                    src={imageURL}
                    alt="Analyzed"
                    style={{
                      width:        '180px',
                      height:       '180px',
                      objectFit:    'cover',
                      borderRadius: 'var(--radius-md)',
                      border:       `2px solid ${scoreColor}55`,
                    }}
                  />
                )}

                {/* Score gauge */}
                <ScoreGauge score={result.finalScore} color={scoreColor} />

                {/* Verdict banner */}
                <ResultBanner verdict={result.verdict} deepfakeScore={result.deepfakeScore} />

                {/* Analyze another */}
                <button
                  id="analyze-another-btn"
                  onClick={handleReset}
                  style={{
                    fontFamily:    'var(--font-display)',
                    fontWeight:    600,
                    fontSize:      '14px',
                    color:         'var(--accent-cyan)',
                    background:    'var(--accent-cyan-dim)',
                    border:        '1px solid var(--accent-cyan)',
                    borderRadius:  '999px',
                    padding:       '10px 28px',
                    cursor:        'pointer',
                    letterSpacing: '0.04em',
                    transition:    'background 200ms ease, box-shadow 200ms ease',
                    marginTop:     '4px',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-cyan-mid)'; e.currentTarget.style.boxShadow = 'var(--glow-cyan)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-cyan-dim)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  ↺ Analyze Another Image
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop:   '1px solid var(--border-subtle)',
        padding:     '16px 24px',
        textAlign:   'center',
        fontFamily:  'var(--font-mono)',
        fontSize:    '11px',
        color:       'var(--text-tertiary)',
      }}>
        All inference runs in your browser · Images never leave your device · Powered by TensorFlow.js + MobileNet v3
      </footer>
    </div>
  );
}
