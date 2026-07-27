#!/usr/bin/env bash
# Print env vars required / recommended for staging (no secrets).
# Usage: ./tools/staging-env-required.sh
set -euo pipefail

cat <<'EOF'
KirokuMichi staging — environment variables (names only)

REQUIRED (set in Render dashboard / Blueprint prompts):
  BETA_INVITE_CODES       comma-separated invite codes (closed beta gate)
  DEEPSEEK_API_KEY        server PDF extraction
  GITHUB_REPORT_REPO      owner/repo for in-app report issues
  GITHUB_REPORT_TOKEN     token that can create issues in that repo

REQUIRED (at least one hosted AI provider, OR testers paste their own key in Settings):
  ANTHROPIC_API_KEY
  OPENAI_API_KEY
  OPENROUTER_API_KEY

SET AUTOMATICALLY by render.yaml (do not override unless you know why):
  NODE_ENV=production
  HOST=0.0.0.0
  TRUST_PROXY=1              (also auto-on when NODE_ENV=production)
  SENTRY_ENVIRONMENT=staging
  VITE_SENTRY_ENVIRONMENT=staging
  AZURE_TTS_REGION=eastus

OPTIONAL:
  CUSTOM_PROVIDER_API_KEY / CUSTOM_PROVIDER_ENDPOINT / CUSTOM_PROVIDER_ENDPOINTS
  AI_MODEL_ALLOWLIST
  AZURE_TTS_KEY
  PUBLIC_ORIGIN              canonical https origin for CSRF Origin checks if split-hosted
  CORS_ORIGINS               extra frontend origins if API is separate
  SENTRY_DSN / SENTRY_RELEASE / VITE_SENTRY_DSN / VITE_SENTRY_RELEASE

See ../STAGING.md and .env.example for details.
EOF
