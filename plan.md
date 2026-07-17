# KirokuMichi — Current State & Active Roadmap

Last updated: 2026-07-17 AEST

---

## Active Priority — Learning Environment Redesign

**Goal:** Turn parallel study modes into one teachable loop so a learner always knows *what to do next* and each
lesson closes with **evidence-based** retrieval + spaced review + production — not a dead-end summary.

**Visual summary:** open the canvas
[`learning-env-redesign.canvas.tsx`](/Users/Skipp/.cursor/projects/Users-Skipp-Projects-KirokuMichi/canvases/learning-env-redesign.canvas.tsx)
beside chat.

**Prior work (kept):** `studyPathPlanner` + Today’s Path panel are shipped. This redesign *uses* that planner;
it does not replace it with AI prose parsing. FSRS remains the spacing engine (already aligned with spaced-practice research).

**Non-negotiable:** Product decisions in this redesign must map to the Learning Science Foundation below.
If a UX shortcut conflicts with a principle (e.g. mark complete without retrieval), the principle wins.

---

### Learning Science Foundation

Design is anchored in cognitive psychology and instructed second-language acquisition (ISLA), not feature parity
with other apps. Primary claims and how they constrain KirokuMichi:

| Principle | Evidence base (representative) | Product constraint |
|-----------|--------------------------------|--------------------|
| **Retrieval practice (testing effect)** | Roediger & Karpicke (2006); Karpicke & Roediger (2008) | After encoding, learners must *attempt recall* before seeing answers. Passive “reveal + self-rate” alone is insufficient for durable learning. |
| **Spaced / distributed practice** | Cepeda et al. (2006); spacing literature; FSRS/SM-2 practice | Clear **due reviews before new lesson massing** when due load is material. Encode → same-day retrieval → expanding intervals via SRS. |
| **Successive relearning to criterion** | Rawson & Dunlosky (2011+) | A lesson is not “done” after one exposure. Weak/missed items re-enter a short retrieval set (Review N) before completion. |
| **Desirable difficulties / generation** | Bjork; Slamecka & Graf (generation effect) | Keep **predict-before-reveal** on teach cards. Prefer cued recall over pure recognition when feasible. |
| **Interleaving** | Rohrer & Taylor; Pan et al. | Interleave vocab + grammar in teach chunks (already in `interleaveItems`). Mix card faces in review; avoid long runs of identical prompt types. |
| **Limited working memory / chunking** | Cowan; instructional design chunking | Keep teach sets small (`CHUNK_SIZE ≈ 5`). Intro stays short; don’t dump the full LessonPage reference corpus at session start. |
| **Scaffolding → fading** | Wood et al.; ISLA task sequencing | Guided drills → free workbook output → scenario production. Do not jump to open AI chat before form focus. |
| **Declarative → procedural (SAT)** | DeKeyser Skill Acquisition Theory | Explain/notice form (Maynard) → controlled practice → communicative use. Scenarios come *after* Check/Practice, not instead of them. |
| **Pushed output** | Swain Output Hypothesis; Izumi | Production (workbook + scenario) is required for noticing gaps. Tap-through dialogue without a production prompt is weak. |
| **Focus on form** | Long; Ellis | Brief, timely form attention inside meaning-bearing tasks — Maynard deep dives on grammar teach items, not a separate unexplained grammar silo. |
| **Transfer-appropriate practice** | Morris et al.; L2 task research | Recognition MCQ ≠ speaking/writing skill. Session must include at least one productive step matching the day’s goal (typed output and/or scenario). |
| **Corrective feedback** | Lyster & Ranta; ISLA CF meta-analyses | Prefer immediate correctness feedback on Check steps; for free output, at least self-check support now, tutor/rubric feedback later — never “Mark Done” with zero reflection prompt. |

#### Research-aligned session architecture

**Lesson session (encoding → retrieval → production):**

```
Intro (orient, activate goals)
  → Teach (generate/predict → explain → brief form focus)     [encoding + generation]
  → Check (retrieval with feedback; mix item types)          [testing effect]
  → Practice (guided → free output)                          [scaffolding → fading]
  → Review N (cued recall of weak + new; schedule into FSRS) [successive relearning + spacing start]
  → Speak (pushed output in context)                         [output / transfer]
  → Done (only after Review N attempted or explicitly deferred with due scheduling)
```

**Daily session (spacing protects new learning):**

1. Resume unfinished session (avoid incomplete encoding)
2. **Due retrieval first** when `dueCount` is material (distributed practice > cramming new lessons)
3. Continue active lesson mid-flow
4. Start next path lesson (full loop above)
5. Production if lesson just completed and Speak not done
6. Free browse only when caught up

This matches the existing `getStudyPathAction` priority order (recovery → due review → current lesson → path lesson …) and
**must stay that way** unless evidence for a different ordering is documented.

#### Where the current app conflicts with evidence

| Current behavior | Why it’s weak scientifically | Fix in this redesign |
|------------------|------------------------------|----------------------|
| Teach ends in self-rate without scheduled retrieval | Little spacing; ratings ≠ memory strength | Mandatory Review N + FSRS seed |
| Lesson complete via card browse or overview checkbox | Completion ≠ learning criterion | Single Done after retrieval/production gates |
| Grammar SRS separate from word review | Extra context-switching; weaker interleaving of form+lexis | Unified Review entry; interleaved queues over time |
| Scenario unlock with no in-loop CTA | Output delayed/skipped → less noticing | Speak step inside lesson session |
| MCQ-only checkpoints | Recognition < cued recall for many vocabulary goals | Keep MCQ for speed checks; Review N uses SRS card faces (reading/meaning recall) |
| Onboarding → empty Home | No successful first retrieval cycle | First lesson + starter cards so spacing can begin day 1 |

#### Explicit non-goals (not “science-washing”)

- We do **not** claim Krashen-only “input is enough”; output and retrieval are first-class.
- We do **not** optimize for engagement metrics that increase massed cramming (e.g. infinite new cards before dues).
- We do **not** replace FSRS intervals with arbitrary “streak” pressure; streaks are motivational chrome only.

---

### Phase 0 — Documentation Discovery (complete 2026-07-17)

#### Allowed APIs / patterns (copy from these, do not invent)

| Concern | Source | Reuse |
|---------|--------|-------|
| Next daily action | `app/src/study/studyPathPlanner.ts` — `getStudyPathAction`, `lessonRouteFromId` | Extend kinds; keep priority model |
| Lesson step builder | `app/src/study/lessonStudyPlanner.ts` — `buildLessonPlan`, `LessonStep` | Add intro / post-retrieve steps |
| CEFR lesson assignment | `app/src/study/lessonSequencer.ts` — `assignLessonsToWeeks` | Keep; make UI launch lessons |
| Active lesson state | `app/src/store/index.ts` — `currentLesson`, `setCurrentLesson` | **Must call** from LessonStudy start |
| Lesson → cards | `SRSService.getCardsForLesson`, `createUserCard`, `unlockCardsForLesson` | Seed queue after teach |
| Grammar SRS | `SRSService.getGrammarQueue` / `reviewGrammar` | Merge into unified Review |
| Workbook tasks | `workbookPracticeService.getWorkbookPracticeTasks` | Keep as Practice step |
| Scenario unlock | `scenarioUnlockService` + `LessonPage` mark-complete | Trigger from single completion path |
| Nav structure | `app/src/components/Navigation.tsx` | Collapse to five pillars |
| Routes | `app/src/App.tsx` | Prefer redirects over duplicate hubs |

#### Anti-patterns (do not do)

- Do not invent a second “today” planner that parses Learning Path `activities[]` prose.
- Do not add a sixth top-level mode (keep tools under Library / Review).
- Do not mark a lesson complete from card review alone (`ReviewSession.tsx` today does this — remove).
- Do not route path CTAs to LessonPage overview when the intent is “study now” — go to `/learn/study` with state.
- Do not leave `setCurrentLesson` unused (currently zero call sites outside the store).
- Do not treat Writing / grammar fill-blank as live until wired in `useReviewSession.resolveVariant`.
- Do not let “Mark Done” on workbook stand in for retrieval practice or corrective feedback.
- Do not prioritize new lesson content over a material due-review backlog (violates spaced practice).
- Do not unlock or push open AI chat as the *first* activity of a new grammar point (violates scaffolding → fading).

#### Audit verdict (why this plan exists)

1. **Strong pieces, weak wiring** — LessonStudy teach cards and FSRS work; handoffs between them do not.
2. **Fragmented IA** — Home/Learn/Lessons/Path/Review/Grammar/Scenarios compete; Home and Review share `/study`.
3. **Open teaching loop** — teach → check → workbook ends without auto SRS or scenario; onboarding never starts a lesson.
4. **Muddy completion** — LessonPage, LessonStudy, and ReviewSession can each mark complete differently.
5. **Evidence gaps** — self-rate without scheduled retrieval; recognition-heavy checks; production optional/out of band.

---

### Proposed layout (product IA)

| Pillar | Route (target) | Job | Science role |
|--------|----------------|-----|--------------|
| **Today** | `/study` | One primary CTA from `getStudyPathAction`; daily goal | Spacing gate + session orchestration |
| **Course** | `/learn` (single hub) | Textbook progress + CEFR curriculum; active lesson | Encoding + guided practice (declarative → controlled) |
| **Review** | `/study/review` entry from Today / Course | Unified due queue: words + grammar | Retrieval practice + distributed practice |
| **Speak** | `/scenarios` | Scenarios filtered/highlighted by last completed / current lesson | Pushed output + transfer |
| **Library** | `/my-content`, `/study/path`, Settings, AI Tutor | Import, path generation, immersion, power tools | Materials / metacognitive planning |

**Lesson session shape (Course)** — see Learning Science Foundation:

```
Intro → Teach → Check → Practice → Review N cards → Speak CTA → Done
```

