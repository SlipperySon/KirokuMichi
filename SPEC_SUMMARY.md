# Nihongo: Japanese Learning App — Spec Summary

## Vision
Open-source, web-first Japanese learning app with pregenerated curriculum, optional AI tutor, adaptive SRS (FSRS), and full offline capability for structured study.

## Core Design Principles

- **Web-first**: Launches as locally-hosted web app (Tauri desktop/Expo mobile deferred to post-v1)
- **Local-first**: SQLite WASM in browser, no accounts, all data on device
- **Pregenerated content**: All curriculum content (grammar, vocab, quizzes, audio) bundled at dev time — zero runtime token cost for structured study
- **AI-as-tutor**: AI is reactive (explains, responds to chat, gives feedback), NOT generative. Does not create curriculum content at runtime
- **Frequency-first pedagogy**: Highest-utility content taught first, subject to grammatical prerequisites
- **Provider-agnostic**: Swap AI provider, database, TTS, SRS algorithm via settings

## Content Architecture: Two-Layer Separation

### Pregenerated Content Layer (Zero Runtime Cost)
- ~300 grammar points (N5–N1) with explanations + 3–5 example sentences each
- ~6,000 vocabulary items with 2–3 contextual example sentences
- 20–30 quiz questions per grammar point
- 200+ listening scripts with pre-cached audio
- All kanji mnemonics, radical breakdowns from KanjiVG
- Versioned in repo, improvable via PRs

### AI Tutor Layer (Runtime, Token Cost Only When Used)
- Free conversation
- Grammar explanations ("explain differently")
- Correction and feedback on user-generated Japanese
- Deep analysis of complex sentences
- Keigo scenarios (reasoning tier)
- Improvement algorithm / placement quiz (reasoning tier)
- **Most 30–60 min study sessions = zero API calls**

## Tech Stack (v1 — Web Only)

| Component | Technology |
|-----------|-----------|
| **Frontend** | React + TypeScript, Vite, Tailwind CSS, react-intl (i18n) |
| **Database** | SQLite WASM (browser) via Drizzle ORM |
| **SRS Engine** | ts-fsrs (FSRS algorithm) + SM-2 fallback |
| **Segmentation** | Kuromoji.js (default) + JMdict compound override via SegmentationProvider interface |
| **Dictionary/Stroke** | JMdict, KanjiVG (bundled) |
| **Audio** | Pre-cached curriculum audio + Web Speech API for dynamic content |
| **Backend** | Node + Express (localhost-only, 127.0.0.1 binding) |
| **AI Layer** | Anthropic (fast tier = haiku, reasoning tier = sonnet) or Ollama (local) |

## Database Schema (14 Tables)

**Core tables:** users, cards, card_states (FSRS params), sessions, mistake_logs, weak_point_summaries, assessments, daily_schedules, settings, events, questions, grammar_dependencies, prompt_templates, reports

**Key fields:**
- **card_states**: difficulty, stability, retrievability (FSRS), due, leech_count, is_leech
- **weak_point_summaries**: compressed key:value context (30–100 tokens by level), staleness_at
- **grammar_dependencies**: prerequisite graph (frequency can't override)
- **prompt_templates**: versioned (version, key, content, effective_date)

## Token Cost Profile (Daily 30–45 min Study Session)

| Activity | API Calls | Tokens | Notes |
|----------|-----------|--------|-------|
| SRS review (30 min) | 0 | 0 | Entirely local |
| Grammar study with quizzes (30 min) | 0 | 0 | Pregenerated content |
| Listening practice (20 min) | 0 | 0 | Pre-cached audio |
| Writing self-check (20 min) | 0 | 0 | Local KanjiVG animations |
| Free conversation (15 min) | 8–12 | ~2,000–4,000 | AI tutor responses |
| 'Explain differently' (single) | 1 | ~200–500 | Alternative framing |
| Improvement algorithm (nightly) | 1 | ~500–1,000 | Reasoning tier |

**Typical session uses zero API calls. AI tutor is optional.**

## Model Tier Routing

**Fast tier (haiku):** Free conversation, grammar Q&A, correction feedback, re-explanations

**Reasoning tier (sonnet):** Deep grammar analysis, keigo scenarios, improvement algorithm, placement assessment, goal feasibility

**Prompt caching:** System prompt + tutor context cached at ~10% cost on cache hit

## Weak-Point Summary Format

Compressed key:value context injected into AI tutor calls:
```
weak:te-form,passive,causative|kanji:先/週/間|strong:particles,N5-core|txt:Genki-ch9|lvl:N4|goal:N3-6m|mode:std
```
Budget: 30 tokens (N5) → 100 tokens (N2+)

## Content Progression (7 Tiers by Frequency)

| Tier | Items | Description |
|------|-------|-------------|
| 0 — Survival | ~100 | Pre-N5, requires hiragana reading, mora-by-mora audio |
| 1 — Core N5 | ~300 | Highest-frequency N5 vocabulary and basic grammar |
| 2 — N5 + high-freq N4 | ~800 | Remaining N5 plus most common N4 |
| 3 — N4 + high-freq N3 | ~1,500 | Bridge level — everyday communication |
| 4 — N3 + high-freq N2 | ~2,500 | Near-fluency reading and listening |
| 5 — N2 + N1 by frequency | ~4,000 | Professional and academic range |
| 6 — Low-frequency N1+ | Remaining | Rare vocabulary, literary, specialist |

## Writing Practice (Self-Check Model)

1. TTS plays target word/character (pre-cached)
2. User writes on paper/tablet
3. User taps 'Show Answer'
4. KanjiVG animated stroke order plays as reveal
5. User self-rates: Again / Hard / Good / Easy
6. FSRS schedules next review

**Future enhancement (v2.x):** Canvas-based handwriting recognition with TensorFlow.js (non-breaking change to card type).

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

4–6 hours daily, 4–12 week sprints. **6 of 7 daily blocks require zero API calls.**

Daily block structure:
- Morning warm-up (SRS reviews) — 20–30 min, no API
- Grammar focus (JLPT drills) — 45–60 min, no API
- Conversation practice — 30–45 min, AI tutor
- Vocabulary deep dive — 45–60 min, no API
- Afternoon review — 30 min, no API
- Listening / reading — 45–60 min, no API
- Evening consolidation — 20–30 min, no API

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

| Interface | v1 | Future |
|-----------|-------|--------|
| **StorageProvider** | SQLite WASM | better-sqlite3, expo-sqlite, Supabase/Postgres |
| **AIProvider** | Anthropic | Ollama, OpenAI, Gemini |
| **TTSProvider** | Web Speech API + pre-cached audio | VOICEVOX sidecar, expo-speech, Cloud TTS |
| **SchedulerProvider** | FSRS (default) | SM-2 |
| **SegmentationProvider** | Kuromoji + JMdict override | SudachiJS |
| **KeyStorageProvider** | Browser localStorage | Tauri keychain, expo-secure-store |
| **STTProvider** | Not implemented | Web Speech API, Whisper.js |

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
