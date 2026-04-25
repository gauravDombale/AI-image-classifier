/* ──────────────────────────────────────────
   src/components/LoadingState.jsx
   Analysis progress — spinner + scanline + signal checklist
   ────────────────────────────────────────── */

import { SIGNAL_META } from '../utils/constants.js';

export default function LoadingState({ phase, imageURL, completedSignals }) {
  if (phase === 'loading_models') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '60px 0' }}>
        <div className="spinner" style={{ width: '36px', height: '36px', borderWidth: '3px' }} />
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
            Loading ML models
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            TensorFlow.js + MobileNet v3 · one-time download
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'analyzing') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px', padding: '32px 0' }}>

        {/* Image with scanline */}
        <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', lineHeight: 0 }}>
          <img
            src={imageURL}
            alt="Analyzing"
            style={{
              width: '180px',
              height: '180px',
              objectFit: 'cover',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              filter: 'brightness(0.85)',
            }}
          />
          {/* Scanline overlay */}
          <div style={{
            position:   'absolute',
            left:       0,
            right:      0,
            height:     '2px',
            background: 'linear-gradient(90deg, transparent, var(--accent-cyan), transparent)',
            animation:  'scanline 1.6s linear infinite',
            top:        0,
            boxShadow:  '0 0 12px var(--accent-cyan)',
          }} />
        </div>

        {/* Signal checklist */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          minWidth: '260px',
        }}>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--text-secondary)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: '14px',
          }}>
            Running analysis
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {SIGNAL_META.map(sig => {
              const done = completedSignals?.has(sig.key);
              return (
                <div key={sig.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {done ? (
                    <span style={{ color: 'var(--score-safe)', fontSize: '14px', lineHeight: 1, flexShrink: 0 }}>✓</span>
                  ) : (
                    <div className="spinner" />
                  )}
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    color: done ? 'var(--text-primary)' : 'var(--text-secondary)',
                    transition: 'color 300ms ease',
                  }}>
                    {sig.label}
                  </span>
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    {sig.icon}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
