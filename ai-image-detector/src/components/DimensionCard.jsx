/* ──────────────────────────────────────────
   src/components/DimensionCard.jsx
   Per-signal score card with animated bar
   ────────────────────────────────────────── */

import { motion } from 'framer-motion';
import { getScoreColor } from '../utils/constants.js';

export default function DimensionCard({ signal, result, index }) {
  if (!signal || !result) return null;

  const color = getScoreColor(result.score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 + 0.35, duration: 0.45, ease: 'easeOut' }}
      title={signal.description}
      style={{
        background:   'var(--bg-card)',
        border:       '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding:      '14px 16px',
        display:      'flex',
        flexDirection:'column',
        gap:          '10px',
        cursor:       'default',
        transition:   'border-color 200ms ease, background 200ms ease',
      }}
      whileHover={{
        borderColor: 'rgba(0, 229, 255, 0.30)',
        backgroundColor: 'var(--bg-card-hover)',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '14px', color: 'var(--accent-cyan)', flexShrink: 0 }}>
          {signal.icon}
        </span>
        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: '13px', color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>
          {signal.label}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px', color, flexShrink: 0 }}>
          {result.score}
        </span>
      </div>

      {/* Animated progress bar */}
      <div style={{
        height:       '4px',
        background:   'rgba(255,255,255,0.06)',
        borderRadius: '2px',
        overflow:     'hidden',
      }}>
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: `${result.score}%` }}
          transition={{ delay: index * 0.08 + 0.5, duration: 0.7, ease: 'easeOut' }}
          style={{
            height:       '100%',
            background:   color,
            borderRadius: '2px',
            boxShadow:    `0 0 6px ${color}88`,
          }}
        />
      </div>

      {/* Detail text */}
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize:   '11px',
        color:      'var(--text-secondary)',
        lineHeight: 1.5,
        overflow:   'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {result.detail}
      </p>
    </motion.div>
  );
}