- Intro: goals + target vocab/grammar (short; activate prior knowledge; no full reference dump).
- Teach: keep predict → reveal → form focus (generation + focus on form). Maynard stays on grammar items.
- Check: retrieval with immediate correctness feedback; interleaved item types.
- Practice: guided → free workbook output (scaffolding → fading); require a brief self-check prompt before Done.
- Review N: cued-recall SRS faces for weak + new lesson items; **schedules** into FSRS (successive relearning + spacing).
- Speak: one contextual production task for this lesson’s targets.
- Done: **only** after Review N ran (or items were scheduled due soon with an explicit “review later today” that still creates due pressure). Advances `currentLesson`.

**Daily session shape (Today)** — due retrieval before new encoding:

1. Resume unfinished session  
2. Clear due reviews (unified words + grammar) when due load is material  
3. Continue `currentLesson` mid-flow  
4. Start next path lesson → full lesson loop  
5. Production prompt if Speak skipped after last completion  
6. Free study only when caught up  

---

### Phase 1 — Close the loop (highest leverage)

**Science drivers:** retrieval practice, successive relearning, spaced practice handoff into FSRS.

**What to implement**

1. Call `setCurrentLesson(lessonId)` when LessonStudy starts; clear or advance on Done.
2. After LessonStudy Check/Practice (required step, not optional footer), seed/open a lesson card review:
   - Prefer `getCardsForLesson`; for missing cards batch-create from weak + new teach items (`createUserCard` / existing AddToDeck patterns).
   - Map teach `again` / quiz misses into the Review N set first (criterion relearning).
   - Navigate with the same router state shape `ReviewSession` already expects (`queue`, `sessionId`, `userId`).
3. Single completion rule: remove `markLessonComplete` from bare card review; Done requires Review N attempt (or explicit defer that still schedules items due).
4. Fix `TextbookProgress` “Study Now” to pass a real review queue (copy pattern from `LessonPage` “Study These Cards”).
5. Extend `getStudyPathAction` so `current-lesson` / `path-lesson` routes prefer `/learn/study` when session state can be built, else LessonPage with auto-start intent. **Keep due-before-new priority.**
6. Make Learning Path week `lessons[]` clickable → start that lesson.

**Docs / copy sources**

- `studyPathPlanner.ts` priority block (~L60–152)
- `LessonPage.tsx` review navigation with queue state (~Study These Cards)
- `LessonStudy.tsx` summary CTAs
- `store/index.ts` `setCurrentLesson` / `markLessonComplete`

**Verification**

- [ ] Grep: `setCurrentLesson(` has call sites outside `store/index.ts`
- [ ] Unit: `studyPathPlanner` “continue lesson” case with real store-driven input
- [ ] Manual: Start lesson → finish → review queue opens with N cards → FSRS states update → Done marks complete once
- [ ] Manual: TextbookProgress Study Now shows cards, not blank review
- [ ] Learning Path lesson chip navigates into study flow
- [ ] Science check: no lesson marked complete without a retrieval attempt or scheduled due set

**Anti-pattern guards**

- Do not persist lesson plan only in ephemeral `location.state` long-term without a recovery path (refresh today loses LessonStudy — acceptable short-term if Phase 3 adds session persistence).
- Do not treat honor-system workbook “Done” as satisfying the Review N gate.

---

### Phase 2 — Simplify information architecture

**Science drivers:** reduce extraneous cognitive load (Sweller CLT); interleave form+lexis in one Review habit.

**What to implement**

1. Rewrite `Navigation.tsx` groups to Today / Course / Review / Speak / Library (labels can stay localized later).
2. Collapse duplicate hubs: `/learn/lessons` → redirect to `/learn`; remove Home’s dual Learn + Lessons CTAs.
3. Slim StudyDashboard: hero = Today’s Path only; secondary = streak/goal; tuck card workspace under Review/Library.
4. Surface grammar due inside Review entry (interleave or single “Start Review” that covers both) so learners are not taught “two review apps”.
5. Keep AI Tutor under Library (or Speak submenu) — not a peer of Today/Course; never the default first step for new forms.

**Docs / copy sources**

- `Navigation.tsx` `navGroups`
- `StudyDashboard.tsx` action grids
- `LearningMode.tsx` tabs (Study by Lesson vs Browse — Browse becomes Library/My Content or a Course sub-tab)

**Verification**

- [ ] Route smoke / Playwright: critical paths still resolve
- [ ] No nav item labeled both Home and Review pointing at the same URL with different meaning
- [ ] `/learn/lessons` redirects; LessonsHub reachable once
- [ ] Science check: one primary retrieval entry point for due words + grammar

**Anti-pattern guards**

- Do not delete LessonPage; demote it to reference / resume hub under Course.

---

### Phase 3 — Lesson session redesign

**Science drivers:** generation, testing effect, scaffolding→fading, pushed output, transfer-appropriate practice.

**What to implement**

1. Extend `LessonStep` (or wrap `buildLessonPlan`) with `intro`, `retrieve`, and `speak` steps aligned to the science session architecture.
2. Intro card: 3–5 bullet goals from curriculum vocab/grammar counts + Maynard availability (orient; activate prior knowledge).
3. Strengthen Check toward retrieval: keep fast MCQ for throughput, but ensure Review N uses SRS **recall** faces (reading/meaning), not only recognition.
4. Practice: order guided → output; add a minimal reflection/self-check cue before leaving workbook (feedback principle; full AI grading later).
5. After Practice: Review N builds queue → `ReviewSession` with `returnTo: lessonDone`; misses stay in learning steps / short intervals.
6. After Review N: Speak CTA deep-linking `/scenarios?...` with a **production** prompt (not tap-only) for this lesson’s targets.
7. Persist in-progress lesson session (lessonId + step index + ratings) so refresh/resume works; Today’s Path “continue” uses it.
8. Map teach self-rate `again` + quiz misses → priority in Review N and FSRS Again/learning steps.

**Docs / copy sources**

- `lessonStudyPlanner.ts` `LessonStep` union and `buildLessonPlan`
- `LessonStudy.tsx` TeachCard 4-step flow (preserve predict-before-reveal)
- `maynardExplanationEngine` / `getMaynardSupport` for focus-on-form depth

**Verification**

- [ ] New step kinds covered in `LessonStudy.test.ts`
- [ ] Completing a lesson always runs Review N or schedules dues with explicit defer
- [ ] Resume mid-lesson from Today works after refresh (once persistence lands)
- [ ] Science check: session includes encoding + retrieval + at least one productive step

**Anti-pattern guards**

- Do not remove Maynard deep explanations from teach cards.
- Do not reintroduce generated TTS.
- Do not replace Recall Review N with “show answer and rate” only inside the lesson with no SRS write.

---

### Phase 4 — First-run teaching

**Science drivers:** early successful retrieval cycles; spacing must have something to space.

**What to implement**

1. After placement, set `currentLesson` (or generate path with `includeTextbookLessons: true`) and land on first lesson Intro — not an empty dashboard promise.
2. One-click / auto bundled Genki starter when deck empty (`bundledGenkiImport`) so day-1 due reviews can exist after first lesson.
3. Caught-up Today state: “Continue Course” to next incomplete curriculum lesson, not vague `/learn`.
4. Default `includeTextbookLessons` to true for new profiles so path weeks contain launchable lessons.
5. Cap new-card intake relative to due load (preserve existing ~1 new per 5 due interleave or tighten) so learners cannot mass-cram past spacing.

**Docs / copy sources**

