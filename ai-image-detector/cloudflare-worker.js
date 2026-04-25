/**
 * Cloudflare Worker — AIGC·DETECT Fallback
 * Used when the user's browser doesn't support WebGL.
 * Routes: POST / → Cloudflare AI (resnet-50 fallback)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    try {
      const imageData = await request.arrayBuffer();
      if (!imageData || imageData.byteLength === 0) {
        return Response.json({ error: 'No image data' }, { status: 400, headers: CORS_HEADERS });
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
