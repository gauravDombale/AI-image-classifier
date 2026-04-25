/**
 * Cloudflare Worker — AIGC·DETECT Proxy
 *
 * Routes:
 *   POST /sightengine → Proxy to Sightengine AI detection API
 *                       (SE_API_USER + SE_API_SECRET stored as CF Worker secrets)
 *   POST /            → Cloudflare AI fallback (WebGL unavailable)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SE_ENDPOINT = 'https://api.sightengine.com/1.0/check.json';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // ── Route: /sightengine — Proxy to Sightengine API ────────────
    if (url.pathname === '/sightengine') {
      const apiUser   = env.SE_API_USER;
      const apiSecret = env.SE_API_SECRET;

      if (!apiUser || !apiSecret) {
        return Response.json(
          { error: 'SE_API_USER or SE_API_SECRET not set in Worker secrets' },
          { status: 500, headers: CORS_HEADERS }
        );
      }

      try {
        // Read incoming multipart (has the image under 'media' key)
        const incomingForm = await request.formData();
        const imageFile    = incomingForm.get('image'); // field name from our client

        if (!imageFile) {
          return Response.json({ error: 'No image field in request' }, { status: 400, headers: CORS_HEADERS });
        }

        // Build Sightengine request
        const outForm = new FormData();
        outForm.append('media',      imageFile);
        outForm.append('models',     'deepfake,genai');
        outForm.append('api_user',   apiUser);
        outForm.append('api_secret', apiSecret);

        const seRes = await fetch(SE_ENDPOINT, { method: 'POST', body: outForm });
        const rawText = await seRes.text();

        let data;
        try {
          data = JSON.parse(rawText);
        } catch {
          return Response.json(
            { error: `Sightengine non-JSON response (HTTP ${seRes.status})`, raw: rawText.slice(0, 200) },
            { status: seRes.status, headers: CORS_HEADERS }
          );
        }

        return Response.json(data, { status: seRes.status, headers: CORS_HEADERS });

      } catch (err) {
        return Response.json(
          { error: 'Sightengine proxy error', detail: err?.message },
          { status: 502, headers: CORS_HEADERS }
        );
      }
    }

    // ── Route: / — Cloudflare AI fallback (WebGL unavailable) ────
    try {
      const imageData = await request.arrayBuffer();
      if (!imageData || imageData.byteLength === 0) {
        return Response.json({ error: 'No image data' }, { status: 400, headers: CORS_HEADERS });
      }

      const result = await env.AI.run('@cf/microsoft/resnet-50', {
        image: [...new Uint8Array(imageData)],
      });

      const topScore       = result?.[0]?.score ?? 0;
      const topLabel       = result?.[0]?.label ?? '';
      const secondScore    = result?.[1]?.score ?? 0;
      const dominanceRatio = topScore > 0 ? secondScore / topScore : 0;
      const aiScore        = Math.round(Math.min(100, dominanceRatio * 120));

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