- `OnboardingFlow.tsx` / `StepPlacement.tsx` copy (“We'll start your study plan here”)
- `bundledGenkiImport.ts`
- `store` defaults for `includeTextbookLessons`
- `StudyDashboard` new/due interleave logic

**Verification**

- [ ] Fresh profile: onboarding → concrete lesson within one click
- [ ] Empty SRS: starter import available without hunting My Content
- [ ] Path generation includes `weeks[].lessons` by default
- [ ] Science check: first session ends with scheduled reviews, not only “lesson complete”

---

### Phase 5 — Verification (redesign gate)

1. Confirm implementations match Phase 0 allowed APIs (no prose-parsed path activities).
2. Confirm each shipped step still maps to the Learning Science Foundation table (no “engagement-only” shortcuts).
3. Grep guards: `markLessonComplete` call sites; `setCurrentLesson` call sites; TextbookProgress navigate payload.
4. Run `npm run verify` (or at least lint + Vitest + route smoke for study/learn/scenarios).
5. Pedagogy smoke (manual): placement → lesson (teach/check/practice) → Review N (recall + FSRS write) → Speak production → next Today action prioritizes dues.
6. Update `todo.md` Active Priority checkboxes as phases complete.

---

### Out of scope for this redesign

- Full CEFR can-do gating before unlocking the next textbook (valuable later; needs validated can-do instruments)
- Writing-recognition / stroke scoring (CardWriting remains placeholder until a real input path — needed for transfer to writing skill)
- Full AI rubric grading of workbook output (keep self-check prompt now; tutor grading later)
- Regenerating textbook OCR / image crops
- Japanese UI locale pack (still valuable polish; not required to fix the teaching loop)

---

## Completed earlier — Guided Learning Path in Study (2026-06)

Shipped: `studyPathPlanner`, Today’s Path on StudyDashboard, route/build health. Superseded as *active* priority by the Learning Environment Redesign above; keep the planner as the daily orchestration core.

---

## 🔐 Security Audit (2026-05-20)

Findings from a security + general-use pass over the Express proxy, client secret handling, and dependencies.
Items 2–5 are low-risk while the server stays bound to `127.0.0.1`, but become serious once the AI proxy is
deployed publicly (the staging plan above calls for exactly that on Render/Fly/Railway).

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | ✅ FIXED | **OpenRouter key sent to wrong domain.** `app/server/index.ts` now uses `https://openrouter.ai/api/v1/chat/completions` through shared provider constants for streaming and non-streaming paths. | Keep provider URLs centralized in `PROVIDER_ENDPOINTS`. |
| 2 | ✅ MITIGATED | **SSRF via `custom` provider endpoint.** Custom endpoints now require `https`, except explicit localhost/loopback development URLs, and DNS/IP resolution rejects private, link-local, multicast, and unspecified addresses. | If public hosted custom endpoints become important, move them to server `.env` allowlists instead of client-provided URLs. |
| 3 | ✅ FIXED | **API keys in browser localStorage, contradicting docs.** Hosted AI providers and PDF extraction can use server environment variables or tester-provided session-only keys. Custom provider auth remains server-env only. Persisted Zustand state scrubs old `apiKey` values. | Prefer server keys for controlled beta; allow BYO keys for testers who want AI without shared provider spend. |
| 4 | ✅ MITIGATED | **Unauthenticated, unbounded session tokens.** Tokens now expire after 12 hours and are capped in memory. | Add real user auth/session gating before exposing token issuance publicly. |
| 5 | ✅ MITIGATED | **No rate limiting / security headers.** `/api/*` now has a lightweight per-IP rate limit, common security headers, 2 MB JSON body cap, and PDF upload limit reduced to 100 MB. | Replace with platform-grade rate limiting if the proxy becomes internet-facing. |
| 6 | ✅ FIXED | **npm audit — auto-fixable runtime/dev vulns.** `npm audit fix` updated runtime packages, then unused vulnerable dev dependencies (`drizzle-kit`, `xlsx`) were removed. Full `npm audit` now reports 0 vulnerabilities. | Keep spreadsheet parsing out of runtime unless a maintained parser is chosen. |

**Good practices confirmed:** local server binds to `127.0.0.1`, production can bind via `HOST`; CORS is
locked to localhost plus explicit `CORS_ORIGINS`; OCR helper uses `execFile` with array args + filename sanitization (no shell injection); report
endpoint sanitizes + length-caps input with fixed labels; no secrets committed (`.env.example` only,
passphrases + packs gitignored).

**Code-health:** docs sprawl — ~15 disagreeing top-level markdowns; consolidate to one source of truth.
tsconfig strictness (`noUnusedLocals` / `noUnusedParameters` / `erasableSyntaxOnly`) is relaxed for legacy
Anki code; re-tighten incrementally.

---

## 🔇 Generated Speech Removed Before Beta (2026-06-24)

The previous browser/Azure TTS fallback sounded bad and was not ready for testers. Generated speech is now
removed from review cards, writing cards, and scenarios. The app preserves imported Anki audio and optional
uploaded card audio only; future speech work should start behind an explicit feature flag with quality and
cost controls.

**Recommendation.** Keep generated speech out of beta. Revisit audio later only after selecting a high-quality
engine, adding a visible opt-in control, and covering it with playback regression tests.

---

## 🏗️ Technical / Platform Improvements (2026-05-20)

Grounded in the current code; not covered elsewhere in this plan. Ordered by impact.

1. **✅ FIXED 2026-06-12 — Move DB persistence off `localStorage` → IndexedDB.**
   `sqlite.ts` now loads/saves the raw sql.js `Uint8Array` snapshot in IndexedDB, debounces writes, migrates
   an existing `kiroku_michi_db` localStorage snapshot forward, and raises an in-app warning if persistence
   fails. `localStorage` remains only as a last-ditch fallback when IndexedDB is unavailable.
2. **Run sql.js in a Web Worker.** The DB executes on the main thread, so heavy reads (CardBrowser, stats
   aggregation, APKG parse) block rendering. Move it into a Worker to keep the UI responsive during imports
   and large queries. Pairs naturally with #1.
3. **Storage-quota safeguard (stopgap until #1).** Wrap `setItem` in try/catch, surface a "storage almost
   full — export your data" warning, and stop silently dropping writes. Today a full quota fails invisibly.
4. **First-run starter on-ramp.** The "zero content on install" decision means a new user lands on an empty
   dashboard with nothing to review until they successfully import a deck or PDF — a steep activation cliff.
   Bundle a small starter deck (~hundreds of N5 words) or a one-click "load a free Genki/Kaishi starter" so a
   newcomer can review within 30 seconds. Flows directly from the locked content decision; not yet on the roadmap.
5. **Localize the UI — Japanese first.** `react-intl` is wired across the app but `locale` is hardcoded `"en"`
   (`App.tsx:91`) with only `en.json`. For a Japanese-learning app a Japanese UI is fitting and cheap given the
   scaffolding — add `ja.json` + a locale switcher. Right now the i18n infrastructure buys nothing.
6. **Accessibility pass.** Only ~27 of ~70 components use any `aria`/`role`; just 3 have `Escape`/focus
   handling. Modals (Report Issue, keyboard help, confirm dialogs) likely lack focus traps + Esc-to-close, and
   the rating buttons may be unlabeled for screen readers. Sweep: modal focus management, aria-labels on
   rating/review controls, visible focus rings.

**Priority:** #1 is urgent (silent data-loss waiting for a power user; degrades perf for everyone as decks
grow). #4 is the highest-leverage *product* fix for new-user activation. #2/#3 reinforce #1; #5/#6 are
high-value polish with the groundwork already partly in place.

---

## What Is Built (Complete)

### Staging Hosting + User Reporting
- Vercel staging support is implemented for the Vite frontend with `app/vercel.json`; configure Vercel with app root `app`, build command `npm run build`, and output directory `dist`.
- The SPA rewrite is in place so direct refreshes on routes such as `/learn/lessons`, `/study/browser`, and `/scenarios` serve `index.html` instead of a 404.
- Use a staging URL first, such as `kirokumichi-staging.vercel.app` or `staging.kirokumichi.com`; reserve production later for `app.kirokumichi.com` or the final public domain.
- Treat backend/API features separately: either keep the Express AI proxy deployed on Render/Fly/Railway, or convert small endpoints such as reporting into Vercel serverless functions.
- In-app `Report issue` is implemented in the top/burger menu.
- Reporting modal supports report type:
  - bug
  - content/OCR issue
  - unreadable text/contrast
  - lesson problem
  - scenario problem
  - suggestion
- Reports automatically attach route, full URL, timestamp, browser/user agent, viewport, light/dark theme, app version/commit hash, current lesson, active deck, and route-derived lesson/scenario/card context where available.
- `/api/report` is implemented in both local Express and Vercel serverless forms. It creates GitHub Issues when `GITHUB_REPORT_REPO` and `GITHUB_REPORT_TOKEN` are configured; otherwise it accepts reports in local mode for smoke testing.
- Store GitHub report credentials only as hosting environment variables, never in the repo or client bundle.
- Hosted AI credentials can be server environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
  `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`) or tester-provided session-only keys. Custom provider auth
  remains server-only (`CUSTOM_PROVIDER_API_KEY`). PDF extraction currently requires server
  `DEEPSEEK_API_KEY` or a tester-provided DeepSeek key.
- Later polish: optional screenshot attachment, console-error capture, and Sentry event ID linking so runtime crashes and user reports can be correlated.
- KirokuMichi-specific requirement: content reports should include exact textbook/source/lesson/page/item IDs where possible so OCR/content fixes are traceable rather than vague.

### Current Buildable Roadmap Closeout
- Shared textbook detection now lives in `textbookDetection.ts`, returns textbook key, label, confidence, and reason, and is covered by Vitest.
- Content upload can persist per-file routing overrides, including known textbook matches and `custom / not mapped`, so filename auto-detection is confirmable instead of a hard requirement.
- Anki import can receive textbook key/deck routing, records import provenance, and routes imported cards into linked decks when available.
- Locked textbook packs have a local AES-GCM/PBKDF2 helper (`textbookPackUnlock.ts`) and an upload/unlock UI path for structured pack JSON payloads.
- Lesson vocab additions now persist source lesson/card metadata through `lesson_vocabulary`, `origin_type`, and `origin_ref`.
- User-created/imported/lesson-added cards can store tags, personal notes, and provenance; Card Browser surfaces and edits the user-facing parts.
- Textbook Progress cards now show linked deck stats plus lesson completion progress from `lessonsCompleted`.
- Study Stats has a 7 days / 30 days / all time review chart toggle.
- AI Learning Path has a visible CEFR stage gate and includes stage-gate constraints in generated plan prompts.
- ScenarioMode now has a deterministic E2E shell test for opening live chat and typing without depending on an external AI provider.
- `npm run content:import:smoke` reports real-PDF fixture readiness and is included in `npm run verify`.
- `npm run textbook:maynard:quality` now emits `commonCuratedBridges`, making remaining Maynard cleanup a concrete direct-alias target list rather than a vague extraction chore.
- Maynard direct-reference cleanup reduced curated bridges from 73 to 5 while keeping A1-B2 support coverage at 100%.
- Grammar review now uses scheduler-backed `grammar_states` with Again/Hard/Good/Easy ratings; `grammar_progress` remains as compatibility/history.
- Closed beta access can be gated with comma-separated `BETA_INVITE_CODES` without adding a database.

### Direct Maynard Source References
- `npm run textbook:maynard:direct-refs` builds a deterministic app-facing Maynard reference index from the local comprehensive Maynard extraction.
- The generated module maps common grammar patterns and aliases to direct Maynard topics, excerpts, examples, page ranges, and source ids.
- `getMaynardSupport()` now resolves in this order: pre-attached textbook ref, generated direct Maynard source ref, curated support bridge.
- Lesson study deep-explanation cards show Maynard page references when a direct source ref is available.
- The Maynard coverage audit and `/dev/textbook-qa` now distinguish direct refs from curated fallback bridges, so future cleanup can steadily reduce the curated count.

### Route QA + Screenshots
- `npm run verify` is the canonical full health gate: lint, TypeScript, Vitest, Playwright route QA, build, learner-facing content audit, Maynard coverage audit, and textbook asset manifest generation.
- `npm run qa:routes` runs Playwright against the critical learner routes in desktop Chrome and mobile Pixel 5 profiles.
- The route QA checks key route text, detects horizontal overflow, and saves screenshots under `app/tools/qa/out/route-screenshots/`.
- Vitest route manifest tests now also protect the high-priority learner routes.

