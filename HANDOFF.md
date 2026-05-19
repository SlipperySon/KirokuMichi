# KirokuMichi — Handoff Document

**Last updated: 2026-05-19**
**Status: ✅ FEATURE COMPLETE — ready for staging**

> At the end of each session update the date above and the "Recent changes" section below.

---

## What the app is

KirokuMichi is a Japanese learning app (React 19 + TypeScript + Vite + Tailwind 4, sql.js SQLite WASM, Express AI proxy). It covers A1–B2 (Genki I/II, Quartet I/II, Tobira, Marugoto) with a full Anki-clone SRS review system, AI conversation partner, scenario practice, and textbook content.

**Dev servers:**
```bash
cd app && npm run dev        # Vite on :5173 (or :5174 if busy)
node server/index.js         # Express AI proxy on :3001
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
| State | Zustand (persisted to localStorage) |
| Storage | sql.js SQLite WASM (persisted to localStorage as base64) |
| SRS | FSRS + SM-2 schedulers (user-selectable) |
| AI | Express proxy → Anthropic API (Claude); streaming SSE |
| i18n | react-intl |
| Tests | Vitest (unit) + Playwright (E2E) |
| Build | Vite with code splitting; ~32 kB main chunk |

---

## Feature status

### Anki-clone SRS
- ✅ FSRS + SM-2 dual scheduler
- ✅ Suspend / bury mechanics (`suspended_at` / `buried_until`)
- ✅ Subdeck hierarchy (`decks` table, DeckTree UI, activeDeckId filtering)
- ✅ Card browser (`/study/browser` — sort, filter, preview, edit, bulk actions)
- ✅ Filtered decks (query parser: `is:due`, `is:new`, `deck:Name`, free text)
- ✅ Cram mode (scheduling bypassed, amber banner)
- ✅ Stats & graphs (`/study/stats` — 7d/30d/all-time, retention, distribution)
- ✅ Card templates (deck-scoped `{{field}}` editor at `/study/templates`)
- ✅ User-created cards (`/study/create` — front/back/reading/deck/tags/note/audio)
- ✅ Personalized notes — editable in CardBrowser + inline during review (sticky note panel on back phase)
- ✅ Card provenance metadata (`origin_type` / `origin_ref` on all cards)
- ✅ Jisho lookup — card ⋯ menu in review + external-link button in CardBrowser preview
- ✅ Anki `.apkg` import — Kaishi 1.5k + generic decks, 40 unit tests
- ✅ Anki export
- ✅ Undo last review (1-deep stack, Ctrl+Z)

### Content & curriculum
- ✅ A1–B2 grammar: 746 CEFR entries, 100% Maynard bridge coverage (637/637; 353 direct, 73 curated, 211 attached)
- ✅ 54 lesson packs across Genki I/II, Quartet I/II, Tobira, Marugoto A1/A2/B1
- ✅ 206 curated scenarios (66 A1, 62 A2, 38 B1, 40 B2)
- ✅ Supplemental scenario layer (Genki/Marugoto/Quartet/Tobira workbook OCR cleaned)
- ✅ Vocab data quality: `unresolvedSuspicious: 0`
- ✅ Learner-facing OCR quality: `issueCount: 0` (`npm run textbook:learner:quality`)
- ✅ Grammar interleaved with vocab in lesson teach flow (`interleaveItems()`)
- ✅ Maynard deep-explanation panel in lesson teach (direct page refs + curated fallbacks)

### Lesson & learning features
- ✅ Lesson teach flow: predict → reveal → hook → micro-practice → self-rate → checkpoint → mixed review → summary
- ✅ Word selection in lessons ("+ Add to deck" on vocab cards; `lesson_vocabulary` + provenance stored)
- ✅ Textbook progress panel in LessonsHub (linked-deck stats + lesson completion bars)
- ✅ AI Learning Path Generator (`/study/path` — 4-week CEFR roadmap with stage gate)
- ✅ CEFR stage gating (`inferCefrStageGate` — lesson completion + retention thresholds)
- ✅ Scenario search, CEFR/textbook tabs, keyboard help modal (?)
- ✅ Workbook practice tasks in lesson flow

### AI & conversation
- ✅ Conversation Partner Mode (live AI roleplay, streaming SSE, corrections)
- ✅ ScenarioMode v2 (live AI chat panel seeded with scenario context)
- ✅ Mistake Review Mode (drill recent mistakes, log to SRS)
- ✅ Save correction to SRS
- ✅ Conversation persistence (localStorage per-chat)
- ✅ TTS fallback (Web Speech API; Japanese voice selection)

### Dashboard & UX
- ✅ Two-column dashboard: action-now left, overview right
- ✅ Smart CTA (Continue Learning / Review Due / Start Lesson based on state)
- ✅ Daily goal ring + streak freeze tokens
- ✅ Heatmap, weekly goal bar, due/new tiles
- ✅ Quick preview cards (3 due card fronts below Review button)
- ✅ Weak point panel, post-lesson drill CTA
- ✅ Session celebration toasts (streak milestone, daily goal, card count)
- ✅ Keyboard shortcuts with rebind UI + localStorage persistence

### Content upload & textbook detection
- ✅ Known Textbooks Panel (filename confidence detection, deck linking, auto-unlock)
- ✅ Non-mapped PDF routing ("Custom / unmapped PDF" fallback with saved overrides)
- ✅ Hybrid confidence scoring (`textbookDetection.ts`)
- ✅ Anki import UX: spinner, detailed success/error/unlock toasts

### Staging & infrastructure
- ✅ ErrorBoundary, 404 page, animated spinners
- ✅ OG meta tags, PWA manifest, `/api/health`, README
- ✅ Mobile burger nav, responsive audit (390px no-overflow)
- ✅ Toast / Skeleton / EmptyState components wired across all surfaces
- ✅ Code splitting: ~32 kB main chunk, lazy routes for JLPT/SRS/PDF/grammar
- ✅ CI: `.github/workflows/verify.yml` (lint → tsc → vitest → playwright → build → content audits)
- ✅ E2E tests: 15 Playwright specs (card create, browser, deck mgmt, scenarios, custom fields)
- ✅ Route smoke: desktop + mobile, 16 checks (`npm run qa:routes`)

---

## Key file locations

| Area | Files |
|---|---|
| SRS service | `app/src/srs/srsService.ts` |
| DB schema + migrations | `app/src/db/schema.ts`, `app/src/db/migrations.ts` |
| Review session | `app/src/study/ReviewSession.tsx` |
| Dashboard | `app/src/study/StudyDashboard.tsx` |
| Lesson teach flow | `app/src/study/LessonStudy.tsx`, `app/src/study/lessonStudyPlanner.ts` |
| Maynard bridges | `app/src/content/maynardSupport.ts` |
| Textbook detection | `app/src/content/textbookDetection.ts` |
| AI provider | `app/src/ai/aiProvider.ts`, `server/index.js` |
| Store | `app/src/store.ts` |
| Routes | `app/src/App.tsx` |
| E2E tests | `app/tests/` |
| Content tools | `app/tools/textbook-pack/` |

---

## Blocked / external dependencies

| Item | Resolution |
|---|---|
| More textbook image crops | Rerun `npm run textbook:assets:manifest` when extraction agent produces crops |
| Maynard direct refs (73 curated bridges) | Rerun `npm run textbook:maynard:direct-refs` when cleaned extraction/alias data lands; use `commonCuratedBridges` report as target |
| 54 lesson pack manual corrections | Human review only |
| C1/N1 expansion | Future phase — out of current A1–B2 scope |
| Specialized Textbook Pack Pipeline | Large project (8–15h); OCR pipeline + AES-GCM unlock flow for Genki/Quartet |

---

## npm scripts reference

```bash
npm run dev                        # Vite dev server
npm run build                      # Production build
npm run verify                     # Full gate: lint + tsc + vitest + playwright + build + audits
npm run test                       # Vitest unit tests
npm run qa:routes                  # Playwright route smoke (desktop + mobile)
npm run textbook:learner:quality   # App-facing content audit (vocab/grammar/tasks/scenarios)
npm run textbook:maynard:quality   # Maynard coverage report
npm run textbook:assets:manifest   # Rebuild textbook image asset manifest
npm run textbook:maynard:direct-refs  # Regenerate Maynard direct refs from extraction data
```
