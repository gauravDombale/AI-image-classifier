/* ──────────────────────────────────────────
   src/utils/imageUtils.js
   Canvas-based image preprocessing
   Returns tensors + pixel data for all ML signals
   ────────────────────────────────────────── */

import * as tf from '@tensorflow/tfjs';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const SIZE_224 = 224;
const SIZE_64  = 64;

/**
 * Custom error for invalid file types
 */
export class InvalidFileError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidFileError';
  }
}

/**
 * Draw an Image element to a canvas at target dimensions
 * @param {HTMLImageElement} img
 * @param {number} size - square dimension
 * @returns {{ canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D }}
 */
function drawToCanvas(img, size) {
  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  return { canvas, ctx };
}

/**
 * Load a File into an HTMLImageElement
 * Returns objectURL so caller can revoke it later
 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload  = () => resolve({ img, url });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

/**
 * Convert canvas pixel data to a normalized TF tensor
 * Returns tensor of shape [1, size, size, 3], values 0–1
 */
function canvasToTensor(canvas, size) {
  return tf.tidy(() => {
    const tensor = tf.browser.fromPixels(canvas);   // [size, size, 3], uint8
    const resized = tf.image.resizeBilinear(tensor, [size, size]);
    const normalized = resized.toFloat().div(255.0); // [size, size, 3], 0–1
    return normalized.expandDims(0);                 // [1, size, size, 3]
  });
}

/**
 * Main preprocessing function
 *
 * @param {File} file
 * @returns {Promise<{
 *   tensor224: tf.Tensor,    [1,224,224,3] normalized 0-1
 *   tensor64:  tf.Tensor,    [1,64,64,3] normalized 0-1
 *   pixelData224: Uint8ClampedArray,  raw RGBA at 224×224
 *   pixelData64:  Uint8ClampedArray,  raw RGBA at 64×64
 *   objectURL: string,       for <img> preview, caller must revoke
 *   width: 224,
 *   height: 224,
 * }>}
 * @throws {InvalidFileError} if file type is not accepted
 */
export async function preprocessImage(file) {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new InvalidFileError(
      `Unsupported file type: ${file.type || 'unknown'}. Please upload a JPG, PNG, WebP, or GIF.`
    );
  }

  const { img, url } = await loadImage(file);

  // Draw at 224×224 for MobileNet, edge analysis
  const { canvas: canvas224, ctx: ctx224 } = drawToCanvas(img, SIZE_224);
  const pixelData224 = ctx224.getImageData(0, 0, SIZE_224, SIZE_224).data;

  // Draw at 64×64 for texture, noise analysis (faster, sufficient signal)
  const { canvas: canvas64, ctx: ctx64 } = drawToCanvas(img, SIZE_64);
  const pixelData64 = ctx64.getImageData(0, 0, SIZE_64, SIZE_64).data;

  // Convert to TF tensors
  const tensor224 = canvasToTensor(canvas224, SIZE_224);
  const tensor64  = canvasToTensor(canvas64, SIZE_64);

  return {
    tensor224,
    tensor64,
    pixelData224,
    pixelData64,
    objectURL: url,
    width: SIZE_224,
    height: SIZE_224,
  };
}