### UX Polish Pass
- Toasts are now wired into real app flows instead of only existing as an unused component: dashboard review/session actions, mistake drills, undo review, AI connection tests, tutor/conversation failures, and saved conversation corrections.
- Shared `EmptyState`/`Skeleton` components now cover StudyDashboard, LearningMode, LessonsHub fallback, GrammarReview, ScenarioMode, and MistakeReview.
- Mobile layout audit pass completed for dashboard, learn, lesson hub, lesson detail, scenarios, review, grammar review, mistake review, AI tutor, and conversation partner; 390px Browser smoke showed no horizontal overflow.
- Current limitation: Browser screenshot capture timed out during this pass, so verification used DOM state plus viewport overflow checks.

### Workbook Output Practice
- Workbook tasks are now part of the actual lesson teaching flow, not just supplemental text on the lesson page or summary.
- After teaching and recall, lessons can show a `Workbook Output` step where learners write/roleplay/correct/checkpoint responses and mark tasks complete.
- Lesson summaries track workbook completion and preserve the learner's written output for review.

### Textbook Image Asset Hook
- Lesson pages now have a `Textbook Image Assets` section wired to `textbookAssetService`.
- If `textbook-assets.json` exists, page/photo/diagram assets render with captions and page references.
- If no manifest exists yet, the lesson shows a clear pending state so the future extraction pipeline has a visible destination.
- `npm run textbook:assets:manifest` now scans reviewed-pack asset folders, copies available images to `app/data/generated/assets/textbook/`, and writes `app/data/generated/assets/textbook-assets.json`.
- Current manifest publishes the two reviewed local assets available in the workspace: Genki I Workbook Lesson 1 listening picture choices and Quartet I Lesson 1 Miyazaki reading photo. More assets will appear automatically after the external extraction pipeline produces more reviewed crops.

#### Image extraction workflow (agreed 2026-06-12)
- Do not scan/screenshot images separately. The PDF stays the single source of truth; images are coordinate-based crops via `imageFile` + `imageSourceRef: { sourceId, pageNumber, coordinates }` on pack items, rendered by `npm run textbook:assets:crop` (pypdfium2 + PIL) and published by `npm run textbook:assets:manifest`.
- The bottleneck is finding crop coordinates, not cropping. Plan of attack, cheapest-first:
  1. **Deterministic candidate generation (zero model cost):** derive candidate figure regions from gaps in the grouped PaddleOCR block coverage (`tools/textbook-pack/out/grouped/`) — figures are the page regions not covered by text blocks, and the OCR boxes are already pixel-accurate.
  2. **Haiku subagent labeling pass (cheap):** a Claude Code subagent (`model: haiku`) views each page with candidates overlaid and only classifies/filters them (keep vs decorative), matches regions to lesson items, and writes `alt`/`caption` text. No API keys — runs in-session per the project's "Claude Code native AI" rule.
  3. **Escalation tail:** pages the Haiku pass flags as ambiguous (multi-panel layouts, figures interleaved with text) get a Sonnet/Opus pass. Precise raw-coordinate vision is an Opus-tier strength; avoid asking Haiku/Sonnet for pixel coordinates directly (their input downscales to ~1568px long edge and coordinates need scaling back to render-DPI space).
  4. **Existing review flow stays the gate:** pad approved boxes a few px, write proposals into the corrections file, verify in the validation viewer (`npm run textbook:validation-images` + `textbook:validation-viewer`), then crop + manifest + `textbook:reviewed:validate`.
- DPI guidance: crop at 200–300 DPI for panels learners must read (picture-choice exercises, handwriting grids); 150 DPI is fine for decorative photos.
- Cost reality check: a full Genki volume is ~1M image-input tokens — single-digit dollars even at Opus rates, and a one-off per book. The scarce resource is human review time, so prefer the OCR-gap + label split (low correction rate) over squeezing model price.
- Keep raw PDFs and full-page renders out of git; crops in `app/data/generated/assets/` are regenerable from PDF + coordinates, and distribution goes through the encrypted-pack path.

### Textbook QA Dashboard
- `/dev/textbook-qa` now tracks workbook output count, image asset count, Maynard coverage percentage, suspicious vocab, page ranges, scenarios, and warnings per lesson.
- Dashboard warnings now call out missing workbook output, missing image assets, low Maynard coverage, suspicious vocab, missing pages, and missing core content.
- The dashboard surfaces the route QA command so future QA passes have one obvious control point.

### Performance / Code Splitting
- Vite now manually splits React/router vendor code, storage/sql.js/SRS code, and PDF tooling.
- Anki import/export no longer statically import `sql.js`, keeping that heavy dependency lazy.
- Latest build reduces the main app JS chunk to ~32 kB; remaining large chunks are generated JLPT data/PDF/vendor chunks that are already route/data lazy.
- JLPT sub-splitting has been assessed and is not currently needed: the shell chunk is small and the remaining large JLPT/generated-data files are lazy route/data loads. Revisit only if measured route-load timing becomes slow.

### CI
- `.github/workflows/verify.yml` runs the app health gate on push and pull request.
- CI installs Node 22, app dependencies, bundled Playwright Chromium, then runs `npm run verify`.
- Playwright uses local Chrome by default, and CI can set `PLAYWRIGHT_CHANNEL=bundled` to use the installed Chromium browser.

### Core SRS
- SQLite via sql.js, persisted to localStorage as base64 snapshot
- FSRS + SM2 schedulers, switchable in Settings
- `card_states` with due dates, stability, difficulty, lapses, leech detection
- Session tracking (`sessions` table, `started_at` / `ended_at` / `cards_reviewed`)
- Session recovery (crash-safe resume via `sessionRecovery.ts`)
- Mistake logging (`mistake_logs` table)

### Study Dashboard (`/study`)
- Due count + new count (capped by daily limit)
- Daily card limit stepper (0–100)
- Weekly Goals widget: reads `jlptTarget` + `goalDate`, calculates cards/week needed, tracks this week's completed cards from `sessions`, and shows progress toward the target
- Streak heatmap — blue = vocab only, purple = grammar only, green = both
- Weak-point panel (`WeakPointPanel.tsx`)
- Two review buttons: "Review Words" (indigo) and "Study Grammar" (purple)
- Session recovery modal on load

### Word Review (`/study/review`)
- Interleaved queue: 1 new card per 5 due cards
- Filtered to vocabulary / kanji / hiragana / katakana types
- CardReading → CardMeaning flow
- Audio playback via `useCardAudio.ts`: resolves `idb:` prefix keys from IndexedDB (`audioStore.ts`), no TTS fallback on vocab cards (Anki cards have real MP3s)
- Exit button with confirm dialog
- Grammar fill-blank review cards can now expand a `View explanation` panel after reveal, using the linked `grammar_points` explanation and examples instead of leaving learners with only the correction sentence.

### Grammar Review (`/study/grammar`)
- Pulls from `grammar_points` table, ordered by `times_seen ASC NULLS FIRST`
- Progress tracked per-user in `grammar_progress` table (UPSERT on each view)
- `GrammarCard`: front = pattern + meaning + JLPT badge; reveal = explanation + examples
- Session logged with `mode = 'grammar'` for heatmap split

### Lesson Teaching (`/learn/study`)
- Real teaching-flow v1 is live, replacing the old pure exposure flow.
- Lesson planner deterministically interleaves grammar and vocabulary, then splits the lesson into small sets of 5 items.
- Each item now follows: predict → reveal explanation/function → build a memory hook → micro-practice → self-rate.
- Learners must self-rate each item as `Need Review` or `I Can Explain It` before moving on.
- Each chunk ends with checkpoint recall; the lesson ends with a final mixed review.
- Summary reports quiz misses and self-marked weak items so the learner can see what needs another pass.
- Maynard-matched grammar cards now surface a visible `Maynard Deep Dive` panel instead of hiding the reference in a collapsed disclosure.
- Lesson teaching order is now page-aware: curated foundations come first, paginated textbook content follows source page order, and unpaged CEFR grammar is placed after paginated source material.
- Lesson transition buttons now name the actual next action (`Next Item`, `Start Checkpoint`, `Start Mixed Review`, `Finish Lesson`) instead of always saying `Checkpoint`.
- Current limitation: Maynard coverage is complete, but some support still comes from curated bridges or attached refs rather than direct page-specific Maynard aliases. Cleaner extraction/alias data should reduce the curated count over time.

### Lesson Intent + Maynard Explanation Engine
- Lessons now build a structured intent plan instead of only assembling content buckets.
- Each lesson can surface objective, prerequisite, source page range, target grammar, target vocab, output skill, matching scenarios, workbook practice tasks, and Maynard/support count.
- A1, A2, B1, and B2 lessons now use lesson-specific authored objective wording so lesson intent reads like a course plan instead of a generic level description.
- Grammar teaching cards now use a richer explanation plan:
  - basic explanation
  - Maynard deep explanation when matched
  - contrast with nearby grammar
  - common mistake
  - example pattern
