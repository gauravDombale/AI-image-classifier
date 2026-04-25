# Hive V3 AI Image Detector — Implementation Guide

## Overview

Use Hive's AI-Generated Image & Video Detection API (V3) to classify whether an image was created by an AI engine (DALL-E, Midjourney, Stable Diffusion, Flux, etc.) or is a deepfake. The model returns confidence scores and identifies the likely source generator.

- **Accuracy:** 94% (independent 2026 benchmarking)
- **Free tier:** 100 requests/day (V3 self-serve, no sales call needed)
- **Latency:** ~500ms for thumbnail images
- **Supported formats:** jpg, png, gif, webp (images) | mp4, webm, avi, mkv, wmv, mov (video)

---

## Step 1: Get Your API Key

1. Sign up at [https://portal.thehive.ai/signup](https://portal.thehive.ai/signup)
2. Go to **API Keys** in the left sidebar of the Hive UI
3. Create a new **V3 API Key**
4. Store it securely — treat it like a password

```
HIVE_API_KEY=your_v3_api_key_here
```

> ⚠️ V3 is the self-serve instant-on API. Do NOT use V2 endpoints — those require an enterprise contract.

---

## Step 2: API Endpoint

```
POST https://api.thehive.ai/api/v3/ai-generated-image-detection
```

### Headers

```
Authorization: Token <YOUR_HIVE_API_KEY>
Content-Type: multipart/form-data   # when uploading a file
Content-Type: application/json      # when passing a URL
```

---

## Step 3: Request Formats

### Option A — Submit by URL (JSON)

```bash
curl -X POST https://api.thehive.ai/api/v3/ai-generated-image-detection \
  -H "Authorization: Token <YOUR_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/image.jpg"}'
```

### Option B — Upload a Local File (multipart)

```bash
curl -X POST https://api.thehive.ai/api/v3/ai-generated-image-detection \
  -H "Authorization: Token <YOUR_API_KEY>" \
  -F "image=@/path/to/image.jpg"
```

---

## Step 4: Response Structure

```json
{
  "status": {
    "code": 200,
    "message": "SUCCESS"
  },
  "on": {
    "id": "task_abc123",
    "url": "https://example.com/image.jpg"
  },
  "output": [
    {
      "time": 0.482,
      "classes": [
        {
          "class": "ai_generated",
          "score": 0.9872
        },
        {
          "class": "not_ai_generated",
          "score": 0.0128
        },
        {
          "class": "dalle",
          "score": 0.8741
        },
        {
          "class": "midjourney",
          "score": 0.0512
        },
        {
          "class": "none",
          "score": 0.0747
        },
        {
          "class": "deepfake",
          "score": 0.02
        }
      ]
    }
  ]
}
```

### Response Fields

| Field | Description |
|---|---|
| `classes[].class` | Label — see classes list below |
| `classes[].score` | Confidence score (0–1). Scores within each head sum to 1 |
| `on.id` | Task ID — use this to report false positives back to Hive |

### Key Classes

**Head 1 — Generation (binary):**
- `ai_generated` — image is AI-generated
- `not_ai_generated` — image is real/human-made

**Head 2 — Source (generator):**
- `dalle`, `midjourney`, `stablediffusion`, `stablediffusionxl`, `flux`, `flux2`, `imagen`, `adobefirefly`, `gan`, `4o`, `grok`, `ideogram`, `leonardo`, `kandinsky`, `sora`, `runway`, `pika`, `kling`, `luma`, `heygen`, `gptimage1_5`, `hidream`, `wan`, `veo3`, `imagen4`, `gemini`, and many more
- `other_image_generators` — AI-generated but source unknown
- `inconclusive` — cannot identify source
- `none` — not AI-generated

**Head 3 — Deepfake:**
- `deepfake` — score 0–1 (highest face score across all detected faces)

---

## Step 5: Recommended Thresholds

| Detection Type | Threshold | Notes |
|---|---|---|
| AI-Generated Image | **≥ 0.9** | Flag/reject above this |
| AI-Generated Video | **≥ 0.9** on any frame | Per-frame check |
| Deepfake Image | **≥ 0.9** | Based on highest face score |
| Deepfake Video | **≥ 0.5** on 2 consecutive frames OR 5% of all frames | |

> Start with these defaults, then tune based on your false positive rate.

---

## Step 6: Python Integration

```python
import os
import requests

HIVE_API_KEY = os.environ.get("HIVE_API_KEY")
ENDPOINT = "https://api.thehive.ai/api/v3/ai-generated-image-detection"

THRESHOLD_AI_GENERATED = 0.9
THRESHOLD_DEEPFAKE = 0.9


def detect_by_url(image_url: str) -> dict:
    headers = {"Authorization": f"Token {HIVE_API_KEY}"}
    payload = {"url": image_url}
    response = requests.post(ENDPOINT, headers=headers, json=payload)
    response.raise_for_status()
    return response.json()


def detect_by_file(file_path: str) -> dict:
    headers = {"Authorization": f"Token {HIVE_API_KEY}"}
    with open(file_path, "rb") as f:
        files = {"image": f}
        response = requests.post(ENDPOINT, headers=headers, files=files)
    response.raise_for_status()
    return response.json()


def parse_result(api_response: dict) -> dict:
    """
    Returns a clean summary dict from the raw Hive API response.
    """
    classes = api_response["output"][0]["classes"]
    scores = {c["class"]: c["score"] for c in classes}

    ai_score = scores.get("ai_generated", 0)
    deepfake_score = scores.get("deepfake", 0)

    # Find top source generator (exclude meta-classes)
    excluded = {"ai_generated", "not_ai_generated", "deepfake", "none", "inconclusive", "other_image_generators"}
    source_scores = {k: v for k, v in scores.items() if k not in excluded}
    top_source = max(source_scores, key=source_scores.get) if source_scores else "unknown"
    top_source_score = source_scores.get(top_source, 0)

    return {
        "is_ai_generated": ai_score >= THRESHOLD_AI_GENERATED,
        "ai_generated_score": round(ai_score, 4),
        "is_deepfake": deepfake_score >= THRESHOLD_DEEPFAKE,
        "deepfake_score": round(deepfake_score, 4),
        "likely_source": top_source if ai_score >= THRESHOLD_AI_GENERATED else None,
        "source_confidence": round(top_source_score, 4) if ai_score >= THRESHOLD_AI_GENERATED else None,
        "raw_scores": scores,
    }


# --- Usage ---

if __name__ == "__main__":
    # By URL
    result = detect_by_url("https://example.com/test-image.jpg")
    summary = parse_result(result)
    print(summary)

    # By file
    result = detect_by_file("./local_image.png")
    summary = parse_result(result)
    print(summary)
```

---

## Step 7: TypeScript / Node.js Integration

```typescript
import FormData from "form-data";
import fs from "fs";
import fetch from "node-fetch";

const HIVE_API_KEY = process.env.HIVE_API_KEY!;
const ENDPOINT = "https://api.thehive.ai/api/v3/ai-generated-image-detection";
const THRESHOLD = 0.9;

interface HiveClass {
  class: string;
  score: number;
}

interface DetectionSummary {
  isAiGenerated: boolean;
  aiScore: number;
  isDeepfake: boolean;
  deepfakeScore: number;
  likelySource: string | null;
  sourceConfidence: number | null;
}

async function detectByUrl(imageUrl: string): Promise<DetectionSummary> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Token ${HIVE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: imageUrl }),
  });

  if (!res.ok) throw new Error(`Hive API error: ${res.status}`);
  const data = await res.json();
  return parseResult(data);
}

async function detectByFile(filePath: string): Promise<DetectionSummary> {
  const form = new FormData();
  form.append("image", fs.createReadStream(filePath));

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Token ${HIVE_API_KEY}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!res.ok) throw new Error(`Hive API error: ${res.status}`);
  const data = await res.json();
  return parseResult(data);
}

function parseResult(data: any): DetectionSummary {
  const classes: HiveClass[] = data.output[0].classes;
  const scores = Object.fromEntries(classes.map((c) => [c.class, c.score]));

  const aiScore = scores["ai_generated"] ?? 0;
  const deepfakeScore = scores["deepfake"] ?? 0;

  const excluded = new Set(["ai_generated", "not_ai_generated", "deepfake", "none", "inconclusive", "other_image_generators"]);
  const sourceCandidates = classes.filter((c) => !excluded.has(c.class));
  const topSource = sourceCandidates.sort((a, b) => b.score - a.score)[0];

  return {
    isAiGenerated: aiScore >= THRESHOLD,
    aiScore,
    isDeepfake: deepfakeScore >= THRESHOLD,
    deepfakeScore,
    likelySource: aiScore >= THRESHOLD ? topSource?.class ?? null : null,
    sourceConfidence: aiScore >= THRESHOLD ? topSource?.score ?? null : null,
  };
}
```

---

## Step 8: Error Handling & Edge Cases

```python
import time

def detect_with_retry(image_url: str, retries: int = 3) -> dict:
    for attempt in range(retries):
        try:
            response = requests.post(
                ENDPOINT,
                headers={"Authorization": f"Token {HIVE_API_KEY}"},
                json={"url": image_url},
                timeout=15,
            )
            if response.status_code == 429:
                # Rate limited — you've hit 100 req/day on V3 free tier
                raise Exception("Hive V3 daily limit reached (100 req/day). Upgrade to Enterprise.")
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise
```

### Common Error Codes

| Code | Meaning | Action |
|---|---|---|
| `401` | Invalid or missing API key | Check `Authorization: Token <key>` header |
| `429` | Rate limit hit (100/day on V3 free) | Back off or upgrade to Enterprise |
| `400` | Bad request (unsupported format, bad URL) | Check file type and URL accessibility |
| `500` | Hive server error | Retry with exponential backoff |

---

## Step 9: Rate Limit Strategy (Free Tier)

The V3 free tier gives **100 requests/day**. To stay within limits:

1. **Cache results by image hash** — don't re-scan the same image twice
2. **Pre-filter by file type** before hitting the API
3. **Queue requests** with a token bucket (max 100/day = ~4/hour sustained)
4. Track usage in Redis or a simple SQLite table with a daily reset

```python
import hashlib

_cache: dict[str, dict] = {}  # replace with Redis in production

def get_image_hash(file_path: str) -> str:
    with open(file_path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()

def detect_cached(file_path: str) -> dict:
    h = get_image_hash(file_path)
    if h in _cache:
        return _cache[h]
    result = detect_by_file(file_path)
    _cache[h] = parse_result(result)
    return _cache[h]
```

---

## Step 10: FastAPI Wrapper (optional)

If you're building this as a service endpoint:

```python
from fastapi import FastAPI, UploadFile, File, HTTPException
import tempfile, os

app = FastAPI()

@app.post("/detect")
async def detect_image(file: UploadFile = File(...)):
    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        raw = detect_by_file(tmp_path)
        return parse_result(raw)
    finally:
        os.unlink(tmp_path)
```

---

## Quick Reference

| Item | Value |
|---|---|
| Endpoint | `POST https://api.thehive.ai/api/v3/ai-generated-image-detection` |
| Auth header | `Authorization: Token <API_KEY>` |
| Free quota | 100 requests/day |
| Recommended threshold | `ai_generated >= 0.9` |
| Deepfake threshold | `deepfake >= 0.9` (image), `>= 0.5` on 2 consecutive frames (video) |
| Avg latency | ~500ms (thumbnail), up to 10s (30s video segment) |
| Docs | https://docs.thehive.ai/docs/ai-image-and-video-detection |
| Sign up | https://portal.thehive.ai/signup |
