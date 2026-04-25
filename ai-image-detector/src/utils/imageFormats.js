/* ──────────────────────────────────────────
   src/utils/imageFormats.js
   Single source of truth for all supported image formats.
   Import from here — never hardcode MIME types elsewhere.
   ────────────────────────────────────────── */

/**
 * Supported MIME types.
 * HEIC/HEIF and TIFF need library decoders — handled in imageUtils.js.
 */
export const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/pjpeg',       // progressive JPEG
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/tiff',
  'image/bmp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
];

/**
 * Supported file extensions (lowercase).
 * Used as fallback when file.type is empty or wrong.
 */
export const SUPPORTED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.jfif', '.pjpeg',
  '.png', '.apng',
  '.webp',
  '.gif',
  '.avif',
  '.heic', '.heif',
  '.tif', '.tiff',
  '.bmp',
  '.svg',
  '.ico',
]);

/**
 * Formats that need special library decoders (lazy loaded).
 */
export const NEEDS_HEIC_DECODER = new Set(['image/heic', 'image/heif']);
export const NEEDS_TIFF_DECODER = new Set(['image/tiff']);
export const NEEDS_SVG_RASTER  = new Set(['image/svg+xml']);

/**
 * Check if a file is accepted based on MIME type OR extension fallback.
 * @param {File} file
 * @returns {{ accepted: boolean, mimeType: string, source: string }}
 */
export function isAcceptedFile(file) {
  // Try MIME type first
  if (file.type && SUPPORTED_MIME_TYPES.includes(file.type)) {
    return { accepted: true, mimeType: file.type, source: 'mime' };
  }

  // Fallback to extension
  const ext = '.' + (file.name?.split('.').pop()?.toLowerCase() ?? '');
  if (SUPPORTED_EXTENSIONS.has(ext)) {
    // Map extension to MIME
    const extToMime = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.jfif': 'image/jpeg', '.pjpeg': 'image/jpeg',
      '.png': 'image/png', '.apng': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.avif': 'image/avif',
      '.heic': 'image/heic', '.heif': 'image/heif',
      '.tif': 'image/tiff', '.tiff': 'image/tiff',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
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
