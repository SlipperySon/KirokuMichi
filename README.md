# KirokuMichi 記録の道

An AI-powered Japanese learning app that combines **spaced repetition**, **textbook-grade lessons**, and **conversation practice** in a single offline-capable web app.

> "Kiroku no Michi" — *the path of recording* — every word you study, every mistake you make, every conversation you practice is logged and rescheduled.

**Status (Nov 2026):** A1–B2 closed-beta candidate. Feature work is shipped; next work is staging deploy + cloud TTS + dependency hygiene.  
**Source of truth:** [`HANDOFF.md`](./HANDOFF.md) · priorities in [`todo.md`](./todo.md) · staging in [`STAGING.md`](./STAGING.md)

---

## How the product fits together

One primary path for learners:

1. **Today** (`/study`) — dues first, then continue the active lesson  
2. **Course** (`/learn` → lesson rail) — Intro → Teach → Check → Practice → Cards → Speak → Done  
3. **Review** (`/study/srs`) — the same FSRS/SM-2 Anki stack used by the Cards step  
4. **Speak** (`/scenarios`) — roleplay; can also satisfy Speak on the lesson rail  

Optional side paths (Library):

- **JLPT drills** (`/study/jlpt`) — grammar/vocab/test bank; not the CEFR course  
- **Immersion** / **AI Tutor** / **My Content** — import, native text, free practice  

C1 / authentic-Japanese content is intentionally out of beta scope.

---

## What it does

- **206 curated conversation scenarios** from Genki, Marugoto, Quartet, and Tobira — CEFR A1 → B2  
- **133 gold learner packs** covering A1–B2 (Genki I/II, Quartet I/II, Tobira, Marugoto A1/A2/B1)  
- **FSRS + SM-2** schedulers (FSRS default); Anki import/export; lesson-gated Genki starter  
- **Conversation Partner** mode with AI corrections fed back into SRS  
- **Mistake Review**, streaks / daily goals / freeze tokens  
- **Cloud TTS only** (Sarashina → ElevenLabs later) — never browser/`speechSynthesis`  
- **Offline-first** — local SQLite (sql.js); only AI/TTS leave the device  

---

## Tech stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind 4 + Zustand + React Router 7  
- **SRS:** `ts-fsrs` + custom SM-2  
- **Database:** sql.js (WASM), persisted via IndexedDB  
- **Backend:** Node.js + Express (AI proxy, TTS, beta/session, reports)  
- **Content pipeline:** Python OCR + TypeScript normalization / gold-pack scripts  

---

## Quick start

```bash
cd app
npm install
cp .env.example .env   # add Anthropic key; optional TTS_PROVIDER

npm run dev            # http://localhost:5173
npm run server         # http://localhost:3001
```

Onboarding places you on the CEFR ladder, seeds a lesson-gated Genki starter, and routes to Today.

---

## Quality gates

```bash
cd app
npm run verify
```

Verified on the Nov 2026 cohesion pass: **0 TypeScript errors · 297 unit tests · 90 Playwright specs · production build clean · learner content issueCount 0 · Maynard 100%**.

---

## License

Personal project — not yet licensed for redistribution.
