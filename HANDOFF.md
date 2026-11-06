# KirokuMichi — Handoff Document

**Last updated: 2026-11-06 (Australia/Brisbane)**  
**Status: A1–B2 closed-beta candidate — product cohesive; staging + cloud TTS still to finish**

> This file is the **source of truth** for feature status. Prefer it over `plan.md`, `memory/`, and older session notes when they disagree.  
> At the end of each session update the date above and the "Recent changes" section below.

---

## What the app is

KirokuMichi is a Japanese learning app (React 19 + TypeScript + Vite + Tailwind 4, sql.js SQLite WASM, Express AI/TTS proxy). Primary loop is **CEFR course + Anki-clone SRS + conversation practice** for A1–B2 (Genki I/II, Quartet I/II, Tobira, Marugoto).

**Product spine (keep this cohesive):**

| Surface | Role |
|---|---|
| Today `/study` | Action now: dues → resume lesson → new |
| Course `/learn` + `/learn/study` | Textbook curriculum + continuous lesson rail |
| Review `/study/srs` | Same FSRS/SM-2 stack the Cards step uses |
| Speak `/scenarios` | Roleplay; can satisfy Speak on the rail |
| Library | My Content, Immersion, AI Tutor, **JLPT drills** (optional), Settings |

C1 / authentic Japanese is out of beta scope (disabled in Course).

**Dev servers:**
```bash
cd app && npm run dev        # Vite on :5173 (or :5174 if busy)
npm run server               # Express AI/TTS proxy on :3001
```

