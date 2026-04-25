/* ──────────────────────────────────────────
   src/utils/imageUtils.js
   Image decoding and preprocessing.
   Supported formats: JPG, PNG, WebP, GIF, BMP (Sightengine-compatible)
   ────────────────────────────────────────── */

import * as tf from '@tensorflow/tfjs';
import { isAcceptedFile } from './imageFormats.js';
import { detectFileType } from './fileType.js';

export class InvalidFileError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidFileError';
  }
}

const MODEL_SIZE    = 224;  // MobileNet input size
const SMALL_SIZE    = 64;   // Texture + noise signals

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
      `Unsupported format: ${effectiveMime || 'unknown'}. ` +
      `Accepted: JPG, PNG, WebP, GIF, BMP.`
    );
  }

  // ── 3. Create ImageBitmap (respects EXIF orientation) ────
  let imageBitmap;
  try {
    imageBitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Fallback to HTMLImageElement
    imageBitmap = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload  = () => { resolve(img); URL.revokeObjectURL(url); };
      img.onerror = () => { reject(new Error('Image load failed')); URL.revokeObjectURL(url); };
      img.src = url;
    });
  }

  const originalWidth  = imageBitmap.width  ?? imageBitmap.naturalWidth;
  const originalHeight = imageBitmap.height ?? imageBitmap.naturalHeight;

  if (originalWidth < 32 || originalHeight < 32) {
    warnings.push('Image is very small — analysis signals may be less accurate.');
  }

  // ── 4. Draw to canvases with center-crop ──────────────────
  const canvas224 = drawCenterCrop(imageBitmap, MODEL_SIZE);
  const canvas64  = drawCenterCrop(imageBitmap, SMALL_SIZE);

  // ── 5. Pixel data ─────────────────────────────────────────
  const pixelData224 = canvas224.getContext('2d').getImageData(0, 0, MODEL_SIZE, MODEL_SIZE).data;
  const pixelData64  = canvas64.getContext('2d').getImageData(0, 0, SMALL_SIZE, SMALL_SIZE).data;

  // ── 6. TF tensors ─────────────────────────────────────────
  const tensor224 = canvasToTensor(canvas224);
  const tensor64  = canvasToTensor(canvas64);

  // ── 7. Object URL for preview ────────────────────────────
  const objectURL = URL.createObjectURL(file);

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
