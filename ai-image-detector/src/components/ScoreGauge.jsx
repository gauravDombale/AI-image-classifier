/* ──────────────────────────────────────────
   src/components/ScoreGauge.jsx
   Animated SVG radial arc gauge with Framer Motion
   ────────────────────────────────────────── */

import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

const SIZE   = 220;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ScoreGauge({ score, color }) {
  // ── Arc animation ─────────────────────────────────────────────
  const rawOffset  = useMotionValue(CIRCUMFERENCE);
  const arcOffset  = useSpring(rawOffset, { stiffness: 55, damping: 20 });

  // ── Count-up number ───────────────────────────────────────────
  const rawScore   = useMotionValue(0);
  const smoothScore = useSpring(rawScore, { stiffness: 55, damping: 20 });
  const displayScore = useTransform(smoothScore, v => Math.round(v));

  useEffect(() => {
    const targetOffset = CIRCUMFERENCE * (1 - score / 100);
    rawOffset.set(targetOffset);
    rawScore.set(score);
  }, [score, rawOffset, rawScore]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={STROKE}
          />
          {/* Animated arc */}
          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            style={{
              strokeDashoffset: arcOffset,
              filter: `drop-shadow(0 0 8px ${color}88)`,
            }}
          />
        </svg>

        {/* Center content */}
        <div style={{
          position:       'absolute',
          inset:          0,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            '2px',
        }}>
          <motion.span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize:   '52px',
            color:      color,
            lineHeight:  1,
          }}>
            {displayScore}
          </motion.span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize:   '13px',
            color:      'var(--text-secondary)',
          }}>
            / 100
          </span>
        </div>
      </div>

      {/* Outer glow ring */}
      <div style={{
        width:        '64px',
        height:       '4px',
        borderRadius: '2px',
        background:   color,
        opacity:      0.4,
        filter:       `blur(4px)`,
        boxShadow:    `0 0 16px ${color}`,
      }} />
    </div>
  );
}
