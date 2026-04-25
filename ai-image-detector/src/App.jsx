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
import { SIGNAL_META, getScoreColor }        from './utils/constants.js';

import Header        from './components/Header.jsx';
import DropZone      from './components/DropZone.jsx';
import LoadingState  from './components/LoadingState.jsx';
import ScoreGauge    from './components/ScoreGauge.jsx';
import ResultBanner  from './components/ResultBanner.jsx';
import DimensionCard from './components/DimensionCard.jsx';

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
                  8-signal forensic analysis — 7 signals run locally in your browser.
                  {import.meta.env.VITE_HF_API_KEY ? (
                    <span> The optional <strong style={{ color: 'var(--accent-cyan)' }}>AI Model Scan</strong> uploads your image to Hugging Face for deep analysis.</span>
                  ) : (
                    <span> All signals run privately on your device. No uploads. No cost.</span>
                  )}
                </p>
              </div>

              <DropZone onFile={handleFile} disabled={!modelReady} />

              {/* Feature pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '28px' }}>
                {['🔒 7 Local Signals', '⚡ GPU-accelerated', '🧠 8-Signal Ensemble', '📷 HEIC · TIFF · BMP', '🆓 Always Free'].map(pill => (
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
              {/* Preprocessing warnings */}
              {result.warnings?.length > 0 && (
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(255, 190, 0, 0.07)',
                  border: '1px solid rgba(255, 190, 0, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--score-warn)',
                }}>
                  ℹ {result.warnings.join(' · ')}
                </div>
              )}

              {/* Unavailable signals warning */}
              {result.unavailableSignals?.length > 0 && (
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(107, 122, 153, 0.08)',
                  border: '1px solid rgba(107, 122, 153, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                }}>
                  ⚠ Skipped signals: {result.unavailableSignals.join(', ')} — result confidence reduced
                </div>
              )}

              {/* Top panel */}
              <div style={{
                display:       'flex',
                gap:           '24px',
                alignItems:    'flex-start',
                flexWrap:      'wrap',
                marginBottom:  '32px',
              }}>
                {/* Image preview */}
                {imageURL && (
                  <div style={{ flexShrink: 0 }}>
                    <img
                      src={imageURL}
                      alt="Analyzed"
                      style={{
                        width:        '160px',
                        height:       '160px',
                        objectFit:    'cover',
                        borderRadius: 'var(--radius-md)',
                        border:       '1px solid var(--border-subtle)',
                      }}
                    />
                  </div>
                )}

                {/* Score gauge + verdict */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '220px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <ScoreGauge score={result.finalScore} color={scoreColor} />
                  </div>
                  <ResultBanner verdict={result.verdict} />
                </div>
              </div>

              {/* Signal grid */}
              <div style={{ marginBottom: '16px' }}>
                <h2 style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  marginBottom: '16px',
                }}>
                  Signal Breakdown
                </h2>
                <div style={{
                  display:               'grid',
                  gridTemplateColumns:   'repeat(auto-fill, minmax(240px, 1fr))',
                  gap:                   '12px',
                }}>
                  {SIGNAL_META.map((sig, i) => (
                    <DimensionCard
                      key={sig.key}
                      signal={sig}
                      result={result.signals[sig.key]}
                      index={i}
                    />
                  ))}
                </div>
              </div>

              {/* Analyze another */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px' }}>
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