- Lesson cards show source/page references where the extracted data has pages.
- Workbook and scenario material now feeds output-practice tasks such as guided drills, short answers, roleplays, correction targets, and checkpoints.
- Workbook practice tasks now carry explicit practice mode and focus metadata (`guided`, `output`, `correction`, `checkpoint`) so lesson pages and summaries can distinguish drills from production tasks.
- Foundational A1 grammar now gets deterministic deep-support bridges when the extracted textbook grammar lacks a Maynard match, covering beginner-critical items like `です`, `は`, `が`, `も`, `の`, `か`, ko-so-a-do words, adjectives, `ている`, and `てください`.
- A1 lesson intent has curated output-skill overrides so early lessons read like authored goals instead of being driven by the first matching scenario.
- A2/Genki 2 lessons now also have authored output-skill overrides so lesson intent follows a clearer course arc from simple survival Japanese into connected everyday explanation.
- B1/Quartet 1 and B2/Quartet 2 lessons now have authored output-skill overrides so higher-level lessons ask for supported opinions, nuanced discussion, responsibility/no-choice framing, and evidence-based qualification instead of generic scenario-bucket goals.
- The Maynard/support bridge now covers common Genki 2 patterns such as `やすい/にくい`, `ほしい`, giving/receiving actions, `そう`, `みたい`, comparison, `ようと思う`, `なら`, necessity, `し`, `かどうか`, `てある`, `ようにする`, `ても`, transitive/intransitive verbs, honorific/humble forms, negative degree, `もし`, `なおす`, and common-view/reporting patterns.
- The Maynard/support bridge now also covers common Quartet-style B1/B2 discussion patterns such as advice strength, purpose/conditions, concession, topic/target marking, evaluated cause, partial denial, impression, contrast/trend, realization/evaluation, change/unresolved states, viewpoint/consequence, time-gap/possibility, deserved reputation, responsibility/no-choice logic, compulsion, limits/qualification, medium/scope, and prohibition.
- The latest pass added broader support for te-form linking, verb-form systems, core particles/endings, preference/desire, permission/prohibition, time sequence, clause relation, framing/quoting, resemblance, quantity, feasibility, viewpoint, and intermediate relation patterns.
- `npm run textbook:maynard:quality` writes a coverage report and currently shows 637 A1-B2 grammar points, 637 supported, 100% support coverage, 353 direct refs, 73 curated bridges, 211 attached refs, and 0 low-coverage lessons.
- Current limitation: cleaner direct Maynard extraction should later replace remaining broad curated bridges where reliable page/topic references are available. The current audit report now lists those bridge targets under `commonCuratedBridges`.

### Textbook Coverage QA (`/dev/textbook-qa`)
- Added a developer QA dashboard for lesson-pack coverage.
- The dashboard reports per lesson: vocab count, grammar count, scenario count, Maynard/support count with direct-vs-curated split, suspicious vocab count, page range, and warnings.
- This is intended to make future textbook cleanup less vibes-based and to quickly spot missing pages, weird OCR, or underfilled lessons.
- Workbook practice filtering now rejects front matter and OCR/admin text before tasks reach lesson pages.

### Content Ordering + Workbook Activity Coverage
- Suspicious vocab cleanup now prunes/fixes the known OCR junk rows across textbook packs and the combined curriculum; `npm run textbook:vocab:quality` reports `unresolvedSuspicious: 0`.
- Scenario sorting now uses numeric lesson order inside each textbook tab, so lessons do not jump from 1 → 4 → 7 when source IDs are string-sorted.
- Learner-facing OCR cleanup is now covered by `npm run textbook:learner:quality`, which audits vocab, grammar, workbook practice tasks, scenarios, and scenario lines through the same services the app uses.
- The current learner-facing content audit reports 0 issues across 349 vocab items, 637 grammar items, 203 practice tasks, 144 scenarios, and 438 scenario lines.
- Raw OCR dialogue blocks are disabled as scenario sources for Genki, Quartet, and Tobira where they were producing reading questions, numbering scars, or prompt fragments instead of usable roleplays.
- Supplemental scenario prompts now normalize common OCR workflow scars before display, including arrow chains, stray numbered steps, `@` markers, and `keephold`-style merged English.
- Caveat: the generated textbook JSON still preserves raw OCR/source artifacts for traceability and future extraction QA; the app-facing lesson/scenario/practice pipeline is the cleaned and audited layer.
- App-facing second-volume lesson IDs now map back to source lesson IDs:
  - Genki II app lessons 1-11 match source lessons 13-23.
  - Quartet II app lessons 1-6 match source lessons 7-12.
- Lesson-structure lookup uses the same mapping, so `/learn/lessons/a2/1` and `/learn/lessons/b2/1` resolve correctly instead of falling into missing/source-numbered lessons.
- Workbook activities now surface in lesson practice tasks from the respective workbooks where usable OCR prompts exist, with front matter/admin/listening headers filtered out.

### Beginner Scenario Furigana
- `/scenarios` now shows a `Furigana` toggle in selected A1/A2 scenarios.
- The toggle defaults from `settings.furiganaEnabled`, renders beginner readings as real `<ruby>` annotations, and can be turned off per scenario session.
- Curated A1/A2 scenario dialogue lines are covered by `beginnerFurigana.ts`; a coverage sweep currently leaves no unannotated kanji sequences in Genki 1, Genki 2, Marugoto A1, or Marugoto A2 dialogue lines.

### Genki 1 Lesson 1 Foundation
- Genki 1 Lesson 1 now applies a curated foundation overlay before app-facing extracted textbook items.
- The Genki 1 foundation overlay is now a shared content module with regression tests, which makes the eventual canonical pre-lesson pack replacement safer.
- The lesson starts with beginner survival items from the Genki pre-lesson material: greetings, apologies/thanks, and numbers 0-10.
- First-lesson grammar is narrowed to beginner building blocks such as `です`, `は`, `か`, `の`, `これ`, `それ`, and `も`, instead of exposing a broader CEFR slice like `でしょう` too early.
- Current limitation: this is a runtime/app-facing repair. The canonical textbook pack should still model `あいさつ / Greetings` and `すうじ / Numbers` as explicit pre-lesson sections when the Maynard/textbook extraction pipeline is finalized.

### Lesson Navigation
- `/learn/lessons` now renders as a standalone page with the global top navigation and a `Learn Menu` button back to `/learn`.
- When `LessonsHub` is embedded inside `/learn`, it uses compact embedded mode to avoid nested full-page navigation.
- Active lesson/review exits now use explicit destinations such as `Exit to Lesson Page`, `Exit to Study Dashboard`, and `Exit to JLPT Menu`.

### Readability
- Global theme overrides now raise the contrast floor for common pale utility text (`text-gray-400/500`, `text-slate-400/500/600`) in both dark and light modes.
- This keeps secondary labels readable while preserving the existing design hierarchy.
- Dark-mode slate headings/backgrounds and semantic colored panel text now have explicit high-contrast mappings, fixing the `/learn/lessons` `Study by Lesson` and info-panel readability issue.
- Dark-mode semantic `text-*-950` classes now map to readable light tones, fixing the Lesson Study `Step 1: Predict`, Maynard deep explanation, and micro-practice panel contrast issue.
- Dark-mode semantic color coverage now includes the remaining orange/yellow/blue/indigo/red/green badge and button classes found in the app-wide scan.

### Genki Vocab Quality
- Added `tools/textbook-pack/repair-genki-vocab-quality.ts` and the `npm run textbook:vocab:quality` command.
- The tool reports suspicious Genki vocab meanings and can apply curated repairs to the app-facing generated textbook files.
- First repair pass fixed 48 distinct curated Genki 1/2 vocab issues across:
  - `data/generated/textbooks/genki_1_textbook-comprehensive.json`
  - `data/generated/textbooks/genki_2_textbook-comprehensive.json`
  - `data/generated/textbooks/comprehensive-curriculum.json`
- Fixed learner-facing romaji-as-English cases such as `obaasan` → `grandmother` and `oneesan` → `older sister`, plus OCR spillover like `fne`, `lastmonth`, `toexercise`, and merged reading/surface strings.
- Current report: `tools/textbook-pack/out/vocab-quality/genki-vocab-quality-report.json`.
- Current report classifies unresolved suspicious rows as `manual_review` or `prune_or_ignore`; latest report has 12 manual-review rows and 16 prune/ignore candidates.

### Textbook Image Assets
- Added a typed textbook asset manifest service for future user-provided page/photo assets.
- The service can load `/data/generated/assets/textbook-assets.json` when the extraction/image pipeline produces it and can return assets by lesson or page.
- If no asset manifest exists yet, it safely returns empty results, so UI integration can be incremental.
- Lesson pages now load assets from the base textbook and supplemental source keys, so workbook images can appear on core lesson pages.
- `npm run textbook:assets:manifest` generates the app-facing manifest from reviewed asset folders.

### Supplemental Scenarios (`/scenarios` + Conversation Partner)
- Supplemental texts now feed a normalized, curated runtime scenario layer through `supplementalScenarioService.ts`.
- Curated scenario display text is polished at runtime: classroom labels like trailing `Pair Work` are removed from titles, `Can ...` can-do statements become direct learner goals, and prompts/lines pass through the shared text cleaner.
- The service loads generated textbook JSON, applies per-textbook page windows, rejects common OCR/front-matter/publishing noise, scores practice-like material, and emits clean `SupplementalScenario` records.
- `/scenarios` now uses level-first tabs (`A1`, `A2`, `B1`, `B2`, etc.) with nested textbook/source tabs inside the selected level, so learners can browse by proficiency before choosing a source book.
- Scenario source tabs are driven by an explicit catalog so the expected sources always appear even before a source has curated/generated scenarios: A1 = Genki 1 Textbook, Genki 1 Workbook, Marugoto A1; A2 = Genki 2 Textbook, Genki 2 Workbook, Marugoto A2; B1 = Quartet 1 Textbook, Quartet 1 Workbook, Marugoto B1; B2 = Quartet 2 Textbook, Quartet 2 Workbook, Tobira.
- Curated workbook scenario packs are now loaded for Genki 1 Workbook, Genki 2 Workbook, Quartet 1 Workbook, and Quartet 2 Workbook, so workbook tabs are real practice sources rather than empty catalog placeholders.
- Curated second-volume workbook source lessons are normalized to app lesson numbers at runtime:
  - Genki 2 Workbook source lessons 13-23 map to app lessons 1-11.
  - Quartet 2 Workbook source lessons 7-12 map to app lessons 1-6.
