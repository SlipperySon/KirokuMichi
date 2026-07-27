#!/usr/bin/env bash
# Print the short human checklist for closed-beta staging.
# Usage: ./tools/staging-checklist.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

cat <<EOF
KirokuMichi closed-beta staging — manual checklist
==================================================

1. Render Blueprint deploy
   - Open https://dashboard.render.com → New → Blueprint
   - Connect GitHub repo SlipperySon/KirokuMichi (branch: main)
   - Confirm blueprint file: render.yaml (service: kirokumichi-staging)
   - Fill every sync:false prompt (invite codes + API keys — leave unused AI keys blank if unused)

2. After first deploy succeeds, copy the service URL (https://….onrender.com)

3. Smoke (from a machine with curl):
   cd app && npm run staging:smoke -- https://YOUR-SERVICE.onrender.com

4. Manual spot-checks once:
   - /api/health → 200
   - Beta invite screen appears; redeem a code from BETA_INVITE_CODES
   - Settings → test AI connection (HttpOnly kiroku-session cookie; /api/session has no token body)
   - /data/generated/import.sql → 404
   - Submit a test report → GitHub Issue appears in GITHUB_REPORT_REPO
   - Optional: PDF extract (needs DEEPSEEK_API_KEY), Sentry error, backup export/restore

5. Share invite codes + staging URL with closed-beta testers only

Env names (no values):
EOF

bash "$ROOT/app/tools/staging-env-required.sh"

echo
echo "Docs: $ROOT/STAGING.md"
echo "Env template: $ROOT/app/.env.example"
