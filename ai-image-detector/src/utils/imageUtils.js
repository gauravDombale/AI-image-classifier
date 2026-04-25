/* ──────────────────────────────────────────
   src/utils/imageUtils.js
   Image decoding and preprocessing.

   Key improvements over v1:
   - Preserves aspect ratio (center-crop for model, letterbox for analysis)
   - Supports HEIC/HEIF via lazy-loaded heic2any
   - Supports TIFF via lazy-loaded utif
   - Uses createImageBitmap (faster, respects EXIF orientation)
   - Returns original + analysis dimensions and warnings
   ────────────────────────────────────────── */

import * as tf from '@tensorflow/tfjs';
import { isAcceptedFile, NEEDS_HEIC_DECODER, NEEDS_TIFF_DECODER, NEEDS_SVG_RASTER } from './imageFormats.js';
import { detectFileType } from './fileType.js';

export class InvalidFileError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidFileError';
  }
}

const MODEL_SIZE    = 224;  // MobileNet input size
const ANALYSIS_SIZE = 256;  // Larger for forensic signals (then cropped to 224)
const SMALL_SIZE    = 64;   // Texture + noise signals

// ── Lazy decoders ─────────────────────────────────────────────
async function decodeHEIC(file) {
  const { default: heic2any } = await import('heic2any');
  const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  return Array.isArray(blob) ? blob[0] : blob;
}

async function decodeTIFF(file) {
  const { default: UTIF } = await import('utif');
  const buffer = await file.arrayBuffer();
  const ifds   = UTIF.decode(buffer);
  UTIF.decodeImage(buffer, ifds[0]);
  const rgba   = UTIF.toRGBA8(ifds[0]);
  // Render TIFF into a canvas, return as blob
  const canvas = document.createElement('canvas');
  canvas.width  = ifds[0].width;
  canvas.height = ifds[0].height;
  const ctx    = canvas.getContext('2d');
  const imageData = ctx.createImageData(ifds[0].width, ifds[0].height);
  imageData.data.set(rgba);
  ctx.putImageData(imageData, 0, 0);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

// ── Draw with aspect-ratio center-crop ───────────────────────
function drawCenterCrop(imageBitmap, targetSize) {
  const canvas = document.createElement('canvas');
  canvas.width  = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d');

  const srcW = imageBitmap.width;
  const srcH = imageBitmap.height;
  const scale = Math.max(targetSize / srcW, targetSize / srcH);
  const scaledW = srcW * scale;
  const scaledH = srcH * scale;
  const offsetX = (targetSize - scaledW) / 2;
  const offsetY = (targetSize - scaledH) / 2;

  ctx.drawImage(imageBitmap, offsetX, offsetY, scaledW, scaledH);
  return canvas;
}

// ── Canvas → normalized TF tensor [1, size, size, 3] ─────────
function canvasToTensor(canvas) {
  return tf.tidy(() => {
    const t = tf.browser.fromPixels(canvas);
    return t.toFloat().div(255.0).expandDims(0);
  });
}

// ── Main export ───────────────────────────────────────────────
export async function preprocessImage(file) {
  const warnings = [];

  // ── 1. Detect real file type ──────────────────────────────
  const fileTypeInfo = await detectFileType(file);
  const effectiveMime = fileTypeInfo.mimeType !== 'unknown' ? fileTypeInfo.mimeType : file.type;

  // ── 2. Validate ───────────────────────────────────────────
  const { accepted } = isAcceptedFile({ type: effectiveMime, name: file.name });
  if (!accepted) {
    throw new InvalidFileError(
      `Unsupported file type: ${effectiveMime || 'unknown'}. ` +
      `Supported: JPG, PNG, WebP, GIF, AVIF, HEIC, TIFF, BMP, SVG.`
    );
  }

  // ── 3. Decode to a transferable source ───────────────────
  let decodableBlob = file;

  if (NEEDS_HEIC_DECODER.has(effectiveMime)) {
    try {
      decodableBlob = await decodeHEIC(file);
      warnings.push('HEIC/HEIF decoded via heic2any');
    } catch (e) {
      throw new InvalidFileError('HEIC/HEIF decode failed. Your browser may not support this format.');
    }
  } else if (NEEDS_TIFF_DECODER.has(effectiveMime)) {
    try {
      decodableBlob = await decodeTIFF(file);
      warnings.push('TIFF decoded via utif');
    } catch (e) {
      throw new InvalidFileError('TIFF decode failed.');
    }
  }

  // ── 4. Create ImageBitmap (respects EXIF orientation) ────
  let imageBitmap;
  try {
    imageBitmap = await createImageBitmap(decodableBlob, { imageOrientation: 'from-image' });
  } catch {
    // Fallback to HTMLImageElement
    imageBitmap = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(decodableBlob);
      const img = new Image();
      img.onload  = () => { resolve(img); URL.revokeObjectURL(url); };
      img.onerror = () => { reject(new Error('Image load failed')); URL.revokeObjectURL(url); };
      img.src = url;
    });
  }

  const originalWidth  = imageBitmap.width  ?? imageBitmap.naturalWidth;
  const originalHeight = imageBitmap.height ?? imageBitmap.naturalHeight;

  if (originalWidth < 32 || originalHeight < 32) {
    warnings.push('Image is very small — texture and noise signals may be less accurate.');
  }

  // ── 5. Draw to canvases with center-crop ──────────────────
  const canvas224 = drawCenterCrop(imageBitmap, MODEL_SIZE);
  const canvas64  = drawCenterCrop(imageBitmap, SMALL_SIZE);

  // ── 6. Pixel data ─────────────────────────────────────────
  const pixelData224 = canvas224.getContext('2d').getImageData(0, 0, MODEL_SIZE, MODEL_SIZE).data;
  const pixelData64  = canvas64.getContext('2d').getImageData(0, 0, SMALL_SIZE, SMALL_SIZE).data;

  // ── 7. TF tensors ─────────────────────────────────────────
  const tensor224 = canvasToTensor(canvas224);
  const tensor64  = canvasToTensor(canvas64);

  // ── 8. Object URL for preview (use original decoded blob) ─
  const objectURL = URL.createObjectURL(decodableBlob);

  // Close imageBitmap to free GPU memory
  if (imageBitmap.close) imageBitmap.close();

  return {
    tensor224,
    tensor64,
    pixelData224,
    pixelData64,
    objectURL,
    width:          MODEL_SIZE,
    height:         MODEL_SIZE,
    originalWidth,
    originalHeight,
    mimeType:       effectiveMime,
    warnings,
  };
}