- Scenario core lesson links are now guarded to stay inside app lesson ranges, preventing source-derived material from pointing to impossible lesson IDs such as out-of-range B1 buckets.
- A first `/scenarios` visual QA pass checked visible A1, A2, B1, and B2 cards; the pass tightened B1/B2 rules for English can-do admin pages, worksheet checks, and example sentences that were slipping through.
- `supplementalScenarioService.test.ts` now snapshots normalized output, verifies mapped lesson filtering/source caps, and guards against workbook comprehension checks being promoted into scenario prompts.
- Scenario sources include Genki workbooks, Marugoto A1/A2/B1, Quartet 1/2 workbooks/textbooks, and Tobira.
- Curated Genki 2 scenario pack is registered with 22 A2 scenarios across all 11 lessons, giving each lesson at least two authored output tasks.
- Curated Quartet 1 and Quartet 2 scenario packs are registered with 12 B1 and 12 B2 scenarios, giving each Quartet lesson two authored discussion/output tasks.
- Curated scenario pack integrity tests now guard Genki 1/2, Marugoto A1/A2, and Quartet 1/2 lesson coverage, level metadata, curated-source tagging, practice prompts, and authored dialogue structure where applicable.
- All curated scenario JSON packs now include explicit page fields and dialogue lines; Marugoto A1/A2 no longer rely on runtime-only line synthesis.
- Two scenario types are produced:
  - `dialogue`: clean model-dialogue records that pass quality checks
  - `practice_prompt`: exercise/can-do prompts converted into roleplay or discussion starters
- Each normalized scenario carries textbook, CEFR level, source lesson, mapped core lesson where possible, page, can-do goal, lines, and practice prompts.
- `/scenarios` now shows these supplemental scenarios alongside locally imported scenario rows.
- Conversation Partner's textbook dropdown now uses the cleaned scenarios and injects the can-do goal, source sample, and practice prompts into the AI system prompt.
- LessonPage supplemental-material buttons route to `/scenarios` with `level`, `source`, and `lesson` filters.
- Current limitation: the source extraction remains OCR-derived. The service now has deterministic curation plus regression tests, but deeper per-textbook/page-range QA should still polish wording and coverage for final lesson packs.

### Anki Import
- `.apkg` → JSZip → parse SQLite → extract cards + audio
- Audio bytes stored in IndexedDB (`audioStore.ts`) under key `idb:<filename>`
- `cards.audio_url` stores `idb:<filename>` — resolved to fresh Blob URL at play time
- `source = 'user'` on all imported cards

### Build Health
- `npm run lint` is green as of 2026-05-18 09:43 AEST.
- `npx tsc -b --pretty false` is green as of 2026-05-18 09:43 AEST.
- `npm run build` is green as of 2026-05-18 11:18 AEST.
- `npm run test` is green: 100 tests across 16 files.
- Browser smoke is green for `/learn/lessons/a1/1`, `/learn/lessons`, `/study/grammar`, `/dev/textbook-qa`, and `/scenarios` A1/A2/B1/B2 textbook tabs.
- Route smoke coverage now guards critical learning routes and the `/learn/study` lesson flow.
- Route-level lazy loading/code splitting is in place. The main app shell is down to ~339 kB minified; large data/PDF chunks remain for later splitting.
- `npm run textbook:vocab:quality` is green and reports the remaining suspicious Genki vocab rows.
- TS build blockers fixed around APKG type-only imports, audio Blob creation, SQLite database interface imports, and Heatmap required fields.
- `app/public/data` symlink corrected to `../data` so Vite can copy public data during build.
- `noUnusedLocals`, `noUnusedParameters`, and `erasableSyntaxOnly` are temporarily relaxed in `tsconfig.app.json` to allow legacy Anki-clone code to compile while it is cleaned incrementally.
- ESLint now ignores generated/textbook tooling output and treats legacy style/type cleanup rules as non-blocking, so lint is useful as a hard syntax/rules gate again instead of failing on historical cleanup debt.

### AI Infrastructure
- Express proxy at `server/index.ts` — `POST /api/ai/complete`
- Supports Anthropic, OpenAI, OpenRouter, Ollama
- Multimodal messages (image content blocks) supported for Anthropic + OpenAI + OpenRouter
- Session token auth (`POST /api/session`, bootstrapped in `App.tsx`)
- Two model slots: `fastModel` (default: `claude-haiku-4-5-20251001`) + `powerfulModel` (default: `claude-sonnet-4-6`)
- `ClientAIProvider` in `app/src/ai/aiProvider.ts`

### Content Import (`/practice` → Upload Content tab)
- **Anki `.apkg`**: full import with audio
- **Paste text or upload one or more files** (`.pdf`, `.txt`, `.md`, `.csv`)
- **PDF (Parallel Mode)**: Upload multiple PDFs together (e.g., textbook + workbook)
  - Text extracted client-side via `pdfjs-dist` from all uploaded files in picker order for generic text PDFs
  - Scanned PDFs can be OCRed server-side using local macOS Vision OCR
  - Per-file PDF ranges are supported; Genki 1 presets currently use textbook page 14 and workbook page 12
  - Repeated same-file/same-range extractions are cached during the server session to avoid run-to-run variation
  - Optional page image rendering (up to 8 pages per PDF → JPEG base64) for vision-capable models
  - AI processes all uploaded files together in a single call with cross-document context
- **AI extraction** via strict `EXTRACTION_SYSTEM_PROMPT` — single call returns `{ vocab, grammar, lessons }`
  - Assumption: user knows all hiragana & katakana (no kana drills)
  - **Structured textbook path handling (primary)**: Automatic furigana elimination over kanji where applicable
    - User can hover or highlight kanji to reveal furigana (JavaScript interception)
    - Detected via filename pattern or user selection in UI
    - Primary path set: Genki 1, Genki 2, Quartet 1, Quartet 2, Tobira, Shin Kanzen Master
- **Preview panel**: three collapsible sections (Vocab / Grammar / Lessons), per-category import toggles
- **Import routing**:
  - `vocab` → `cards` + `card_states` (immediately in SRS queue, `source='user'`)
  - `grammar` → `grammar_points` (`source='user'`, appears in Grammar Review)
  - `lessons` → `learning_content` (appears in `/learn`)
- Import summary: tile count per category

#### Known Textbooks Import UX (proposed)
- Add a dedicated **Known Textbooks** panel in Upload Content, separate from generic PDF/text import
- Layout:
  - Large drop zone: textbook/workbook PDFs
  - Smaller side drop zone: corresponding Anki decks for those textbooks
- Known textbook path targets: Genki 1/2, Quartet 1/2, Tobira, Shin Kanzen Master
- Keep generic import unchanged for all non-mapped content
- In `/learn`, add **Textbook Learning** subsection:
  - Lesson-by-lesson progression for matched textbook sets
  - Integrated extraction actions (vocab, phrases, grammar)
  - Unlock-to-deck actions for mapped textbook lessons
  - Personal notes on unlocked/added cards

#### Specialized Textbook Pack Strategy (new primary mapped-textbook plan)
- For known textbooks, generic PDF→OCR→AI extraction is now a fallback, not the desired production path.
- Primary plan: generate high-quality structured textbook packs offline, encrypt them in the app, and unlock them only when the user supplies matching source PDFs.
- Dataset scope is Japan Times GENKI 3rd Edition plus QUARTET, covering roughly N5 through N2:
  - Genki I Textbook/Workbook: Lessons 1-12
  - Genki II Textbook/Workbook: Lessons 13-23
  - Genki I & II Answer Key: combined answers plus listening scripts
  - Quartet I Textbook/Workbook/Workbook Answer Key: Lessons 1-6, roughly N3
  - Quartet II Textbook/Workbook/Workbook Answer Key: Lessons 7-12, roughly N2
- Genki 1 v3 is the first target:
  - Full textbook/workbook extraction comes first, including front matter, contents, Reading & Writing, indexes, and support pages.
  - The old textbook page 14 / workbook page 12 starts are only quick generic-import smoke-test presets, not canonical pack boundaries.
  - First proof should produce a canonical Lesson 1 JSON pack from the full-source capture before expanding to the full book.
- Offline/specialized extraction pipeline:
  - Evaluate Apple Vision OCR, PaddleOCR/PP-OCRv5 Japanese+English, and optionally Manga OCR.
  - Prefer PaddleOCR if it improves Japanese+English layout, table, and exercise extraction over Apple Vision.
  - Manga OCR is likely better for manga/immersion assets than textbook pages; do not make it the primary Genki engine unless testing proves otherwise.
  - Convert textbook/workbook pages into canonical JSON: lessons, vocab, grammar, readings/dialogues, workbook references, and furigana mappings.
  - Include answer-key mappings: exercise id → answer-key page/coordinates/ground-truth answer.
  - Include listening-script mappings from answer keys for listening exercises and tutor explanations.
  - Include section-mode metadata when a book has explicit skill divisions, for example Quartet's Reading/Writing/Speaking/Listening sections.
  - Validate generated JSON with schema checks, duplicate checks, coverage checks, and stable output diffs.
- Genki-specific extraction notes:
  - Vocab is listed within each lesson.
  - Kanji comes from the textbook Reading & Writing section in the back.
  - Answer key is a combined Genki I & II source and should be indexed for textbook/workbook answers plus listening scripts.
- Quartet-specific pack notes:
  - Quartet 1 consists of Textbook + Workbook for Lessons 1-6, roughly JLPT N3.
  - Quartet 2 consists of Textbook + Workbook for Lessons 7-12, roughly JLPT N2.
  - Quartet textbooks also rely on a separate supplement / 別冊 (Bessatsu) for vocabulary and kanji lists. The pack pipeline must ingest this as its own file role, not assume all vocab lives inside lesson chapters.
  - Quartet lessons should preserve the 4-skill structure: Reading (読む), Writing (書く), Speaking (話す), Listening (聞く).
  - Textbook content is the AI tutor source of truth: readings, grammar notes (`文型・表現ノート`), and model dialogues.
  - Workbook content should become output/challenge material: drills, true/false questions, sentence construction, grammar practice, and reading comprehension checks.
  - Layout extraction must handle denser pages than Genki: long authentic-style readings, multi-page essays, richer diagrams, and text wrapping around images.
