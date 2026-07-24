#!/usr/bin/env bash
# One-command staging smoke checks for a deployed KirokuMichi origin.
# Usage:
#   ./tools/staging-smoke.sh https://kirokumichi-staging.onrender.com
#   BASE_URL=http://127.0.0.1:3001 ./tools/staging-smoke.sh
set -euo pipefail

BASE_URL="${1:-${BASE_URL:-http://127.0.0.1:3001}}"
BASE_URL="${BASE_URL%/}"

fail=0
check() {
  local name="$1"
  local url="$2"
  local expect_code="${3:-200}"
  local code
  code=$(curl -sS -o /tmp/kiroku-smoke-body.json -w '%{http_code}' "$url" || echo "000")
  if [[ "$code" == "$expect_code" ]]; then
    echo "ok  $name ($code)"
  else
    echo "FAIL $name — expected $expect_code got $code ($url)"
    fail=1
  fi
}

echo "Staging smoke against $BASE_URL"
check health "$BASE_URL/api/health" 200
check beta_status "$BASE_URL/api/beta/status" 200
check reviewed_index "$BASE_URL/data/generated/reviewed/index.json" 200
# Must never publicly serve DB dump / packaging artifacts.
check import_sql_blocked "$BASE_URL/data/generated/import.sql" 404

if command -v node >/dev/null 2>&1; then
  node --input-type=module <<'NODE' || fail=1
import { readFileSync } from 'node:fs'
const body = readFileSync('/tmp/kiroku-smoke-body.json', 'utf8')
const data = JSON.parse(body)
const packs = data.packs ?? []
const drafts = packs.filter((p) => p.tier === 'draft')
const gold = packs.filter((p) => p.tier === 'gold')
console.log(`ok  pack_index (gold=${gold.length} draft=${drafts.length} total=${packs.length})`)
if (drafts.length > 0) {
  console.log(`warn leftover drafts: ${drafts.map((d) => d.lessonId).join(', ')}`)
}
if (gold.length < 1) {
  console.error('FAIL pack_index — expected at least one gold pack')
  process.exit(1)
}
NODE
fi

if [[ "$fail" -ne 0 ]]; then
  echo "Smoke checks failed"
  exit 1
fi
echo "Smoke checks passed"
