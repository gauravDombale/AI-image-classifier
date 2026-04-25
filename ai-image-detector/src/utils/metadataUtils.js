/* ──────────────────────────────────────────
   src/utils/metadataUtils.js
   EXIF / metadata extraction via exifr (lazy loaded).
   ────────────────────────────────────────── */

let _exifr = null;

async function getExifr() {
  if (!_exifr) {
    const mod = await import('exifr');
    _exifr = mod.default ?? mod;
  }
  return _exifr;
}

/**
 * Extract image metadata from a File.
 * Returns null if extraction fails or no metadata exists.
 *
 * @param {File} file
 * @returns {Promise<object|null>}
 */
export async function extractMetadata(file) {
  try {
    const exifr = await getExifr();
    const data  = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps:  true,
      icc:  true,
      xmp:  true,
      iptc: false,       // skip IPTC to save time
      sanitize: true,    // prevent XSS from XMP
      reviveValues: true,
    });
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Known AI generator software tag strings.
 * If any of these appear in Software/Creator/GeneratorRef XMP fields,
 * it's a strong AI indicator.
 */
export const AI_SOFTWARE_SIGNATURES = [
  'stable diffusion', 'stablediffusion',
  'midjourney', 'mid journey',
  'dall-e', 'dalle',
  'firefly', 'adobe firefly',
  'flux', 'black forest labs',
  'ideogram', 'leonardo.ai',
  'playground ai',
  'comfyui', 'comfy ui',
  'automatic1111', 'a1111',
  'novel ai', 'novelai',
  'diffusers',   // HuggingFace diffusers library
  'generative fill',
  'content credentials',  // C2PA — may indicate AI tool
];

/**
 * Check metadata object for AI software signatures.
 * @param {object} meta
 * @returns {{ found: boolean, match: string|null }}
 */
export function checkAISoftwareSignature(meta) {
  if (!meta) return { found: false, match: null };

  const fieldsToCheck = [
    meta.Software,
    meta.Creator,
    meta.ProcessingSoftware,
    meta['xmp:CreatorTool'],
    meta.GeneratorRef,
    meta.Description,
    meta['dc:description'],
  ];

  for (const field of fieldsToCheck) {
    if (!field) continue;
    const lower = String(field).toLowerCase();
    const match = AI_SOFTWARE_SIGNATURES.find(sig => lower.includes(sig));
    if (match) return { found: true, match: field };
  }
  return { found: false, match: null };
}
