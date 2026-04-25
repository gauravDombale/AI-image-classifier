# AI Image Detector Improvement Plan

This document describes how to improve the current AI-vs-real image detection quality and expand image format support across JPEG, PNG, WebP, GIF, AVIF, HEIC/HEIF, TIFF, BMP, SVG, and other practical browser-upload formats.

## Current Findings

The app currently uses a 7-signal ensemble:

- `mobilenetFeatures.js`: MobileNet embedding heuristics.
- `frequencyAnalysis.js`: FFT frequency artifacts.
- `colorStats.js`: RGB distribution statistics.
- `edgeAnalysis.js`: Sobel edge uniformity.
- `textureAnalysis.js`: LBP texture regularity.
- `noiseAnalysis.js`: residual noise / PRNU-like analysis.
- `huggingFaceSignal.js`: optional remote Hugging Face model call.

The core issues are:

- Most local signals are hand-tuned heuristics with fixed thresholds.
- The strongest signal, Hugging Face, is skipped when `VITE_HF_API_KEY` is missing, times out, or is rate limited.
- The UI says "No uploads", but `huggingFaceDetect(file)` uploads the original file when enabled.
- All images are resized to a square `224x224` and `64x64`, which distorts aspect ratio and can destroy forensic cues.
- Format support is duplicated in `DropZone.jsx` and `imageUtils.js`.
- Supported formats are limited to JPEG, PNG, WebP, GIF, and AVIF.
- HEIC/HEIF, TIFF, BMP, SVG, JPEG XL, RAW-like camera formats, and renamed files are not handled reliably.
- Animated formats are treated as one browser-decoded frame without clear behavior.

## Goal

Improve the system so it:

- Classifies real and AI-generated images with measurable accuracy instead of relying on subjective thresholds.
- Supports the widest practical set of image formats by decoding them into a normalized internal bitmap.
- Preserves image evidence needed by forensic signals.
- Gives honest confidence and clear fallback behavior when a signal cannot run.

## Priority 1: Replace Heuristic Scoring With a Calibrated Classifier

The current local signals should become feature extractors, not final decision makers. Each signal should return raw measurements, and a calibrated model should combine them.

### Proposed approach

1. Keep the existing signals, but change each one to return:
   - `score`
   - `confidence`
   - `features`
   - `detail`

2. Add a new file:
   - `src/ml/calibratedClassifier.js`

3. Train a small classifier offline using extracted features:
   - logistic regression
   - gradient boosted trees
   - random forest
   - compact neural network

4. Export the trained parameters as JSON:
   - `src/ml/model/calibration.json`

5. Use the trained classifier in `computeFinalScore()` instead of manually weighted thresholds.

### Why this matters

Current scoring assumes that fixed values like `peakRatio > 0.025` or `avgStd < 28` are reliable across all images. They are not. Screenshots, paintings, low-light photos, heavily compressed photos, edited camera images, and social-media-resized images can easily look "AI-like" to these thresholds.

A calibrated classifier can learn how these features interact and produce a probability that is easier to validate.

## Priority 2: Build a Validation Dataset

Detection quality cannot be improved reliably without a test set.

### Required dataset split

Create a private evaluation dataset with at least:

- 1,000 real camera photos.
- 1,000 AI-generated images.
- 300 edited real images.
- 300 compressed social-media images.
- 200 screenshots.
- 200 illustrations or digital art images.
- 200 images with text, UI, charts, or memes.
- 100 low-resolution images.
- 100 high-resolution images.

### AI image sources to include

Include generated images from multiple families:

- Stable Diffusion 1.5 / XL / 3.x.
- Midjourney.
- DALL-E.
- Adobe Firefly.
- Flux.
- Ideogram.
- Leonardo.
- Playground.
- ComfyUI workflows.
- Upscaled AI images.
- AI images passed through JPEG compression and social apps.

### Real image sources to include

Include real images from:

- phone cameras
- DSLR / mirrorless cameras
- stock photography
- social media exports
- edited photos
- screenshots
- scanned images
- low-light / noisy images
- images with shallow depth of field

### Metrics to track

Track these metrics before changing the algorithm:

- accuracy
- precision
- recall
- F1 score
- ROC AUC
- false positive rate on real photos
- false negative rate on AI images
- calibration error
- per-format accuracy
- per-resolution accuracy
- per-source accuracy

The most important metric is false positives on real images. A detector that incorrectly labels real photos as AI will feel unreliable even if overall accuracy is high.

## Priority 3: Add a Real Deep-Learning Detector

MobileNet is not trained for AI-image detection. It can provide weak semantic features, but it should not be treated as a forensic detector.

### Best options

1. Use an on-device AI-image detector converted to TensorFlow.js or ONNX Runtime Web.
2. Run a server-side detector through a controlled API.
3. Keep Hugging Face as a fallback, but do not make it the only high-quality signal.

### Recommended path

Use ONNX Runtime Web with a compact image-forensics model:

- Add `onnxruntime-web`.
- Host the model under `public/models/`.
- Run inference fully client-side.
- Cache model files with the service worker.
- Use the model output as the primary score.
- Use current forensic signals as supporting evidence.

