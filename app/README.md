# KirokuMichi app

Source for the Japanese learning web app. Canonical project docs live at the repo root:

- [`../README.md`](../README.md) — product overview
- [`../HANDOFF.md`](../HANDOFF.md) — **source of truth** for feature status
- [`../STAGING.md`](../STAGING.md) — Render closed-beta deploy
- [`../todo.md`](../todo.md) — current priorities

## Quick start

```bash
npm install
cp .env.example .env   # add ANTHROPIC_API_KEY (and optional TTS)
npm run dev            # Vite → http://localhost:5173
npm run server         # Express AI/TTS proxy → http://localhost:3001
```

## Verify

```bash
npm run verify   # lint + tsc + vitest + playwright + build + content audits
```

## Layout

| Path | Role |
|---|---|
| `src/` | React UI, SRS, lesson rail, content services |
| `server/` | Express proxy (AI, TTS, report, beta/session) |
| `data/generated/` | Curriculum JSON (lessons, scenarios, JLPT banks) |
| `tools/` | OCR / gold-pack / staging scripts |
| `tts-sidecar/` | Optional Sarashina local TTS process |
