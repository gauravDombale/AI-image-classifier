/**
 * Cloudflare Worker — AIGC·DETECT Proxy
 * Route: POST /sightengine → Proxy to Sightengine AI detection API
 * Credentials: SE_API_USER + SE_API_SECRET stored as CF Worker secrets
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age':       '86400',
};

const SE_ENDPOINT = 'https://api.sightengine.com/1.0/check.json';
const DEFAULT_SE_MODELS = 'genai';

function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      ...CORS_HEADERS,
      ...(init.headers ?? {}),
    },
  });
}

function getUploadedFile(formData) {
  return formData.get('image') ?? formData.get('media') ?? formData.get('file');
}

function isFileLike(value) {
  return value && typeof value === 'object' && typeof value.arrayBuffer === 'function';
}

export default {
  async fetch(request, env) {

    // ── CORS preflight ─────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // ── Health check ───────────────────────────────────────────
    if (url.pathname === '/health') {
      return json({
        ok: true,
        service: 'aigc-detect-fallback',
        routes: ['POST /sightengine'],
        sightengineConfigured: Boolean(env.SE_API_USER && env.SE_API_SECRET),
        models: env.SE_MODELS || DEFAULT_SE_MODELS,
      });
    }

    // ── Route: POST /sightengine ───────────────────────────────
    if (url.pathname === '/sightengine') {
      if (request.method !== 'POST') {
        return json(
          { error: 'Method not allowed. Use POST with multipart form field "image".' },
          { status: 405 }
        );
      }

      const apiUser   = env.SE_API_USER;
      const apiSecret = env.SE_API_SECRET;
      const models    = env.SE_MODELS || DEFAULT_SE_MODELS;

      if (!apiUser || !apiSecret) {
        return json(
          { error: 'SE_API_USER or SE_API_SECRET not configured in Worker secrets' },
          { status: 500 }
        );
      }

      let imageFile;
      try {
        const incomingForm = await request.formData();
        imageFile = getUploadedFile(incomingForm);
      } catch (err) {
        return json(
          { error: 'Failed to parse form data', detail: err?.message },
          { status: 400 }
        );
      }

      if (!isFileLike(imageFile)) {
        return json(
          { error: 'Missing image upload. Send multipart field "image", "media", or "file".' },
          { status: 400 }
        );
      }

      if (imageFile.size === 0) {
        return json(
          {
            error: 'Uploaded image is empty',
            detail: 'The curl request must include file bytes. Use: curl -X POST <worker>/sightengine -F "image=@/absolute/path/to/image.png"',
          },
          { status: 400 }
        );
      }

      try {
        const outForm = new FormData();
        const filename = imageFile.name || 'upload';
        outForm.append('media',      imageFile, filename);
        outForm.append('models',     models);
        outForm.append('api_user',   apiUser);
        outForm.append('api_secret', apiSecret);

        const seRes   = await fetch(SE_ENDPOINT, { method: 'POST', body: outForm });
        const rawText = await seRes.text();

        let data;
        try {
          data = JSON.parse(rawText);
        } catch {
          return json(
            { error: `Sightengine non-JSON response (HTTP ${seRes.status})`, raw: rawText.slice(0, 200) },
            { status: seRes.status }
          );
        }

        if (!seRes.ok || data.status === 'failure') {
          return json(
            {
              error: 'Sightengine API error',
              status: seRes.status,
              sightengine: data,
            },
            { status: seRes.ok ? 502 : seRes.status }
          );
        }

        return json(data, { status: seRes.status });

      } catch (err) {
        return json(
          { error: 'Sightengine proxy error', detail: err?.message },
          { status: 502 }
        );
      }
    }

    // ── 404 for any other route ────────────────────────────────
    return json(
      { error: `Route not found: ${url.pathname}. Available: POST /sightengine` },
      { status: 404 }
    );
  },
};
