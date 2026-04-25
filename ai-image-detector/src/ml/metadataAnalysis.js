/* ──────────────────────────────────────────
   src/ml/metadataAnalysis.js
   Signal 8 — Metadata / EXIF Analysis
   Weight: 8% (see constants.js)

   Scoring logic:
   - AI generator software tag found → high AI score
   - No metadata at all → mildly AI (many AI images strip metadata)
   - Real camera EXIF present (Make/Model/LensModel) → low AI score
   - GPS present → real photo indicator
   - Missing expected fields → mild AI indicator
   ────────────────────────────────────────── */

import { extractMetadata, checkAISoftwareSignature } from '../utils/metadataUtils.js';

export async function metadataAnalysis(file) {
  const meta = await extractMetadata(file);

  // No metadata at all — common in AI images but not conclusive
  if (!meta || Object.keys(meta).length === 0) {
    return {
      score:      62,
      confidence: 0.45,
      label:      'Metadata Signal',
      detail:     'No EXIF metadata found — common in AI-generated images',
      features:   { hasMetadata: false },
    };
  }

  let score = 50;  // baseline neutral
  const notes = [];

  // ── Strong AI indicator: known generator software tag ──────────
  const { found: aiSoftware, match: softwareMatch } = checkAISoftwareSignature(meta);
  if (aiSoftware) {
    score = 95;
    return {
      score,
      confidence: 0.95,
      label:      'Metadata Signal',
      detail:     `AI generator tag found: "${softwareMatch}"`,
      features:   { hasMetadata: true, aiSoftwareTag: true, softwareMatch },
    };
  }

  // ── Real camera indicators (push score down toward real) ───────
  const hasCameraMake  = !!(meta.Make || meta.make);
  const hasCameraModel = !!(meta.Model || meta.model);
  const hasLens        = !!(meta.LensModel || meta.Lens || meta.LensMake);
  const hasGPS         = !!(meta.latitude || meta.longitude || meta.GPSLatitude);
  const hasDateTime    = !!(meta.DateTimeOriginal || meta.CreateDate);
  const hasISO         = !!(meta.ISO || meta.ISOSpeedRatings);
  const hasExposure    = !!(meta.ExposureTime || meta.ShutterSpeedValue);

  if (hasCameraMake)   { score -= 18; notes.push(`Camera: ${meta.Make ?? meta.make}`); }
  if (hasCameraModel)  { score -= 12; notes.push(`Model: ${meta.Model ?? meta.model}`); }
  if (hasLens)         { score -= 10; notes.push('Lens data present'); }
  if (hasGPS)          { score -= 14; notes.push('GPS data present'); }
  if (hasDateTime)     { score -= 8;  notes.push('Capture timestamp present'); }
  if (hasISO)          { score -= 6;  notes.push('ISO present'); }
  if (hasExposure)     { score -= 6;  notes.push('Exposure data present'); }

  // ── Software field without AI signature ────────────────────────
  const software = meta.Software ?? meta.software;
  if (software) {
    const lower = String(software).toLowerCase();
    if (lower.includes('photoshop') || lower.includes('lightroom')) {
      score += 5;  // edited real photo — mild AI uncertainty
      notes.push(`Software: ${software}`);
    } else {
      notes.push(`Software: ${software}`);
    }
  }

  // ── Missing expected fields for a real photo ───────────────────
  const realFieldCount = [hasCameraMake, hasCameraModel, hasLens, hasGPS, hasDateTime, hasISO, hasExposure]
    .filter(Boolean).length;

  if (realFieldCount === 0) {
    score += 15;  // no real photo fields → nudge toward AI
    notes.push('No camera fields found');
  }

  const displayNote = notes.length > 0 ? notes.slice(0, 2).join(' · ') : 'Metadata analyzed';

  return {
    score:      Math.min(100, Math.max(0, score)),
    confidence: 0.60,
    label:      'Metadata Signal',
    detail:     displayNote,
    features:   { hasMetadata: true, hasCameraMake, hasCameraModel, hasGPS, hasDateTime },
  };
}
