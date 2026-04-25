/* ──────────────────────────────────────────
   src/utils/fileType.js
   Magic byte / file signature detection.
   Validates actual file content, not just file.type.
   ────────────────────────────────────────── */

/**
 * Read the first N bytes of a File as a Uint8Array.
 */
async function readHeader(file, bytes = 16) {
  const slice  = file.slice(0, bytes);
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Detect file type from magic bytes.
 * Returns { mimeType, extension, confidence, source }
 *
 * source: 'signature' | 'browser-mime' | 'extension' | 'unknown'
 */
export async function detectFileType(file) {
  try {
    const header = await readHeader(file, 24);

    // ── JPEG: FF D8 FF ──────────────────────────────────────
    if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
      return { mimeType: 'image/jpeg', extension: '.jpg', confidence: 1.0, source: 'signature' };
    }

    // ── PNG: 89 50 4E 47 0D 0A 1A 0A ──────────────────────
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
      return { mimeType: 'image/png', extension: '.png', confidence: 1.0, source: 'signature' };
    }

    // ── GIF: 47 49 46 38 ──────────────────────────────────
    if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x38) {
      return { mimeType: 'image/gif', extension: '.gif', confidence: 1.0, source: 'signature' };
    }

    // ── WebP: RIFF....WEBP ────────────────────────────────
    const riff = String.fromCharCode(header[0], header[1], header[2], header[3]);
    const webp = String.fromCharCode(header[8], header[9], header[10], header[11]);
    if (riff === 'RIFF' && webp === 'WEBP') {
      return { mimeType: 'image/webp', extension: '.webp', confidence: 1.0, source: 'signature' };
    }

    // ── BMP: 42 4D ────────────────────────────────────────
    if (header[0] === 0x42 && header[1] === 0x4D) {
      return { mimeType: 'image/bmp', extension: '.bmp', confidence: 1.0, source: 'signature' };
    }

    // ── ICO: 00 00 01 00 ──────────────────────────────────
    if (header[0] === 0x00 && header[1] === 0x00 && header[2] === 0x01 && header[3] === 0x00) {
      return { mimeType: 'image/x-icon', extension: '.ico', confidence: 1.0, source: 'signature' };
    }

    // ── TIFF: Little-endian (49 49 2A 00) or Big-endian (4D 4D 00 2A) ──
    if ((header[0] === 0x49 && header[1] === 0x49 && header[2] === 0x2A && header[3] === 0x00) ||
        (header[0] === 0x4D && header[1] === 0x4D && header[2] === 0x00 && header[3] === 0x2A)) {
      return { mimeType: 'image/tiff', extension: '.tiff', confidence: 1.0, source: 'signature' };
    }

    // ── HEIF/AVIF: ISO Base Media File Format (ftyp box) ──
    // Box size (4 bytes) + 'ftyp' (4 bytes) + brand (4 bytes)
    const ftyp = String.fromCharCode(header[4], header[5], header[6], header[7]);
    if (ftyp === 'ftyp') {
      const brand = String.fromCharCode(header[8], header[9], header[10], header[11]);
      if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'].includes(brand)) {
        return { mimeType: 'image/heic', extension: '.heic', confidence: 0.95, source: 'signature' };
      }
      if (['avif', 'avis'].includes(brand)) {
        return { mimeType: 'image/avif', extension: '.avif', confidence: 0.95, source: 'signature' };
      }
      // Generic ISOBMFF — likely HEIF family
      return { mimeType: 'image/heif', extension: '.heif', confidence: 0.7, source: 'signature' };
    }

    // ── SVG: check for XML/SVG text signature ─────────────
    const text = new TextDecoder().decode(header);
    if (text.includes('<?xml') || text.includes('<svg')) {
      return { mimeType: 'image/svg+xml', extension: '.svg', confidence: 0.9, source: 'signature' };
    }

    // ── Fallback 1: trust browser MIME type ───────────────
    if (file.type && file.type.startsWith('image/')) {
      return { mimeType: file.type, extension: '.' + file.type.split('/')[1], confidence: 0.7, source: 'browser-mime' };
    }

    // ── Fallback 2: extension ─────────────────────────────
    const ext = '.' + (file.name?.split('.').pop()?.toLowerCase() ?? '');
    if (ext.length > 1) {
      return { mimeType: file.type || 'application/octet-stream', extension: ext, confidence: 0.5, source: 'extension' };
    }

  } catch {
    // Ignore read errors — fall through to unknown
  }

  return { mimeType: 'unknown', extension: '', confidence: 0, source: 'unknown' };
}
