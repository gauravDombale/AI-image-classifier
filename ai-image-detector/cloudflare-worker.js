/**
 * Cloudflare Worker — AIGC·DETECT Proxy
 *
 * Routes:
 *   POST /hive  → Proxy to Hive V3 AI image detection API
 *                 (HIVE_API_KEY stored as CF Worker secret, never in browser)
 *   POST /       → Cloudflare AI fallback (WebGL not available)
 *
 * CORS: allows all origins so the browser can call this worker directly.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const HIVE_ENDPOINT = 'https://api.thehive.ai/api/v3/ai-generated-image-detection';

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // ── Route: /hive — Proxy to Hive V3 API ──────────────────────
    if (url.pathname === '/hive') {
      const hiveKey = env.HIVE_API_KEY;
      if (!hiveKey) {
        return Response.json(
          { error: 'HIVE_API_KEY not configured in Worker secrets' },
          { status: 500, headers: CORS_HEADERS }
        );
      }

      try {
        // Forward the multipart form body as-is to Hive
        const hiveRes = await fetch(HIVE_ENDPOINT, {
          method:  'POST',
          headers: { 'Authorization': `Token ${hiveKey}` },
          body:    request.body,
        });

        // Read body as text first — Hive sometimes returns non-JSON errors
        const rawText = await hiveRes.text();
        let data;
        try {
          data = JSON.parse(rawText);
        } catch {
          // Hive returned non-JSON — surface it for debugging
          return Response.json(
            { error: `Hive API error (HTTP ${hiveRes.status})`, rawResponse: rawText.slice(0, 500) },
            { status: hiveRes.status, headers: CORS_HEADERS }
          );
        }

        return Response.json(data, {
          status:  hiveRes.status,
          headers: CORS_HEADERS,
        });

      } catch (err) {
        return Response.json(
          { error: 'Hive proxy error', detail: err?.message },
          { status: 502, headers: CORS_HEADERS }
        );
      }
    }

    // ── Route: / — Cloudflare AI fallback (WebGL unavailable) ────
    try {
      const imageData = await request.arrayBuffer();

      if (!imageData || imageData.byteLength === 0) {
        return Response.json({ error: 'No image data received' }, { status: 400, headers: CORS_HEADERS });
      }
      if (imageData.byteLength > 4 * 1024 * 1024) {
        return Response.json({ error: 'Image too large (max 4MB)' }, { status: 413, headers: CORS_HEADERS });
      }

      const result = await env.AI.run('@cf/microsoft/resnet-50', {
        image: [...new Uint8Array(imageData)],
      });

      const topScore    = result?.[0]?.score ?? 0;
      const topLabel    = result?.[0]?.label ?? '';
      const secondScore = result?.[1]?.score ?? 0;
      const dominanceRatio = topScore > 0 ? secondScore / topScore : 0;
      const aiScore = Math.round(Math.min(100, dominanceRatio * 120));

      return Response.json(
        { score: aiScore, confidence: 0.55, label: 'Cloudflare AI Scan', detail: `Top: "${topLabel}" (${(topScore * 100).toFixed(1)}%)` },
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );

    } catch (err) {
      return Response.json(
        { error: 'Worker error', detail: err?.message },
        { status: 500, headers: CORS_HEADERS }
      );
    }
  },
};
