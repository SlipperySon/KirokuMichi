# KirokuMichi Staging

## Hosting

Use Render for staging so the Express API, `/data` assets, and built Vite frontend run on one origin.

- Blueprint: `render.yaml`
- Service root: `app`
- Build command: `npm ci && npm run build`
- Start command: `npm run start`
- Health check: `/api/health`
- Auto-deploy: enabled on the connected Git branch (see `autoDeploy: true` in `render.yaml`)

One-click path:

1. [Render Dashboard → New → Blueprint](https://dashboard.render.com/)
2. Connect `SlipperySon/KirokuMichi` on branch `main`
3. Confirm `render.yaml` → service `kirokumichi-staging`
4. Fill `sync: false` prompts (secrets). Unused optional keys may be left empty.

CLI alternatives (only if authenticated locally):

```bash
# Render CLI — not required; Blueprint UI is enough
# brew install render && render login && render blueprints launch

# GitHub CLI — useful for repo/issue checks, not for Render deploy
# gh auth login
```

Vercel can still host the static frontend, but then `/api/*` must be proxied to the backend host. The Render
single-service path avoids split-origin CORS and cookie/session wrinkles for staging.

## Required Environment Variables

Set these in the Render service dashboard (Blueprint prompts on first create). Do not commit real values.

List names anytime:

```bash
cd app
npm run staging:env-required
# or: npm run staging:checklist
```

**Always set on staging/prod:**

- `BETA_INVITE_CODES`: comma-separated invite codes for closed beta access.
  Without this, `/api/session` mints freely and AI/PDF burn server keys.
- `DEEPSEEK_API_KEY`: required for server PDF extraction.
- `GITHUB_REPORT_REPO`: report sink in `owner/repo` form.
- `GITHUB_REPORT_TOKEN`: GitHub token with permission to create issues in the report repo.

Configure at least one hosted AI provider used by the app, or let testers enter their own API key in Settings:

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`

If a tester enters their own hosted-provider key, it is kept only in the in-memory app session, sent to the
Express proxy for that request, and scrubbed from persisted Zustand state. Refreshing the app clears it.

**Set by `render.yaml` for Render (safe defaults):**

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `TRUST_PROXY=1` — trust a single reverse-proxy hop for client IP / rate limits.
  Server also enables trust proxy automatically when `NODE_ENV=production`
  (see `app/server/index.ts`). Keep `TRUST_PROXY=1` on Render; leave unset for local
  non-proxied `tsx` unless you terminate TLS in front of the app.

Optional:

- `CUSTOM_PROVIDER_API_KEY` + `CUSTOM_PROVIDER_ENDPOINT` (or `CUSTOM_PROVIDER_ENDPOINTS`):
  server key is only used for those allowlisted URLs; never for arbitrary client endpoints.
- `AI_MODEL_ALLOWLIST`: optional comma-separated model names (defaults to a safe built-in pattern).
- `SENTRY_DSN`: server-side Sentry DSN.
- `SENTRY_ENVIRONMENT`: `staging` (Blueprint default).
- `SENTRY_RELEASE`: app release/commit identifier.
- `VITE_SENTRY_DSN`: browser Sentry DSN.
- `VITE_SENTRY_ENVIRONMENT`: `staging` (Blueprint default).
- `VITE_SENTRY_RELEASE`: browser release/commit identifier.
- `CORS_ORIGINS`: comma-separated frontend origins only if the API is hosted separately.
- `PUBLIC_ORIGIN`: optional canonical https origin used with Origin/CSRF checks when split-hosted
  (`configuredBrowserOrigins` in `app/server/securityGuards.ts`). Not required for single-origin Render
  (same-host Origin/Referer is already allowed). Set it to `https://YOUR-SERVICE.onrender.com` if you
  also put a second frontend origin in front of the API.

**TTS (optional but needed for listen/speak cards):**

- `TTS_PROVIDER`: Blueprint default `sarashina`. Use `elevenlabs` for commercial-OK beta audio, or `none` to disable.
- `SARASHINA_TTS_URL`: base URL of the GPU sidecar when using Sarashina.
- `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` / `ELEVENLABS_MODEL_ID`: when `TTS_PROVIDER=elevenlabs`.
- Policy: never fall back to browser `speechSynthesis`. If TTS is down, listen/speak audio stays disabled.

Template with comments: `app/.env.example`.

## Verification

Offline (no live staging URL; also run in CI):

```bash
cd app
npm run staging:validate-config
```

Before opening staging publicly:

```bash
cd app
npm audit
npm run build
npm run test -- --run src/srs/phase1.test.ts src/srs/srs.test.ts src/srs/ankiImport.test.ts src/core/scheduler.test.ts
npm run textbook:learner:validate-published
```

After deploy (one-command smoke):

```bash
cd app
npm run staging:smoke -- https://YOUR-SERVICE.onrender.com
# or: ./tools/staging-smoke.sh https://YOUR-SERVICE.onrender.com
```

Manual checks still worth doing once:

- Open `/api/health`.
- Confirm the beta invite screen appears when `BETA_INVITE_CODES` is configured.
- Confirm AI calls work with the HttpOnly `kiroku-session` cookie only (Settings → test connection).
  `/api/session` must not return a token body; clients use `credentials: 'include'`.
- Confirm `/data/generated/import.sql` returns 404 (packaging dump must stay private).
- Submit a test report and confirm it creates a GitHub Issue.
- Test the selected AI provider from Settings.
- Run a small PDF extraction smoke test; this requires server `DEEPSEEK_API_KEY` or a tester-provided DeepSeek key.
- Trigger one browser error in a private staging session and confirm it appears in Sentry if Sentry is enabled.
- Export/restore a study backup from Settings on a throwaway profile.
