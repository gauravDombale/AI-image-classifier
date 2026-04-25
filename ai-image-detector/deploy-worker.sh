#!/bin/bash
# ─────────────────────────────────────────────────────
# deploy-worker.sh
# Deploys the Cloudflare Worker AND re-sets all secrets.
# Run this whenever cloudflare-worker.js changes.
#
# Usage:
#   chmod +x deploy-worker.sh  (first time only)
#   ./deploy-worker.sh
# ─────────────────────────────────────────────────────

set -e  # Exit on any error

WORKER_NAME="aigc-detect-fallback"
ENV_FILE=".env"

echo "🚀 Deploying $WORKER_NAME..."

# ── 1. Deploy worker code ─────────────────────────────
npx wrangler deploy cloudflare-worker.js \
  --name "$WORKER_NAME" \
  --compatibility-date 2024-01-01

echo "✅ Worker code deployed."

# ── 2. Read secrets from .env ─────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "⚠️  No .env file found — skipping secret upload."
  exit 0
fi

# Parse SE_API_USER and SE_API_SECRET from .env
SE_API_USER=$(grep "^SE_API_USER=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
SE_API_SECRET=$(grep "^SE_API_SECRET=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")

# ── 3. Set secrets ────────────────────────────────────
if [ -n "$SE_API_USER" ]; then
  echo "$SE_API_USER" | npx wrangler secret put SE_API_USER --name "$WORKER_NAME"
  echo "✅ SE_API_USER secret set."
else
  echo "⚠️  SE_API_USER not found in .env — skipping."
fi

if [ -n "$SE_API_SECRET" ]; then
  echo "$SE_API_SECRET" | npx wrangler secret put SE_API_SECRET --name "$WORKER_NAME"
  echo "✅ SE_API_SECRET secret set."
else
  echo "⚠️  SE_API_SECRET not found in .env — skipping."
fi

echo ""
echo "🎉 Worker fully deployed with secrets. Test:"
echo "   curl -X POST https://$WORKER_NAME.gauravdombale007.workers.dev/sightengine -F 'image=@/path/to/test.jpg'"
