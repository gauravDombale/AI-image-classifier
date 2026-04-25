/* ──────────────────────────────────────────
   src/components/DropZone.jsx
   Image upload — drag/drop/click/paste
   Uses central imageFormats.js — no duplicated MIME lists
   ────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isAcceptedFile, INPUT_ACCEPT } from '../utils/imageFormats.js';
import { detectFileType } from '../utils/fileType.js';

export default function DropZone({ onFile, disabled }) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError]           = useState(null);
  const inputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;

    // Content-based type detection (handles misnamed/wrongly-typed files)
    const detected  = await detectFileType(file);
    const mimeToCheck = detected.mimeType !== 'unknown' ? detected.mimeType : file.type;
    const { accepted } = isAcceptedFile({ type: mimeToCheck, name: file.name });

    if (!accepted) {
      setError(`Unsupported format: ${mimeToCheck || 'unknown'}. Accepted: JPG, PNG, WebP, GIF, BMP`);
      return;
    }
    setError(null);
    onFile(file);
  }, [onFile]);

  const onDragOver  = (e) => { e.preventDefault(); if (!disabled) setIsDragging(true); };
  const onDragLeave = ()  => setIsDragging(false);
  const onDrop      = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    handleFile(e.dataTransfer.files?.[0]);
  };

  const onClick = () => { if (!disabled) inputRef.current?.click(); };
  const onInputChange = (e) => handleFile(e.target.files?.[0]);

  useEffect(() => {
    const onPaste = (e) => {
      if (disabled) return;
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'));
      if (item) handleFile(item.getAsFile());
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [disabled, handleFile]);

  const isActive = isDragging && !disabled;

  return (
    <div>
      <div
        id="drop-zone"
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Drop image here or click to browse"
        onClick={onClick}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            '16px',
          minHeight:      '260px',
          border:         `2px dashed ${isActive ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius:   'var(--radius-lg)',
          background:     isActive ? 'var(--accent-cyan-dim)' : 'var(--bg-surface)',
          boxShadow:      isActive ? 'var(--glow-cyan)' : 'none',
          cursor:         disabled ? 'not-allowed' : 'pointer',
          opacity:        disabled ? 0.45 : 1,
          transition:     'all 220ms ease',
          userSelect:     'none',
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
          stroke={isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)'}
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'stroke 220ms ease' }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>

        <div style={{ textAlign: 'center' }}>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize:   '16px',
            color:      isActive ? 'var(--accent-cyan)' : 'var(--text-primary)',
            transition: 'color 220ms ease',
          }}>
            {isActive ? 'Release to analyze' : 'Drop an image to analyze'}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            JPG · PNG · WebP · GIF · BMP
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Ctrl+V to paste from clipboard
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={INPUT_ACCEPT}
          style={{ display: 'none' }}
          onChange={onInputChange}
          aria-hidden="true"
        />
      </div>

      {error && (
        <p style={{
          marginTop: '10px',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'var(--score-danger)',
          textAlign: 'center',
        }}>
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