- Tutor/assessment rules:
  - When grading, use answer-key ground truth for the specific exercise id, page, and coordinates.
  - If a user answer is grammatically correct but does not use the lesson target grammar, flag it as correct but off-target.
  - For listening exercises, use answer-key listening scripts to explain dialogue and highlight vocab.
  - Future handwritten workbook checking should compare handwriting against answer-key ground truth, not raw AI vision alone.
- Encrypted pack/unlock model:
  - Ship only encrypted structured JSON packs and non-sensitive metadata.
  - User uploads their own textbook/workbook PDFs locally to prove access.
  - App verifies the files using local fingerprints/signatures, then decrypts/unlocks the relevant pack.
  - Persist unlock status locally per user/device.
  - If verification fails or the edition is ambiguous, fall back to generic PDF import with user confirmation.
- This avoids repeatedly asking DeepSeek to infer textbook structure and gives consistent, curated lesson data for mapped textbooks.

#### CEFR Roadmap Structure (`Structure.xlsx`)
- The workbook defines the curriculum as three parallel source roles:
  - **Core**: the main content spine and grammar engine. These are the authoritative course packs the app should extract first.
  - **Pair**: practical/social practice material paired with the Core stage. This supports output practice, can-do validation, and real-use reinforcement.
  - **In-depth grammar**: deeper explanation material for linguistic logic, nuance, and "why this rule works" support.
- Current stage map:
  - **A1 / Breakthrough**
    - Core: Genki I Textbook, Genki I Workbook, Answer Key
    - Pair: Marugoto A1 Katsudoo (Starter)
    - In-depth grammar: Maynard Strategy P1-2, preliminaries and fundamentals
    - Focus: survival basics, introductions, time/dates, and simple daily interactions
  - **A2 / Elementary**
    - Core: Genki II Textbook, Genki II Workbook, Answer Key
    - Pair: Marugoto A2 Katsudoo (Elementary 2)
    - In-depth grammar: Maynard Strategy P3, the core
    - Focus: routine tasks, personal background, and familiar information exchange
  - **B1 / Threshold**
    - Core: Quartet I Textbook, Quartet I Workbook, Answer Key
    - Pair: Marugoto B1 (Intermediate 1 / Chukyu 1)
    - In-depth grammar: Maynard Strategy P4, expansion
    - Focus: connected text on personal interests, dreams, ambitions, and opinions
  - **B2 / Independent**
    - Core: Quartet II Textbook, Quartet II Workbook, Answer Key
    - Pair: Tobira
    - In-depth grammar: Maynard general reference / linguistic nuance
    - Focus: complex abstract texts and more fluent interaction with native speakers
- Roadmap study rules:
  - Core first: complete the Genki/Quartet grammar chapter to build the structural base.
  - Pair second: use Marugoto A1-B1 or Tobira B2 to see and practice that structure in practical communication or denser reading.
  - In-depth grammar check: use Maynard when a grammar rule feels arbitrary and needs linguistic explanation.
  - Can-do validation: do not advance CEFR rank until the relevant practical tasks are comfortable.
- Data model implication:
  - Source manifest entries now carry `curriculumRole`, `cefrPhase`, `source_series`/`book_key` via `textbookKey`, and source file role.
  - Textbook packs and future roadmap nodes should also carry `cefr_level`, `phase_name`, `source_role`, `source_series`, `book_key`, and optional `can_do_targets`.
  - Existing Genki/Quartet extraction remains the immediate **Core** path. Pair and In-depth grammar sources should be attached after Core pack structure and validation are reliable.
- Current inventory status:
  - `app/tools/textbook-pack/out/source-manifest.json` has no source gaps.
  - Pair sources are present: Marugoto A1, Marugoto A2, Marugoto B1, and Tobira.
  - The Maynard/Yanard in-depth grammar source is present as `maynard_grammar_grammar_reference`; it is a reusable explanation preset layer, not a normal lesson sequence.
  - The only medium-confidence source is the known Genki II workbook file because its filename lacks an explicit workbook marker; prior outline/page checks classify it as Genki II workbook.
- Blocked/external post-path expansion:
  - C1 bridge: Authentic Japanese / progressing from intermediate to advanced material.
  - Advanced nuance: Shin Kanzen Master N1.
  - Literacy: Kanji in Context for broader Joyo kanji mastery.
  - End state: native immersion through novels, podcasts, and unfiltered native content.

#### File/Deck Identification Strategy (proposed)
- Use hybrid matching rather than strict file naming requirements:
  - Auto-detect via filename heuristics + title page/first-page text extraction
  - Auto-match Anki decks via normalized names + aliases
  - Show user confirmation step when detection confidence is low or ambiguous
- User can override detected textbook/deck link in one click; overrides are stored for future imports
- Do not require manual renaming as a hard prerequisite
- Show explicit link status badges per upload: `Auto-linked`, `Needs confirmation`, `Unlinked`
- Allow reversible linking after import (re-link deck, reassign textbook pair) without reuploading files

#### Dictionary Linking Policy (deferred next)
- Jisho lookup links are intentionally left out of the current closeout pass.
- When resumed, keep it Jisho-only and external: do not embed or scrape dictionary sites; open lookup externally and keep card creation/editing in-app.

### Word Selection, Deck Import & Unlock Flows (LearningMode)
- Users can **select/highlight words in lessons** and add them to any deck
- **Textbook pair unlock flow (generalized)**: If imported lesson content matches a known textbook/deck pair:
  - Show "Unlock words from this lesson" button for that lesson
  - Route unlocked words to matching imported deck (if present) or let user choose/create target deck
  - Applies to Genki and any future textbook pair mappings (not Genki-exclusive)
  - `lesson_vocabulary` table tracks: lesson_id → vocab_id → unlock status per user
- **General flow**: Highlight word in lesson → "Add to [Deck]" → confirm → word routes to SRS queue in chosen deck
- **Personalized notes**: Users can attach private notes to added/unlocked cards for memory cues, mnemonics, and context
- **Create card support**: Users can also create cards manually (aligned with Anki-like workflow), with optional reading/tags/notes
- Works with all lesson types (textbook imports, custom imports, pasted text)

#### Textbook Pair Mapping Schema (proposed)
- Add a lightweight mapping record (config table or static JSON seed) for textbook-specific unlock behavior:
  - `textbook_key` (e.g., `genki_1`, `quartet_2`)
  - `textbook_label` (user-facing name, e.g., `Genki 1`, `Quartet 2`)
  - `match_rules` (filename keywords, optional user-selected textbook tag)
  - `default_deck_name` (e.g., `Genki 1`)
  - `deck_match_rules` (imported Anki deck name aliases / normalized name)
  - `unlock_label` (button text override, optional)
  - `enabled` (feature flag per textbook pair)
- Runtime flow:
  - Identify imported lesson's `textbook_key` from `match_rules`
  - Resolve target deck by `deck_match_rules` first, fallback to `default_deck_name` create/select prompt
  - Render unlock CTA only when mapping exists and lesson has mapped vocabulary
  - Persist unlock events in `lesson_vocabulary` and apply optional per-card personal note
- Initial textbook mappings:
  - Keys: `genki_1`, `genki_2`, `quartet_1`, `quartet_2`, `tobira`, `shin_kanzen_master`
  - Labels: `Genki 1`, `Genki 2`, `Quartet 1`, `Quartet 2`, `Tobira`, `Shin Kanzen Master`
- Follow shared scraping/extraction patterns across these books where possible (same pipeline, mapping-specific rules only)
- Audio reading support for textbook lesson content is explicitly deferred to a later phase
- Audio policy for cards:
  - Preserve imported Anki audio exactly as-is
  - User-created cards can be text-only or have optional uploaded audio
  - Do not synthesize fallback speech for cards without real audio
  - Playback precedence: imported/uploaded real audio > no audio
- For non-mapped PDFs/content imports: keep generic extraction path and prompt user where to route content (deck/grammar/lessons)
- Extend by adding rows/entries only (no new logic paths)
- Add provenance metadata on created cards for filtering/stats/debugging:
  - `origin_type` (`textbook_unlock`, `manual_create`, `pdf_extract`, `anki_import`)
  - `origin_ref` (optional link to lesson/import source)
- Use `Unsorted` inbox deck as safe fallback when routing is unclear (never block import/unlock on uncertain routing)

### AI Tutor Structured Lesson Planning
- Tutor should generate **structured lesson plans** from whatever content the user provides (not only textbook-path content)
- Textbook path is the primary structured path, but tutor planning must support mixed/custom sources
- Planned output format: lesson goals, vocab targets, grammar targets, exercises, and review checkpoints

### Implementation Guardrails (Quality)
- Define acceptance criteria for each major block (`2b.1`, `2c`, `2e`, `2g`) before implementation starts
- Plan migrations early for note/audio/provenance fields to minimize repeated schema churn
- Add a Textbook Progress Dashboard in Learn: per-book completion %, current lesson, unlocked count, due count

### Other Sections (Built)
- **TutorChat** (`/practice`): AI chat with tab switcher (Tutor | Upload Content)
- **LearningMode** (`/learn`): sequential reader for `learning_content` table — text_passage, word_list, grammar_point, sentence_pair, dialogue_script renderers
- **ScenarioMode** (`/scenarios`): A↔B dialogue player; generated speech is disabled until a better audio plan exists
- **JLPTSection** (`/study/jlpt`): JLPT level content browser
- **ImmersionMode** (`/immersion`): schedule + timer gated on toggle
- **MyContent** (`/my-content`): browse/manage user content
- **Settings** (`/settings`): model slots, API key, daily limit, scheduler algorithm, theme

### DB Schema (Current)
Tables: `users`, `cards`, `card_states`, `sessions`, `questions`, `mistake_logs`, `grammar_points`, `test_sessions`, `test_responses`, `weak_point_cache`, `grammar_progress`, `learning_content`, `scenarios`

Idempotent migrations run on every DB load (new + restored): `grammar_progress` CREATE IF NOT EXISTS, ALTER TABLE source columns on `cards` / `grammar_points` / `questions`.

