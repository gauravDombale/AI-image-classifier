/* ──────────────────────────────────────────
   src/components/ResultBanner.jsx
   Verdict banner with Framer Motion entrance
   ────────────────────────────────────────── */

import { motion } from 'framer-motion';

export default function ResultBanner({ verdict }) {
  if (!verdict) return null;

  const { label, color, confidence, description } = verdict;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.5, ease: 'easeOut' }}
      style={{
        padding:      '20px 24px',
        borderRadius: 'var(--radius-md)',
        background:   `${color}0d`,
        border:       `1px solid ${color}4d`,
        display:      'flex',
        flexDirection:'column',
        gap:          '8px',
      }}
    >
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

      {/* Description */}
      <p style={{
        fontFamily: 'var(--font-body)',
        fontSize:   '13px',
        color:      'var(--text-secondary)',
        lineHeight: 1.6,
      }}>
        {description}
      </p>
    </motion.div>
  );
}
