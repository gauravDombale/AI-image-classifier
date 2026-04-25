/**
 * Cloudflare Worker — AIGC·DETECT Fallback
 * Runs when user's browser doesn't support WebGL.
 * Uses Cloudflare AI's image classification as a proxy signal.
 *
 * Free tier: 10,000 requests/day
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    try {
      // Read raw image bytes from request body
      const imageData = await request.arrayBuffer();

      if (!imageData || imageData.byteLength === 0) {
        return Response.json({ error: 'No image data received' }, { status: 400, headers: CORS_HEADERS });
      }

      // Cap image size to 4MB to stay within Worker limits
      if (imageData.byteLength > 4 * 1024 * 1024) {
        return Response.json({ error: 'Image too large (max 4MB)' }, { status: 413, headers: CORS_HEADERS });
      }

      // Run Cloudflare AI image classification
      // Model: @cf/microsoft/resnet-50 — general image classifier, free
      const result = await env.AI.run('@cf/microsoft/resnet-50', {
        image: [...new Uint8Array(imageData)],
      });

      // resnet-50 returns top-5 labels with scores
      // We use this as a heuristic: if top predictions look "unnatural"
      // (e.g., no real-world objects detected at high confidence), flag as likely AI
      const topScore    = result?.[0]?.score ?? 0;
      const topLabel    = result?.[0]?.label ?? '';
      const secondScore = result?.[1]?.score ?? 0;

      // Heuristic: real photos → one dominant class (high topScore)
      // AI images → more evenly distributed scores (lower topScore, higher secondScore ratio)
      const dominanceRatio = topScore > 0 ? secondScore / topScore : 0;

      // Score 0–100: higher dominanceRatio = more AI-like distribution
      const aiScore = Math.round(Math.min(100, dominanceRatio * 120));

      return Response.json(
        {
          score:      aiScore,
          confidence: 0.55,
          label:      'Cloudflare AI Scan',
          detail:     `Top class: "${topLabel}" (${(topScore * 100).toFixed(1)}%)`,
          backend:    'cloudflare-workers-ai',
        },
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );

    } catch (err) {
      console.error('Worker error:', err?.message ?? err);
      return Response.json(
        { error: 'Internal worker error', detail: err?.message },
        { status: 500, headers: CORS_HEADERS }
      );
    }
  },
};
