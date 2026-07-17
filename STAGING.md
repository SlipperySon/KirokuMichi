# KirokuMichi Staging

## Hosting

Use Render for staging so the Express API, `/data` assets, and built Vite frontend run on one origin.

- Blueprint: `render.yaml`
- Service root: `app`
- Build command: `npm ci && npm run build`
- Start command: `npm run start`
- Health check: `/api/health`

Vercel can still host the static frontend, but then `/api/*` must be proxied to the backend host. The Render
single-service path avoids split-origin CORS and cookie/session wrinkles for staging.

## Required Environment Variables

Set these in the Render service dashboard. Do not commit real values.

- `DEEPSEEK_API_KEY`: required for server PDF extraction.
- `GITHUB_REPORT_REPO`: report sink in `owner/repo` form.
- `GITHUB_REPORT_TOKEN`: GitHub token with permission to create issues in the report repo.
- `BETA_INVITE_CODES`: comma-separated invite codes for closed beta access.

Configure at least one hosted AI provider used by the app, or let testers enter their own API key in Settings:

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`

If a tester enters their own hosted-provider key, it is kept only in the in-memory app session, sent to the
Express proxy for that request, and scrubbed from persisted Zustand state. Refreshing the app clears it.

Optional:

- `CUSTOM_PROVIDER_API_KEY`: auth for the OpenAI-compatible custom provider.
- `SENTRY_DSN`: server-side Sentry DSN.
- `SENTRY_ENVIRONMENT`: `staging`.
- `SENTRY_RELEASE`: app release/commit identifier.
- `VITE_SENTRY_DSN`: browser Sentry DSN.
- `VITE_SENTRY_ENVIRONMENT`: `staging`.
- `VITE_SENTRY_RELEASE`: browser release/commit identifier.
- `CORS_ORIGINS`: comma-separated frontend origins only if the API is hosted separately.

## Verification

Before opening staging publicly:

```bash
cd app
npm audit
npm run build
npm run test -- --run src/srs/phase1.test.ts src/srs/srs.test.ts src/srs/ankiImport.test.ts src/core/scheduler.test.ts
```

After deploy:

- Open `/api/health`.
- Confirm the beta invite screen appears when `BETA_INVITE_CODES` is configured.
- Submit a test report and confirm it creates a GitHub Issue.
- Test the selected AI provider from Settings.
- Run a small PDF extraction smoke test; this requires server `DEEPSEEK_API_KEY` or a tester-provided DeepSeek key.
- Trigger one browser error in a private staging session and confirm it appears in Sentry if Sentry is enabled.