Example architecture:

```text
image file
  -> decode and normalize
  -> preserve metadata
  -> model input tensor
  -> local AI detector probability
  -> supporting forensic features
  -> calibrated ensemble
  -> final result
```

## Priority 4: Fix Image Preprocessing

The current preprocessing draws every image into square canvases. This can stretch portraits, landscapes, screenshots, and panoramas, which changes texture, edge, and frequency signals.

### Required changes

Update `src/utils/imageUtils.js` to:

- Preserve aspect ratio.
- Use center-crop only for model input if the model requires square input.
- Use letterboxing or shortest-side resize for forensic analysis.
- Keep separate canvases for:
  - model input
  - full-image analysis
  - preview
- Return original dimensions.
- Return normalized dimensions.
- Return EXIF orientation status.
- Return metadata availability.

### Better preprocessing output

```js
{
  modelTensor,
  analysisTensor,
  previewURL,
  fullPixelData,
  modelPixelData,
  originalWidth,
  originalHeight,
  analysisWidth,
  analysisHeight,
  mimeType,
  extension,
  metadata,
  warnings
}
```

### Avoid destructive preprocessing

Do not strip useful forensic signals too early. Compression artifacts, sensor noise, EXIF data, resolution, color profile, and alpha channel behavior can all help classification.

## Priority 5: Improve Image Format Support

Browser image support is inconsistent. The app should accept many file types, but internally convert them into a common bitmap representation before analysis.

### Current allowlist

The current code only accepts:

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`
- `image/avif`

This allowlist appears in both:

- `src/components/DropZone.jsx`
- `src/utils/imageUtils.js`

### Target supported formats

Support these formats where practical:

- JPEG / JPG / JFIF / PJPEG
- PNG / APNG
- WebP
- GIF
- AVIF
- HEIC / HEIF
- TIFF / TIF
- BMP
- SVG
- ICO
- JPEG XL, if browser or decoder support exists

### Format strategy

Create one central file:

- `src/utils/imageFormats.js`

It should define:

```js
export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/pjpeg',
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
];