**Verify everything:**
```bash
cd app && npm run verify
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind 4 |
| State | Zustand (persisted to localStorage; secrets scrubbed) |
| Storage | sql.js SQLite WASM → IndexedDB snapshot |
| SRS | FSRS + SM-2 (user-selectable) |
| AI | Express proxy → Anthropic / OpenAI / OpenRouter / DeepSeek / Ollama |
| TTS | Cloud only: Sarashina (default sidecar) or ElevenLabs — **never** `speechSynthesis` |
| i18n | react-intl (English catalogue only for now) |
| Tests | Vitest (unit) + Playwright (E2E) |
| Staging | Render blueprint (`render.yaml`) + optional Vercel SPA |

---

## Feature status

### Anki-clone SRS
- ✅ FSRS + SM-2 dual scheduler
- ✅ Suspend / bury, subdeck hierarchy, card browser, filtered decks, cram
- ✅ Stats, templates, user-created cards, provenance, Jisho lookup
- ✅ Anki `.apkg` import/export; Genki APKG lesson-linking
- ✅ Lesson-gated bundled Genki starter (full library import; only active lesson unsuspended)
- ✅ Undo last review (1-deep)

### Content & curriculum
- ✅ A1–B2 grammar bank + **100% Maynard bridge coverage** (641/641: 425 direct, 5 curated, 211 attached)
- ✅ **133 gold learner packs** (published index); earlier “54 packs” figure was an older extraction milestone
- ✅ **206 curated scenarios** (66 A1 / 62 A2 / 38 B1 / 40 B2)
- ✅ Supplemental scenario layer from workbook OCR
- ✅ Learner-facing content audit: `issueCount: 0` (`npm run textbook:learner:quality`)
- ⚠️ Published-pack soft warnings remain (~271: JP-in-gloss / OCR scars) — non-blocking
- ✅ Grammar interleaved in lesson teach; Maynard deep-explanation panel
- ⏳ Encrypted `.kiroku-pack` **pipeline** exists (`npm run packs:build`); built artifacts are gitignored and not currently checked in under `public/packs`

### Lesson & learning features
- ✅ Lesson rail: Intro → Teach → Check → Practice → Cards → Speak → Done
- ✅ Cards = real `ReviewSession` / FSRS; Speak requires production (or scenario Live Practice)
- ✅ Word selection into decks; textbook progress; AI Learning Path + CEFR stage gating
- ✅ Workbook practice tasks; scenario search / CEFR tabs

### AI & conversation
- ✅ Conversation Partner + ScenarioMode v2 (SSE)
- ✅ Mistake Review; save correction to SRS; chat persistence
- ✅ Pluggable cloud TTS (`/api/tts`) — Sarashina + ElevenLabs providers
- ❌ No browser TTS fallback (policy)
- ⏳ Sarashina sidecar still needs GPU + prompt WAV on a capable machine (`todo.md`)

### Dashboard & UX
- ✅ Today dashboard, smart CTA, streak / freeze, heatmap, keyboard shortcuts
- ✅ Mobile nav; Report Issue modal; ErrorBoundary / 404 / PWA bits

### Staging & infrastructure
- ✅ Beta invite gate, HttpOnly sessions, quotas, SSRF hardening, template sanitization
- ✅ CI verify workflow; Playwright smoke + lesson-rail gates
- ✅ `render.yaml` + staging checklist/scripts (TTS env aligned to Sarashina/ElevenLabs)
- ⏳ Live Render staging URL not stood up yet
- ⏳ Report sink needs `GITHUB_REPORT_*` on host

---

## Staging + user reporting

Prefer **Render** single-origin staging (`STAGING.md`). Set `BETA_INVITE_CODES` always on hosted envs.

Report Issue → `/api/report` → GitHub Issues when `GITHUB_REPORT_REPO` + `GITHUB_REPORT_TOKEN` are set; otherwise local log mode.

---

## Key file locations

| Area | Files |
|---|---|
| SRS service | `app/src/srs/srsService.ts` |
| DB schema + migrations | `app/src/db/schema.ts`, `app/src/db/migrations.ts` |
| Review session | `app/src/study/ReviewSession.tsx` |
| Dashboard / Review hub | `app/src/study/StudyDashboard.tsx`, `ReviewHub.tsx` |
| Lesson rail | `app/src/study/LessonStudy.tsx`, `lessonStudyPlanner.ts` |
| Maynard bridges | `app/src/content/maynardSupport.ts` |
| Cloud TTS client | `app/src/audio/cloudTts.ts`, `study/cardAudioPlayback.ts` |
| AI provider | `app/src/ai/aiProvider.ts`, `server/index.ts` |
| Store / routes | `app/src/store`, `App.tsx`, `appRoutes.ts` |
| E2E | `app/tests/` |
| Content tools | `app/tools/textbook-pack/` |

---

## Blocked / external

| Item | Resolution |
|---|---|
| Sarashina GPU sidecar | Capable machine + prompt WAV (`todo.md`) |
| Live staging | Render Blueprint + secrets |
| More textbook image crops | OCR-gap candidate pipeline + human review |
| Manual lesson OCR polish | Human review of soft warnings |
| C1 / N1 expansion | Future phase — out of A1–B2 beta |

---

## npm scripts reference

```bash
npm run dev                        # Vite
npm run server                     # Express proxy
npm run build                      # Production build
npm run verify                     # Full gate
npm run qa:routes                  # Playwright route smoke
npm run qa:lesson-rail             # Lesson rail gates
npm run textbook:learner:quality   # App-facing content audit
npm run textbook:learner:validate-published
npm run textbook:maynard:quality
npm run packs:build                # Encrypt proof JSONs → public/packs/*.kiroku-pack
npm run staging:validate-config
```

---

## Recent changes (2026-11-06 — cohesion pass)

- Documented a single product spine (Today → Course rail → Review → Speak; JLPT as optional Library drill).
- Reconciled pack/test/Maynard numbers with verified audits (133 gold, 297 unit, 90 Playwright, Maynard 641/641).
- Replaced stale Vite template `app/README.md`; pointed memory overview at this handoff.
- Removed obsolete Azure TTS env from `render.yaml` / staging env scripts; TTS env now matches Sarashina/ElevenLabs.
- Surfaced JLPT in Library nav with clear optional-drill framing; clarified C1 as out of beta scope in Course.

## Recent changes (2026-08-07)

- Lesson-gated Genki starter deck; pluggable Sarashina/ElevenLabs TTS; **never browser TTS**.
- Lesson rail / grading polish; onboarding finishes on Today.

## Historical note

Older entries mentioning Azure Nanami + Web Speech fallback are **superseded** by the cloud-only TTS policy (2026-08-07+).
