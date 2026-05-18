# KirokuMichi 記録の道

An AI-powered Japanese learning app that combines **spaced repetition**, **textbook-grade lessons**, and **conversation practice** in a single offline-capable web app.

> "Kiroku no Michi" — *the path of recording* — every word you study, every mistake you make, every conversation you practice is logged and rescheduled.

---

## What it does

- **187+ curated conversation scenarios** drawn from Genki I/II, Marugoto A1/A2/B1, Quartet I/II, and Tobira — grouped by CEFR level (A1 → B2)
- **54 lesson packs** covering A1–B2, generated from real textbook OCR with cleaned vocabulary, grammar, and exercises
- **FSRS + SM-2 schedulers** for spaced repetition, with FSRS as the default
- **Conversation Partner mode** — roleplay scenarios with AI corrections, fed back into your SRS as drillable cards
- **Mistake Review** — every "Again" rating becomes a focused drill queue
- **Lesson Teaching Flow** — predict → reveal → hook → micro-practice → self-rate → mixed review
- **Grammar context in review** — CEFR grammar references + Maynard discourse explanations exposed on demand
- **Streak / daily goal / freeze tokens** to keep momentum without punishing missed days
- **Offline-first** — local SQLite (sql.js) for cards, mistakes, sessions; only AI calls leave the device

---

## Tech stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind 4 + Zustand + React Router 7
- **SRS:** `ts-fsrs` + custom SM-2 implementation
- **Database:** sql.js (SQLite compiled to WASM, persisted to localStorage)
- **Backend:** Node.js + Express proxy for AI provider calls (Anthropic / OpenAI / OpenRouter / DeepSeek / Ollama)
- **Content pipeline:** Python (PaddleOCR + pypdfium2) for textbook extraction → TypeScript normalization scripts

---

## Quick start

```bash
# 1. Install
cd app
npm install

# 2. Configure (copy template, add your Anthropic API key)
cp .env.example .env
$EDITOR .env

# 3. Run dev server + AI proxy (two terminals)
npm run dev      # http://localhost:5173
npm run server   # http://localhost:3001

# 4. (optional) build a production bundle
npm run build
npm run preview
```

The app boots into an onboarding flow that places you on the CEFR ladder, calibrates your kana familiarity, and seeds your first review queue.

---

## Project layout

```
app/
├── src/
│   ├── ai/                  # AI provider abstraction (multi-tier)
│   ├── components/          # Toast, ErrorBoundary, Navigation, Skeleton, etc.
│   ├── content/             # Curriculum, scenario, lesson services
│   ├── core/                # FSRS + SM-2 schedulers
│   ├── db/                  # SQLite storage (sql.js)
│   ├── onboarding/          # Multi-step onboarding flow
│   ├── pages/               # Settings, NotFound, etc.
│   ├── srs/                 # SRS service, mistake logging, Anki import
│   ├── store/               # Zustand global store
│   └── study/               # Review, lesson, conversation, scenario, dashboard
├── server/                  # Express AI proxy (session tokens, no API keys client-side)
├── data/generated/          # Curriculum JSON: lessons, scenarios, vocab, grammar
└── tools/                   # OCR + content pipeline scripts (python + tsx)
```

---

## Quality gates

All four must be green before shipping:

```bash
cd app
npm run lint
npx tsc --noEmit
npm run test
npm run build
```

Current status: **0 TypeScript errors · 116 / 116 tests passing · production build clean**.

---

## Health & observability

- `GET /api/health` — unauthenticated health endpoint for uptime monitors
- All AI calls go through the Express proxy and use rotating session tokens — no API keys ever ship to the client
- Errors surface via `<ErrorBoundary>` rather than blank screens

---

## License

Personal project — not yet licensed for redistribution.
