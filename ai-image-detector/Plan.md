# Plan.md — AI Image Detector: Production Architecture

> Goal: Support 1000+ daily users at 9.2/10 quality. Everything free.

---

## 📌 Project Summary

A fully client-side AI Image Authenticity Detector.
- Detects if an image is AI-generated using a 7-signal ensemble
- All ML inference runs in-browser via TensorFlow.js
- Fallback to Cloudflare Workers AI if WebGL is unavailable
- No backend server costs, no paid APIs

---

## 🏗️ Final Architecture

```
User visits site
      │
      ▼
[Vercel CDN] — Global edge, instant load, free SSL
      │
      ▼
[Service Worker (Workbox)]
  → MobileNet cached? → Load instantly (0ms network)
  → Not cached?       → Download once → cache forever
      │
      ▼
User uploads image (drag/drop / click / paste)
      │
      ├─── WebGL available? ──────────────────────────────┐
      │         ✅ YES                                     ❌ NO
      │    Run 6 signals in-browser                 Cloudflare Workers AI
      │    (TF.js + WebGL GPU)                      (10k req/day free)
      │
      ├─── Hugging Face Inference API (7th signal, free)
      │    Model: umm-maybe/AI-image-detector
      │    Used as confidence booster
      │
      ▼
Weighted Ensemble Scorer (scorer.js)
      │
      ▼
Results rendered (Framer Motion animations)
      │
      ├── Sentry logs any JS errors (5k/month free)
      └── Vercel Analytics tracks usage (free)

Cloudflare sits in front of everything:
  → DDoS protection
  → Rate limiting
  → Bot blocking
  → CDN caching of static assets
```

---

## 🧰 Tech Stack (All Free)

### Core
| Layer        | Technology         | Why                                      |
|--------------|--------------------|------------------------------------------|
| Framework    | React + Vite       | Fast builds, modern tooling              |
| Hosting      | Vercel Hobby       | Free CDN, auto-deploy from GitHub        |
| DNS + Shield | Cloudflare Free    | DDoS, rate limiting, global CDN          |

### Machine Learning
| Layer               | Technology                    | Why                                    |
|---------------------|-------------------------------|----------------------------------------|
| ML Runtime          | TensorFlow.js (`@tensorflow/tfjs`) | In-browser GPU inference via WebGL |
| Feature Extractor   | MobileNet v3                  | Free, pretrained, ~9.5MB             |
| 7th Signal          | Hugging Face Inference API    | Real fine-tuned AI detector model    |
| Fallback Backend    | Cloudflare Workers AI         | When WebGL unavailable (free 10k/day)|
| Model Caching       | Service Worker + Workbox      | MobileNet cached after first load    |

### UI & Animation
| Layer        | Technology          | Why                                    |
|--------------|---------------------|----------------------------------------|
| Styling      | Tailwind CSS        | Utility-first, fast to build           |
| Fonts        | Google Fonts        | Syne + DM Sans + JetBrains Mono, free  |
| Animation    | Framer Motion       | Spring physics, staggered reveals      |

### Observability
| Layer        | Technology              | Free Limit              |
|--------------|-------------------------|-------------------------|
| Error tracking | Sentry Free Tier      | 5,000 errors/month      |
| Analytics    | Vercel Analytics        | Included in Hobby plan  |
| Perf monitor | Cloudflare Web Analytics| Unlimited, privacy-safe |

---

## 📦 NPM Packages