export const SUPPORTED_IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.jfif',
  '.pjpeg',
  '.png',
  '.apng',
  '.webp',
  '.gif',
  '.avif',
  '.heic',
  '.heif',
  '.tif',
  '.tiff',
  '.bmp',
  '.svg',
  '.ico',
  '.jxl',
];
```

Then import this file from both upload validation and preprocessing.

### Decode pipeline

Use layered decoding:

1. Try `createImageBitmap(file, { imageOrientation: 'from-image' })`.
2. Fallback to `HTMLImageElement`.
3. For HEIC/HEIF, use a decoder such as `heic2any` or a WASM decoder.
4. For TIFF, use `utif` or another maintained TIFF decoder.
5. For SVG, sanitize first, then rasterize to canvas.
6. For unsupported RAW camera files, show a clear unsupported message.

### Important note

"Any image file type possible" is not fully achievable in a browser without decoders for each format. The practical solution is to accept broad image inputs, detect the real file type, decode with specialized libraries where needed, and give a clear message when a proprietary or RAW format cannot be decoded.

## Priority 6: Validate File Type by Content, Not Only MIME

`file.type` is often empty or incorrect, especially for HEIC, TIFF, pasted images, and renamed files.

Add file signature detection:

- JPEG: `FF D8 FF`
- PNG: `89 50 4E 47`
- GIF: `47 49 46 38`
- WebP: `RIFF....WEBP`
- AVIF/HEIF: ISO BMFF boxes with `ftyp`
- TIFF: `49 49 2A 00` or `4D 4D 00 2A`
- BMP: `42 4D`
- ICO: `00 00 01 00`

Create:

- `src/utils/fileType.js`

Return:

```js
{
  mimeType,
  extension,
  confidence,
  source: 'browser-mime' | 'signature' | 'extension'
}
```

## Priority 7: Handle Animated Images Correctly

GIF, animated WebP, APNG, and animated AVIF need explicit behavior.

Recommended behavior:

- Detect whether the image is animated.
- Analyze the first frame by default.
- Optionally sample 3 to 5 frames.
- Show a UI note: "Animated image analyzed using sampled frames."
- Average scores across sampled frames.

This avoids misleading results when the first frame is blank, a title card, or a transition.

## Priority 8: Add Metadata and Compression Signals

Many real photos include useful metadata. Many AI-generated files either lack metadata or include generator traces.

Add a metadata signal:

- EXIF camera make/model.
- EXIF lens.
- EXIF timestamp.
- EXIF orientation.
- GPS existence only, not exact GPS display.
- Software tags.
- ICC profile.
- XMP generator fields.
- C2PA / Content Credentials if present.

Important: Metadata should never be treated as proof by itself. It should be a supporting signal only because metadata can be stripped or forged.

Suggested files:

- `src/ml/metadataAnalysis.js`
- `src/utils/metadataUtils.js`

Potential package:

- `exifr`

## Priority 9: Improve Ensemble Confidence

The current result can look confident even when critical signals fail. For example, when Hugging Face is skipped, the remaining heuristic signals still produce a final score.

### Improve result structure

Return:

```js
{
  finalScore,
  probabilityAI,
  confidence,
  verdict,
  signals,
  warnings,
  unavailableSignals
}
```

### Confidence should depend on:

- number of successful signals
- agreement between signals
- model confidence
- image resolution
- format quality
- preprocessing warnings
- whether metadata was available
- whether the image is a screenshot, artwork, or non-photo

### Add disagreement handling

If signals disagree strongly, the verdict should become `UNCERTAIN` even when the average score crosses a threshold.

Example:

```js
if (signalVariance > HIGH_VARIANCE && modelConfidence < 0.75) {
  verdict = 'UNCERTAIN';
}
```

## Priority 10: Fix Privacy Messaging

The UI currently says:

- "No uploads. No servers. No cost."
- "Images never leave your device."

But `huggingFaceSignal.js` uploads the file to Hugging Face when `VITE_HF_API_KEY` is configured.

Choose one:

1. Fully local mode:
   - Remove Hugging Face.
   - Use only client-side models.
   - Keep privacy messaging.

2. Hybrid mode:
   - Keep Hugging Face.
   - Clearly tell users that the optional AI model scan uploads the image.
   - Add a setting to disable remote scan.

Recommended: fully local mode for trust, unless server-side detection is required for accuracy.

## Priority 11: Add Tests

Add unit tests for:

- file type detection
- supported format allowlist
- decoder selection
- score aggregation
- failed signal handling
- verdict thresholds
- preprocessing dimensions
- aspect-ratio preservation

Add integration tests with fixture images:

```text
fixtures/images/real/jpeg_camera.jpg
fixtures/images/real/png_screenshot.png
fixtures/images/ai/sdxl.webp
fixtures/images/ai/midjourney.jpg
fixtures/images/formats/sample.heic
fixtures/images/formats/sample.tiff
fixtures/images/formats/sample.bmp
```

Recommended test framework:

- Vitest for unit tests.
- Playwright for upload flow and UI behavior.

## Priority 12: Implementation Order

Recommended order:

1. Centralize image format definitions in `src/utils/imageFormats.js`.
2. Add content-based file type detection in `src/utils/fileType.js`.
3. Replace square-only preprocessing with aspect-ratio-preserving preprocessing.
4. Add HEIC/HEIF decode support.
5. Add TIFF decode support.
6. Add animated image handling.
7. Add metadata extraction.
8. Modify signals to return raw `features`.
9. Build an evaluation dataset.
10. Export feature vectors from the app or a Node script.
11. Train a calibrated classifier.
12. Replace manual `WEIGHTS` scoring with calibrated scoring.
13. Add a local deep-learning detector model.
14. Update UI privacy messaging.
15. Add tests and benchmark reports.

## Suggested Dependencies

Use only what is needed after testing bundle size.

```bash
npm install exifr
npm install heic2any
npm install utif
npm install onnxruntime-web
npm install -D vitest playwright
```

Consider lazy-loading heavy decoders:

```js
const { default: heic2any } = await import('heic2any');
```

Do not load HEIC/TIFF decoders during initial app startup.

## Expected File Changes

Likely new files:

- `src/utils/imageFormats.js`
- `src/utils/fileType.js`
- `src/utils/metadataUtils.js`
- `src/utils/imageDecoders.js`
- `src/ml/metadataAnalysis.js`
- `src/ml/calibratedClassifier.js`
- `src/ml/model/calibration.json`
- `src/ml/localAiDetector.js`
- `src/test/fixtures/...`

Likely modified files:

- `src/components/DropZone.jsx`
- `src/utils/imageUtils.js`
- `src/ml/detector.js`
- `src/ml/scorer.js`
- `src/ml/*Analysis.js`
- `src/utils/constants.js`
- `src/App.jsx`

## Acceptance Criteria

Format support is improved when:

- JPEG, PNG, WebP, GIF, AVIF, HEIC, HEIF, TIFF, BMP, and SVG files can be selected or dropped.
- Unsupported images fail with a specific reason.
- Files with missing or incorrect MIME types are detected by signature or extension.
- Orientation is respected.
- Aspect ratio is preserved.
- Animated images have documented frame sampling behavior.

Classification is improved when:

- Accuracy is measured on a fixed evaluation dataset.
- False positives on real photos are tracked and reduced.
- The app reports lower confidence when major signals fail.
- The app can explain whether a verdict came from the local detector, heuristics, metadata, or remote model.
- The same test images produce stable results across releases.

## Short-Term Fixes

If only a quick improvement is needed before the larger model work:

1. Centralize supported image types and add HEIC/HEIF/TIFF/BMP extension checks.
2. Add HEIC and TIFF decoding with lazy-loaded libraries.
3. Preserve aspect ratio during preprocessing.
4. Reduce confidence when Hugging Face is unavailable.
5. Add signal-disagreement logic to force `UNCERTAIN`.
6. Update UI text so privacy claims match actual behavior.

These changes will not make the detector production-grade, but they will reduce obvious misclassification and format-support failures.

