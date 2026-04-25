/* ──────────────────────────────────────────
   src/components/ResultBanner.jsx
   Verdict banner — shows verdict + source generator when detected
   ────────────────────────────────────────── */

import { motion } from 'framer-motion';

export default function ResultBanner({ verdict, generatorLabel, deepfakeScore }) {
  if (!verdict) return null;

  const { label, color, confidence, description } = verdict;
  const showGenerator = !!generatorLabel && generatorLabel !== null;
  const showDeepfake  = deepfakeScore >= 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.5, ease: 'easeOut' }}
      style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           '10px',
      }}
    >
      {/* Main verdict card */}
      <div style={{
        padding:      '20px 24px',
        borderRadius: 'var(--radius-md)',
        background:   `${color}0d`,
        border:       `1px solid ${color}4d`,
        display:      'flex',
        flexDirection:'column',
        gap:          '8px',
      }}>
        {/* Top row: verdict + confidence */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize:   '22px',
            color,
            letterSpacing: '-0.01em',
          }}>
            {label}
          </span>
          <span style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      '10px',
            color,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            padding:       '4px 10px',
            border:        `1px solid ${color}4d`,
            borderRadius:  '999px',
            background:    `${color}10`,
          }}>
            {confidence} confidence
          </span>
        </div>

        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize:   '13px',
          color:      'var(--text-secondary)',
          lineHeight: 1.6,
        }}>
          {description}
        </p>
      </div>

      {/* Generator badge — shown when Hive identifies the source */}
      {showGenerator && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.4 }}
          style={{
            display:       'flex',
            alignItems:    'center',
            gap:           '10px',
            padding:       '12px 16px',
            background:    'rgba(0,229,255,0.05)',
            border:        '1px solid rgba(0,229,255,0.25)',
            borderRadius:  'var(--radius-md)',
          }}
        >
          <span style={{ fontSize: '16px' }}>🔍</span>
          <div>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize:   '10px',
              color:      'var(--text-secondary)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '2px',
            }}>
              Likely generated with
            </p>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize:   '15px',
              color:      'var(--accent-cyan)',
            }}>
              {generatorLabel}
            </p>
          </div>
        </motion.div>
      )}

      {/* Deepfake warning */}
      {showDeepfake && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          '10px',
            padding:      '10px 16px',
            background:   'rgba(255, 59, 92, 0.08)',
            border:       '1px solid rgba(255, 59, 92, 0.30)',
            borderRadius: 'var(--radius-md)',
            fontFamily:   'var(--font-mono)',
            fontSize:     '12px',
            color:        'var(--score-danger)',
          }}
        >
          ⚠ Deepfake indicators detected ({deepfakeScore}% confidence)
        </motion.div>
      )}
    </motion.div>
  );
}