---

## Active Work In Progress

### Content Import — Extraction Quality
Generic content routing is working:
- Vocab → SRS deck (appears in "Review Words" count on dashboard)
- Grammar → Grammar Review queue (appears in "Study Grammar" count)
- Lessons → Learn section (`/learn`)

However, mapped textbooks should move to the specialized encrypted pack strategy. The generic OCR/AI path remains useful for:
- unknown PDFs
- quick experiments
- fallback when a textbook pack is unavailable or unlock verification fails

Current mapped-textbook priority is no longer "make DeepSeek extraction perfect every run"; it is:
1. build a reliable offline pack-generation pipeline,
2. validate canonical JSON,
3. encrypt the pack,
4. unlock it locally when the user supplies matching PDFs.

Current extraction status (2026-05-14):

**✅ A1 Core (Genki I) — COMPLETE**
- `genki_1_textbook`: 393/393 pages ✓
- `genki_1_workbook`: 157/157 pages ✓
- `genki_combined_answer_key`: 84/84 pages (A1 mapped) ✓
- All 14 lesson packs: 2,992 blocks, 2,289 exercises
- Reviewed packs: `genki_1_pre_greetings`, `genki_1_pre_numbers`, `genki_1_lesson_1-12`

**✅ A1 Pair (Marugoto A1) — COMPLETE**
- `marugoto_a1_textbook`: 147/147 pages ✓
- 1 unified lesson pack: 1,878 blocks
- Reviewed pack: `marugoto_a1_lesson_1`

**✅ A2 Core (Genki II) — COMPLETE**
- `genki_2_textbook`: 399/399 pages ✓
- `genki_2_workbook`: 137/137 pages ✓
- All 11 lesson packs (L13-L23): 2,678 blocks, 2,657 exercises
- Reviewed packs: `genki_2_lesson_13-23`

**✅ A2 Pair (Marugoto A2) — COMPLETE**
- `marugoto_a2_textbook`: 186/186 pages ✓
- 1 unified lesson pack: 2,901 blocks
- Reviewed pack: `marugoto_a2_lesson_1`

**✅ B1 Core (Quartet 1) — COMPLETE**
- `quartet_1_textbook`: 352/352 pages ✓
- 6 lesson packs: 1,963 exercises
- Reviewed packs: `quartet_1_lesson_1-6`

**✅ B1 Pair (Marugoto B1) — COMPLETE**
- `marugoto_b1_textbook`: 273/273 pages ✓
- 7 lesson packs: 4,257 blocks
- Reviewed packs: `marugoto_b1_lesson_1-7`

**✅ B2 Core (Quartet 2) — COMPLETE**
- `quartet_2_textbook`: 356/356 pages ✓
- `quartet_2_workbook`: 102/102 pages ✓
- 6 lesson packs: 2,166 blocks, 1,664 exercises
- Reviewed packs: `quartet_2_lesson_7-12`

**✅ B2 Grammar (Tobira) — COMPLETE**
- `tobira_textbook`: 428/428 pages ✓
- 8 lesson packs: 4,232 blocks
- Reviewed packs: `tobira_lesson_1-8`

**📊 TOTAL EXTRACTION COMPLETE: 54 lessons (27 A1-A2 + 27 B1-B2)**

Next: Manual corrections phase (A1-A2 first, then B1-B2)

---

## Pending / Not Yet Built

### ScenarioMode v2 — Live AI Conversation
- Free-form Japanese conversation with AI playing a character
- Inline grammar/mistake corrections mid-conversation
- Session summary: mistakes + patterns to review
- **Blocked on**: deciding UX (separate route vs modal overlay on `/scenarios`)

### AI Learning Path (CEFR-aligned)
- AI generates ordered topic sequence from user content
- Stored as JSON, visualised as a path/roadmap
- Should prioritize the textbook path when matched, then blend in user custom content
- Low priority — needs substantial UX design first

---

## Phase 5: Anki-like Review System (Planned)

**Scope:** Full-featured SRS with deck hierarchy, filtering, suspend/bury, card browser, cram mode, stats/graphs, custom fields, and card templates.

**Effort:** ~36-50 hours (3-4 weeks @ 10h/week, or 1-2 weeks full-time)

**Approach:** Read Anki open source (AGPL v3), extract detailed specification via black-boxing, then reimplement cleanly in TypeScript/React without copying code.

**Features in order:**
1. **Subdeck hierarchy** (6-8h) — new `decks` table, tree UI, card routing by deck_id
2. **Suspend/bury mechanics** (2-3h) — `suspended_at` / `buried_until` columns, queue filtering
3. **Filtered decks** (3-4h) — query builder, saved filters, dynamic card sets (depends on decks)
4. **Card browser** (6-8h) — sortable/filterable table, bulk edit, modal UI (depends on decks)
5. **Cram mode** (2-3h) — session mode flag, bypass SRS scheduling
6. **Stats/graphs** (4-6h) — daily review count, card ease, time analysis, Chart.js visualization
7. **Custom fields** (4-5h) — `card_fields` JSON, template renderer, form builder
8. **Card templates** (3-4h) — HTML/CSS templates, handlebars rendering
9. **DB backups** (1-2h) — export/import full snapshot (manual button)
10. **Testing & polish** (5-7h) — E2E testing, UI responsive design

**Critical path:** Subdeck hierarchy → Filtered decks, Card browser, Cram mode (in parallel) → Stats → Templates + Custom fields

---

## Architecture Decisions (Locked)

| Decision | Choice | Reason |
|----------|--------|--------|
| Content storage | SQLite in localStorage | Browser-native, no server persistence needed |
| Audio persistence | IndexedDB (`audioStore.ts`) with `idb:` key prefix | Blob URLs die on page reload |
| API keys | Server-side only, proxied via Express | Never exposed to client |
| Base content | Zero on install — user imports everything | Avoids bundling large data files |
| Generated speech | Disabled before beta | The old browser/Azure fallback sounded poor; use imported/uploaded real audio only |
| Grammar tracking | `grammar_progress` table (UPSERT) | Lightweight, no full SRS needed for grammar points |
| Heatmap colours | Blue=vocab, purple=grammar, green=both | Visually separates study modes |

---

## File Map (Key Files)

```
app/src/
  study/
    StudyDashboard.tsx     — main dashboard, streak, counts, review buttons
    ReviewSession.tsx      — word review session
    GrammarReview.tsx      — grammar flashcard loop
    Heatmap.tsx            — tri-colour activity heatmap
    WeakPointPanel.tsx     — weak card analysis
    LearningMode.tsx       — sequential lesson reader
    ScenarioMode.tsx       — A↔B dialogue player
    TutorChat.tsx          — AI chat + upload tab switcher
    ContentUpload.tsx      — import pipeline (Anki + AI extraction)
    MyContent.tsx          — user content management
    JLPTSection.tsx        — JLPT level browser
  srs/
    srsService.ts          — all SRS DB operations
    ankiImport.ts          — .apkg importer
    audioStore.ts          — IndexedDB audio persistence
    sessionRecovery.ts     — crash-safe session resume
  db/
    sqlite.ts              — sql.js wrapper, schema init, idempotent migrations
  ai/
    aiProvider.ts          — ClientAIProvider (proxies to Express)
  core/
    providers.ts           — interfaces (StorageProvider, SchedulerProvider, AIProvider)
    scheduler.ts           — FSRS + SM2 implementations
  store/
    index.ts               — Zustand store (settings, activeUserId, onboardingComplete)
  components/
    Navigation.tsx
    OfflineBanner.tsx
  pages/
    Settings.tsx
  hooks/
    useCardAudio.ts        — audio resolution hook (idb: → Blob URL)
    useTheme.ts
server/
  index.ts                 — Express proxy (AI, session tokens)
```

---

## Next Steps (Priority Order)

1. **Genki 1 specialized pack proof** — evaluate PaddleOCR vs Apple Vision, generate canonical Lesson 1 JSON, validate it
2. **Encrypted pack + local unlock flow** — user uploads Genki textbook/workbook to unlock the encrypted pack
3. **Known Textbooks panel** — route Genki uploads into unlock flow; keep generic PDF import as fallback
4. **Textbook Learning subsection** — render unlocked structured lessons and unlock vocab into linked decks
5. **Structured AI tutor lesson planning** from unlocked textbook packs plus user-provided custom content
6. **ScenarioMode v2** — AI conversation (requires UX decision first)

---

## Recommended Next Ideas (2026-05-20 audit)

Content (A1–B2) and the SRS are complete, so the highest-leverage work is now reliability and reach rather
than more features. Priority-ordered:

1. **Backup / Restore + cloud sync (highest value).** All state lives in one browser's localStorage +
   IndexedDB — clearing site data wipes every SRS history with no recovery. The single biggest user risk.
   First step: manual JSON export/import. Real fix: optional account-based sync (also unlocks multi-device).
2. **Finish the encrypted-pack unlock flow** (= Next Steps #2 above). Half-built already
   (`build-encrypted-packs.ts`, `textbookPackUnlock.ts`); the main differentiator over generic OCR import.
3. **Recorded-audio regression test.** Assert imported/uploaded MP3 playback still resolves `idb:` audio and
   does not fall back to generated speech.
4. **Unify grammar into the scheduler.** Grammar uses a lightweight `grammar_progress` UPSERT, not FSRS;
   folding it into the real scheduler gives grammar proper spacing.
5. **Pitch-accent display (OJAD-style),** shown visually without generated audio until a better voice plan is chosen.
6. **Offline-aware AI features.** Already a PWA; AI surfaces should show a clear offline state while
   review/lessons keep working without the proxy.
7. **Live "time-to-goal" dashboard widget.** Reuse the Learning Path realism + month-estimate logic to show a
   retention-forecast / projection tile on the dashboard.
8. **Longer-term (external/blocked):** C1/N1 expansion (Shin Kanzen Master, Kanji in Context); handwriting
   input graded against pack answer-keys.
