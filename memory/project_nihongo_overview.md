---
name: Nihongo Project Overview
description: Comprehensive spec for Japanese learning app architecture, tech stack, and 11-phase development plan
type: project
originSessionId: 1c4173c9-f9bf-4e26-b7f3-59bac68ed5e0
---
## Nihongo: Japanese Learning App

**Vision:** Open-source, web-first Japanese learning app with pregenerated curriculum, optional AI tutor, adaptive SRS (FSRS), and full offline capability for structured study.

## Core Design Principles

- **Web-first**: Launches as locally-hosted web app (Tauri desktop/Expo mobile deferred to post-v1)
- **Local-first**: SQLite WASM in browser, no accounts, all data on device
- **Pregenerated content**: All curriculum content (grammar, vocab, quizzes, audio) bundled at dev time — zero runtime token cost for structured study
- **AI-as-tutor**: AI is reactive (explains, responds to chat, gives feedback), NOT generative. Does not create curriculum content at runtime
- **Frequency-first pedagogy**: Highest-utility content taught first, subject to grammatical prerequisites
- **Provider-agnostic**: Swap AI provider, database, TTS, SRS algorithm via settings

## Content Architecture

**Two-layer separation:**

1. **Pregenerated content layer** (zero runtime cost):
   - ~300 grammar points (N5–N1) with explanations + 3–5 example sentences each
   - ~6,000 vocabulary items with 2–3 contextual example sentences
   - 20–30 quiz questions per grammar point
   - 200+ listening scripts with pre-cached audio
   - All kanji mnemonics, radical breakdowns from KanjiVG
   - Versioned in repo, improvable via PRs

2. **AI tutor layer** (runtime, token cost only when used):
   - Free conversation
   - Grammar explanations ("explain differently")
   - Correction and feedback on user-generated Japanese
   - Deep analysis of complex sentences
   - Keigo scenarios (reasoning tier)
   - Improvement algorithm / placement quiz (reasoning tier)
   - Most 30–60 min study sessions = zero API calls

## Tech Stack (v1 — Web Only)

**Frontend:** React + TypeScript, Vite, Tailwind CSS, react-intl (i18n)

**Database:** SQLite WASM (browser) via Drizzle ORM

**SRS Engine:** ts-fsrs (FSRS algorithm — 20–30% fewer reviews vs SM-2) + SM-2 fallback

**Segmentation:** Kuromoji.js (default) + JMdict compound override via SegmentationProvider interface

**Dictionary/Stroke data:** JMdict, KanjiVG (bundled)

**Audio:** Pre-cached curriculum audio + Web Speech API for dynamic content

**Backend:** Node + Express (localhost-only, 127.0.0.1 binding)
- Proxies AI API calls (API key never reaches browser)
- Runs improvement algorithm nightly (node-cron)
- Per-session token auth, CORS restricted to localhost

**AI layer:** Anthropic (fast tier = haiku, reasoning tier = sonnet) or Ollama (local), provider-agnostic via AIProvider interface

## Database (14 Tables)

Core tables: users, cards, card_states (FSRS params), sessions, mistake_logs, weak_point_summaries, assessments, daily_schedules, settings, events, questions, grammar_dependencies, prompt_templates, reports

