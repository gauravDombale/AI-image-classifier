/* ──────────────────────────────────────────
   src/utils/imageFormats.js
   Single source of truth for all supported image formats.
   Restricted to formats accepted by Sightengine API:
   JPG · PNG · WebP · GIF · BMP
   ────────────────────────────────────────── */

/**
 * Supported MIME types — Sightengine API compatible formats only.
 */
export const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/pjpeg',   // progressive JPEG
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
];

/**
 * Supported file extensions (lowercase).
 * Used as fallback when file.type is empty or wrong.
 */
export const SUPPORTED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.jfif', '.pjpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
]);

/**
 * Check if a file is accepted based on MIME type OR extension fallback.
 */
export function isAcceptedFile(file) {
  // Try MIME type first
  if (file.type && SUPPORTED_MIME_TYPES.includes(file.type)) {
    return { accepted: true, mimeType: file.type, source: 'mime' };
  }

  // Fallback to extension
  const ext = '.' + (file.name?.split('.').pop()?.toLowerCase() ?? '');
  if (SUPPORTED_EXTENSIONS.has(ext)) {
    const extToMime = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.jfif': 'image/jpeg', '.pjpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
    };
    return { accepted: true, mimeType: extToMime[ext] ?? file.type, source: 'extension' };
  }

  return { accepted: false, mimeType: file.type, source: 'none' };
}

/**
 * Human-readable accept string for <input type="file">
 */
export const INPUT_ACCEPT = [
  ...SUPPORTED_MIME_TYPES,
  ...Array.from(SUPPORTED_EXTENSIONS),
].join(',');
