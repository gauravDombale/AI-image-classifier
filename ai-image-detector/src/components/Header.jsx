/* ──────────────────────────────────────────
   src/components/Header.jsx
   App header with logo and model status
   ────────────────────────────────────────── */

export default function Header({ modelReady, backendName }) {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      height: '64px',
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(8, 10, 15, 0.85)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px', color: 'var(--text-primary)', lineHeight: 1.2 }}>
          AIGC<span style={{ color: 'var(--accent-cyan)' }}>·</span>DETECT
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '2px' }}>
          On-device AI image forensics
        </div>
      </div>

      {/* Model Status Pill */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 14px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '999px',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        color: modelReady ? 'var(--score-safe)' : 'var(--score-warn)',
      }}>
        <span className={`status-dot ${modelReady ? 'ready' : 'loading'}`} />
        <span>
          {modelReady
            ? `Models ready · ${backendName ?? 'WebGL'}`
            : 'Initializing models…'}
        </span>
      </div>
    </header>
  );
}