Key fields:
- **card_states**: difficulty, stability, retrievability (FSRS), due, leech_count, is_leech
- **weak_point_summaries**: compressed key:value context (30–100 tokens by level), staleness_at
- **grammar_dependencies**: prerequisite graph (frequency can't override)
- **prompt_templates**: versioned (version, key, content, effective_date)

## Development Plan (11 Phases, ~8 months)

| Phase | Work | Duration |
|-------|------|----------|
| 1 | Scaffold + Infrastructure (React, Vite, SQLite WASM, Express, interfaces, unit tests, FSRS, SM-2, CI) | 2–3 weeks |
| 2 | Database + Content Pipeline (Drizzle schema, generation tool, N5 proof of concept) | 3–4 weeks |
| 3 | Onboarding (setup wizard, hiragana gate, placement quiz, goal setting, IME detection, E2E tests) | 2–3 weeks |
| 4 | SRS Engine + Writing (card browser, FSRS review UI, leech detection, self-check flow, KanjiVG animation, heatmap, Anki export) | 3–4 weeks |
| 5 | Full Content Generation (N4–N1 grammar, vocab, quizzes, TTS audio, quality review) | 3–4 weeks |
| 6 | JLPT Section (level picker, grammar lessons, vocab browser, simulated + practice tests, keigo section, quiz weighting) | 3–4 weeks |
| 7 | Natural Language + AI Tutor (free chat, correction panel, scenarios, JapaneseText with hover, sentence breakdown, 'explain differently') | 3–4 weeks |
| 8 | Audio + Listening (Web Speech API, pre-cached audio, listening section, pitch accent, mora-by-mora for survival Japanese) | 2–3 weeks |
| 9 | Improvement Algorithm (local scoring, nightly cron, staleness, summary generation, AI-enhanced analysis, prompt versioning) | 2–3 weeks |
| 10 | Immersion Mode + Textbook (warning screen, daily schedule, break reminders, accuracy monitoring, textbook adapter) | 2–3 weeks |
| 11 | Polish + Launch (font audit, offline indicators, session persistence, accessibility, progress sharing, contribution guide, privacy policy, final QA) | 2–3 weeks |

**Milestones:**
- Infrastructure + first content (Phases 1–2): Month 1–2
- Usable prototype (Phases 3–4): Month 3
- Full curriculum content (Phase 5): Month 4
- Core study experience (Phases 6–8): Month 5–6
- AI tutor + personalisation (Phase 9): Month 6–7
- Feature complete v1 (Phases 10–11): Month 7–8
- v1 public release: Month 8–9

## Token Cost Profile (Daily 30–45 min study session)

- SRS review (30 min): 0 API calls
- Grammar study with quizzes (30 min): 0 API calls (pregenerated)
- Listening practice (20 min): 0 API calls (pre-cached audio)
- Writing self-check (20 min): 0 API calls (local)
- Free conversation (15 min): 8–12 calls, ~2,000–4,000 tokens
- Explain differently: 1 call, ~200–500 tokens
- Improvement algorithm (nightly): 1 call, ~500–1,000 tokens (reasoning tier)

**Typical session uses zero API calls. AI tutor is optional.**

## Model Tier Routing

**Fast tier (haiku):** Free conversation, grammar Q&A, correction feedback, re-explanations

**Reasoning tier (sonnet):** Deep grammar analysis, keigo scenarios, improvement algorithm, placement assessment, goal feasibility

**Prompt caching:** System prompt + tutor context cached at ~10% cost on cache hit

## Weak-Point Summary Format

Compressed key:value context injected into AI tutor calls, scaled by level:
```
weak:te-form,passive,causative|kanji:先/週/間|strong:particles,N5-core|txt:Genki-ch9|lvl:N4|goal:N3-6m|mode:std
```
Budget: 30 tokens (N5) → 100 tokens (N2+)

## Content Progression (7 Tiers by Frequency)

0. Survival (~100 phrases) — pre-N5, requires hiragana reading
1. Core N5 (~300)
2. N5 + high-freq N4 (~800)
3. N4 + high-freq N3 (~1,500)
4. N3 + high-freq N2 (~2,500)
5. N2 + N1 by frequency (~4,000)
6. Low-frequency N1+ (remaining)

## Writing Practice (Self-Check Model)

1. TTS plays target word/character (pre-cached)
2. User writes on paper/tablet
3. User taps 'Show Answer'
4. KanjiVG animated stroke order plays as reveal
5. User self-rates: Again / Hard / Good / Easy
6. FSRS schedules next review

Future enhancement: Canvas-based handwriting recognition with TensorFlow.js (post-v1, non-breaking change to card type).

## Onboarding (Works Without AI)

1. AI provider (optional) — API key entry or Ollama or skip
2. Preferences — JLPT target, daily card limit, textbook, domain
3. Hiragana check — reading assessment (must pass before survival Japanese)
4. Placement quiz — 15–20 adaptive questions from pregenerated bank. AI generates per-skill breakdown (one reasoning call) or skip if no AI.
5. Goal setting — timeframe + AI feasibility report (or skip if no AI)

## Improvement Algorithm

Nightly node-cron job:
1. Queries mistake_logs and events
2. Groups errors by grammar point and kanji
3. Scores by recency and frequency
4. Generates weak_point_summaries row (if AI available, uses reasoning tier for richer analysis)

**Staleness handling:** If > 48 hours old, regenerate on next session start.

**Drives:** Quiz selection weighting, SRS weak-point queues, study plan adjustments (immersion mode).

## Immersion Mode (Opt-in)

4–6 hours daily, 4–12 week sprints. Daily block structure:
- Morning warm-up (SRS reviews) — 20–30 min, no API
- Grammar focus (JLPT drills) — 45–60 min, no API
- Conversation practice — 30–45 min, AI tutor
- Vocabulary deep dive — 45–60 min, no API
- Afternoon review — 30 min, no API
- Listening / reading — 45–60 min, no API
- Evening consolidation — 20–30 min, no API

6 of 7 blocks require zero API calls.

Safeguards: 90-min break reminders, accuracy drop 15%+ over 3 days → fatigue warning, 2 consecutive missed sessions → option to step down to standard mode.

## Security Model

**API key storage:**
- v1 (web): Entered in settings, stored in browser, sent only to local Express proxy
- v1.x (desktop/Tauri): OS keychain (macOS Keychain, Windows Credential Manager, Linux libsecret)
- v2 (mobile/Expo): expo-secure-store

**Backend security:**
- Binds 127.0.0.1 only (never 0.0.0.0)
- Per-session token auth
- CORS restricted to localhost origins
- Graceful failure: if Express cannot start, app works offline with pregenerated content

**Prompt injection defence:**
- User input always in user message role (never interpolated into system prompts)
- All user-generated content treated as untrusted
- Community-contributed questions require security review before activation

## Provider Interfaces (Enable Swapping)

- **StorageProvider**: SQLite WASM (v1) → better-sqlite3, expo-sqlite, Supabase/Postgres (future)
- **AIProvider**: Anthropic (v1) → Ollama, OpenAI, Gemini
- **TTSProvider**: Web Speech API + pre-cached audio (v1) → VOICEVOX sidecar, expo-speech, Cloud TTS
- **SchedulerProvider**: FSRS (default) → SM-2
- **SegmentationProvider**: Kuromoji + JMdict override (v1) → SudachiJS
- **KeyStorageProvider**: Browser localStorage (v1) → Tauri keychain, expo-secure-store
- **STTProvider**: Not implemented (future for live voice conversation)

## Post-v1 Roadmap

- **v1.x**: Tauri desktop wrapper (OS keychain, VOICEVOX sidecar, better-sqlite3), Supabase cloud sync
- **v2**: Expo mobile wrapper (iOS/Android, expo-sqlite, expo-secure-store)
- **v2.x**: Canvas handwriting recognition (TensorFlow.js for kana + N5/N4 kanji)
- **v3**: Live AI voice conversation (STT + streaming AI responses), Community hub (shared decks, leaderboards)

## Open Source

- **Licence**: MIT (code), CC BY-SA (community content + pregenerated content corrections)
- **Contributors**: Content corrections via PR to /content; new provider adapters; translations; platform wrappers
- **Data**: KanjiVG, JMdict, BCCWJ frequency corpus — all open licensed
- **Privacy**: Local-only data handling, no telemetry, no multi-user auth

## Key Constants

- HOVER_DEFINITION_DELAY_MS: 2000ms (N5–N4), 1500ms (N3–N2), 1000ms (N1)
- LEECH_THRESHOLD: 8 Again ratings before suspension
- LEVEL_TRANSITION_WEEKS: 2 weeks at reduced new-card rate
- LEVEL_TRANSITION_ACCURACY: 75% accuracy to end transition early
- WEAK_POINT_STALENESS_HOURS: 48 hours before regeneration
- QUIZ_POOL_SIZE: 20–30 questions per grammar point
- WEAK_POINT_CONTEXT_BUDGET: 30–100 tokens by level (N5 to N2+)

## Key Design Decisions

1. **Pregenerated content first**: Zero runtime token cost for structured study, auditable content, full offline capability
2. **AI is reactive, not generative**: Explains existing content, responds to user input, improves based on weak points — but does not create curriculum
3. **Local improvement algorithm**: Works offline, generates weak-point summary from local data, drives quiz weighting and AI context
4. **Writing self-check over handwriting recognition**: v1 uses paper + KanjiVG reveal + self-rating. Canvas OCR deferred to v2.x as non-breaking enhancement.
5. **Web-first, platform-agnostic backend**: React app is canonical; Tauri/Expo wrap it with platform-specific features (keychain, native storage) behind provider interfaces
6. **Localhost-only Express**: No cloud backend, no account auth, API keys proxied for browser safety

## Project Status

**Phases 1–3 complete. Ready to start Phase 4.**

### Phase 1 — Complete
- Vite + React + TypeScript + Tailwind scaffolded in `app/`
- FSRS and SM-2 scheduler implementations (`src/core/`)
- SQLite WASM StorageProvider with localStorage persistence
- Express AI proxy server (`server/`)
- Zustand store with persisted settings
- react-intl i18n with English catalogue
- All tests passing

### Phase 2 — Complete
- Full Drizzle ORM SQLite schema (14 tables)
- SQL migration runner
- AI content generation pipeline

### Phase 3 — Complete
- Full onboarding flow: Welcome → AI setup → Prefs → Hiragana → Katakana → (Kana Learning placeholder) → Placement → Goal → IME
- Kana quiz (`StepKana`) with 46-character hiragana/katakana sets, row selection, Enter key advance, incorrect answer display
- Adaptive CEFR placement quiz (`StepPlacement`): 17 tiers (A1-early → C2-late), 126 conversational questions, 3-correct-advance / 2-wrong-stop logic
- Furigana reading hints shown on A1/A2 levels only, hidden on B1+
- CEFR→JLPT mapping for SRS integration (A1→N5, A2→N4, B1→N3, B2→N2, C1/C2→N1)
- Result screen shows both CEFR and approximate JLPT level with manual override
- 40 tests passing, zero type errors

### Phase 4 — Not started
SRS Engine + Writing Practice (see plan file for full spec)
