/**
 * Cloudflare Worker — AIGC·DETECT Proxy
 * Route: POST /sightengine → Proxy to Sightengine AI detection API
 * Credentials: SE_API_USER + SE_API_SECRET stored as CF Worker secrets
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SE_ENDPOINT = 'https://api.sightengine.com/1.0/check.json';

export default {
  async fetch(request, env) {

    // ── CORS preflight ─────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // ── Only allow POST ────────────────────────────────────────
    if (request.method !== 'POST') {
      return Response.json(
        { error: 'Method not allowed. Use POST.' },
        { status: 405, headers: CORS_HEADERS }
      );
    }

    const url = new URL(request.url);

    // ── Route: POST /sightengine ───────────────────────────────
    if (url.pathname === '/sightengine') {
      const apiUser   = env.SE_API_USER;
      const apiSecret = env.SE_API_SECRET;

      if (!apiUser || !apiSecret) {
        return Response.json(
          { error: 'SE_API_USER or SE_API_SECRET not configured in Worker secrets' },
          { status: 500, headers: CORS_HEADERS }
        );
      }

      let imageFile;
      try {
        const incomingForm = await request.formData();
        imageFile = incomingForm.get('image');
      } catch (err) {
        return Response.json(
          { error: 'Failed to parse form data', detail: err?.message },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      if (!imageFile) {
        return Response.json(
          { error: 'Missing "image" field in multipart form' },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      try {
        const outForm = new FormData();
        outForm.append('media',      imageFile);
        outForm.append('models',     'deepfake,genai');
        outForm.append('api_user',   apiUser);
        outForm.append('api_secret', apiSecret);

        const seRes   = await fetch(SE_ENDPOINT, { method: 'POST', body: outForm });
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

    // ── 404 for any other route ────────────────────────────────
    return Response.json(
      { error: `Route not found: ${url.pathname}. Available: POST /sightengine` },
      { status: 404, headers: CORS_HEADERS }
    );
  },
};