```bash
# Core
npm create vite@latest ai-image-detector -- --template react
npm install react react-dom

# ML
npm install @tensorflow/tfjs @tensorflow-models/mobilenet

# Animation
npm install framer-motion

# Service Worker / Caching
npm install workbox-window workbox-precaching workbox-routing workbox-strategies

# Error Tracking
npm install @sentry/react

# Styling
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

---

## 🆓 Free Tier Limits & Ceilings

| Service              | Free Limit                  | Enough for 1000 users/day? |
|----------------------|-----------------------------|---------------------------|
| Vercel Hobby         | 100GB bandwidth/month       | ✅ Yes                    |
| Cloudflare Free      | Unlimited requests          | ✅ Yes                    |
| Cloudflare Workers AI| 10,000 req/day              | ✅ Yes (fallback only)    |
| Hugging Face API     | ~1,000 req/day              | ⚠️ May throttle at peak   |
| Sentry Free          | 5,000 errors/month          | ✅ Yes                    |
| Vercel Analytics     | Included                    | ✅ Yes                    |
| Service Worker Cache | Browser storage (~50MB)     | ✅ Yes (per user device)  |

---

## 📐 ML Signal Ensemble

| Signal | File                    | Weight | Method                          |
|--------|-------------------------|--------|---------------------------------|
| 1      | mobilenetFeatures.js    | 22%    | Embedding norm, sparsity, kurtosis |
| 2      | frequencyAnalysis.js    | 20%    | FFT periodic artifact detection |
| 3      | colorStats.js           | 12%    | Color variance + histogram entropy |
| 4      | edgeAnalysis.js         | 12%    | Sobel edge uniformity           |
| 5      | textureAnalysis.js      | 8%     | LBP texture regularity          |
| 6      | noiseAnalysis.js        | 8%     | PRNU noise autocorrelation      |
| 7 🆕   | huggingFaceSignal.js    | 18%    | Fine-tuned AI detector model    |

Weights adjusted to give the fine-tuned HF model significant influence (18%)
while keeping all in-browser signals active.

---

## 🔒 Error Handling Strategy

| Scenario                        | Behavior                                         |
|---------------------------------|--------------------------------------------------|
| WebGL not available             | Auto-fallback to Cloudflare Workers AI           |
| Hugging Face API throttled      | Skip signal, redistribute weights to remaining 6 |
| MobileNet load fails            | Show retry button, continue with 5 signals       |
| Individual signal throws        | Catch error, assign neutral score 50, confidence 0 |
| Non-image file uploaded         | Inline error in DropZone, no crash               |
| Image smaller than 64×64px      | Skip texture + noise signals, show warning       |
| Sentry initialization fails     | Silent fail, app continues normally              |

---

## 🚀 Performance Targets

| Metric                        | Target   | How Achieved                              |
|-------------------------------|----------|-------------------------------------------|
| Cold start (first ever visit) | < 8s     | Vite code splitting + Vercel CDN          |
| Warm start (model cached)     | < 500ms  | Service Worker serves MobileNet from cache|
| Time to analysis (warm)       | < 1.5s   | WebGL GPU inference + Promise.all         |
| Time to analysis (cold)       | < 4s     | Model preloaded on app mount              |
| Peak GPU memory               | < 200MB  | tf.tidy + manual tensor disposal          |
| JS bundle (gzipped)           | < 150KB  | Vite tree-shaking, TF.js excluded         |
| HF API response               | < 2s     | Called in parallel with local signals     |

---

## 📋 Build Phases (Ordered)

### Phase 1 — Project Scaffold
- [ ] T01: Vite + React setup
- [ ] T02: Install all dependencies
- [ ] T03: Configure Tailwind
- [ ] T04: Add Google Fonts
- [ ] T05: CSS design tokens (from UI_SPEC.md)
- [ ] T06: Create folder structure

### Phase 2 — Utilities
- [ ] T07: `constants.js` (weights, verdicts, signal metadata)
- [ ] T08: `imageUtils.js` (canvas preprocessing, 224×224 + 64×64)

### Phase 3 — ML Modules
- [ ] T09: `mobilenetFeatures.js`
- [ ] T10: `frequencyAnalysis.js`
- [ ] T11: `colorStats.js`
- [ ] T12: `edgeAnalysis.js`
- [ ] T13: `textureAnalysis.js`
- [ ] T14: `noiseAnalysis.js`
- [ ] T15: `huggingFaceSignal.js` 🆕 (7th signal via HF API)
- [ ] T16: `scorer.js` (confidence-weighted ensemble, 7 signals)
- [ ] T17: `detector.js` (Promise.all orchestrator)

### Phase 4 — Resilience Layer
- [ ] T18: Cloudflare Workers AI fallback (when WebGL fails)
- [ ] T19: Service Worker setup with Workbox (model caching)
- [ ] T20: Sentry initialization in `main.jsx`

### Phase 5 — Components
- [ ] T21: `DropZone.jsx`
- [ ] T22: `LoadingState.jsx`
- [ ] T23: `ScoreGauge.jsx`
- [ ] T24: `ResultBanner.jsx`
- [ ] T25: `DimensionCard.jsx`

### Phase 6 — App Assembly
- [ ] T26: `App.jsx` (full state machine + flow)
- [ ] T27: Per-signal progress callbacks
- [ ] T28: Error boundary

### Phase 7 — Polish & Deploy
- [ ] T29: Header + ModelStatus badge
- [ ] T30: Responsive layout (mobile + desktop)
- [ ] T31: Tensor memory audit (Chrome DevTools)
- [ ] T32: Deploy to Vercel
- [ ] T33: Point domain through Cloudflare
- [ ] T34: Verify Sentry receiving events
- [ ] T35: Verify Vercel Analytics active

---

## 🏁 Final Ratings (Free Stack)

| Layer                        | Rating   |
|------------------------------|----------|
| Framework (React + Vite)     | ✅ 10/10 |
| ML Runtime (TF.js + WebGL)   | ✅ 9/10  |
| Detection Accuracy (7 signals)| ✅ 8/10 |
| Reliability + Fallbacks      | ✅ 9/10  |
| Hosting + CDN (Vercel+CF)    | ✅ 10/10 |
| Model Caching (Service Worker)| ✅ 10/10|
| Error Tracking (Sentry)      | ✅ 9/10  |
| Analytics (Vercel)           | ✅ 9/10  |
| **Overall**                  | **🔥 9.2/10** |

---

## 💰 Paid Upgrade Path (Future)

If you ever want to go beyond free limits:

| Upgrade                        | Cost/month | Gain                                  |
|-------------------------------|------------|---------------------------------------|
| Hugging Face Inference Pro     | $9         | No rate limits on API                 |
| Vercel Pro                     | $20        | More bandwidth, team features         |
| Sentry Team                    | $26        | 50k errors/month, better alerts       |
| Cloudflare Workers Paid        | $5         | 10M req/day (from 10k)                |
| Self-hosted HF Space (GPU)     | Free!      | Your own fine-tuned model, no limits  |

Total paid cost for true production scale: ~$60/month max.
