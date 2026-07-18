# KirokuMichi — Todo

**Last updated: 2026-07-18**
**Status: PHASE 7 SHIPPED — Research enforcement + security harden (Phases 1–7)**

---

## ✅ Everything Shipped

All planned features are implemented and building cleanly. See HANDOFF.md for the full feature list.

---

## 🔥 Current priority — Learning Environment Redesign

Full plan + science foundation + **Anki integration** + **smooth lesson rail**: `plan.md`.
Canvas: `~/.cursor/projects/Users-Skipp-Projects-KirokuMichi/canvases/learning-env-redesign.canvas.tsx`

**Design rules:** retrieval / spacing / relearning / scaffolding→fading / pushed output win over engagement shortcuts.
**Anki clone** (`ReviewSession` + FSRS) is the only card scheduler — embed it as the Cards step; do not fork a second rater.

**Phase 1 — Close Anki↔lesson loop**
- [x] `setCurrentLesson` on session start
- [x] `ensureLessonCards` + `buildLessonReviewQueue` (wrap existing SRS APIs)
- [x] Cards step = real `ReviewSession` (weak/misses first, cap 8–15, FSRS writes)
- [x] Single Done rule (remove auto-complete from bare card review)
- [x] Fix TextbookProgress Study Now queue; path lessons autostart session
- [x] Log quiz misses to mistakes when card-linked
- [x] Keep due-before-new in `getStudyPathAction`

**Phase 2 — Simplify IA**
- [x] Nav: Today / Course / Review (Anki home) / Speak / Library
- [x] Collapse Learn hubs; LessonPage = Reference, not front door

**Phase 3 — Smooth research-backed rail**
- [x] Intro → Teach → Check → Practice → Cards → Speak → Done (one progress rail)
- [x] Autostart skips LessonPage dump; persist/resume mid-session
- [x] Speak requires production

**Phase 4 — First-run**
- [x] Onboarding → first Intro; starter deck; default textbook lessons on path

**Phase 5 — Verification (redesign gate)**
- [x] Anki stack reused (ReviewSession + FSRS); no parallel lesson card rater
- [x] Rail steps map to Learning Science Foundation
- [x] Single Done rule: complete only after Speak (`LessonStudy.finishLesson`); Reference page no longer checkbox-completes
- [x] Today priority: dues before new lessons; 5-due∶1-new interleave
- [x] Gate tests + lint/tsc/vitest/route smoke

**Phase 6 — Pedagogy hardening (audit → A standard)**
- [x] Cards non-optional: review now or `commitDeferredLessonCards` queues on Today; completion gated
- [x] Speak + workbook production validation (Japanese script, lesson targets)
- [x] Grammar SRS: lesson grammar cards + cloze in ReviewSession; grammar points due stagger (+7d default, lesson-scoped activation)
- [x] Typed free-recall in checkpoints; writing variant every 7th card; GrammarReview meaning hidden until reveal
- [x] Day-1 session budget (`firstSessionBudget`) caps first lesson rail
- [x] Unit tests: productionValidation, typedRecall, firstSessionBudget, grammarCardBuilder
- [x] Sentence cards use listen-then-type (`CardListening` + bundled audio / TTS fallback)
- [x] Scenario Live Practice counts toward Speak completion when launched from lesson rail
- [x] Playwright lesson-rail smoke (`npm run qa:lesson-rail`)

**Phase 7 — Research enforcement + security (2026-07-18 audit)**  
Canvas: `research-security-audit.canvas.tsx` · Details: `plan.md` Phase 7

Pedagogy
- [x] Criterion relearning: Again requeues in-session (or block Done until weak items Good)
- [x] Harden Cards complete: verified return; do not trust bare `?after=cards`
- [x] Typed attempt required before Teach / Writing reveal
- [x] Raise Speak bar (no starter-chip-only; keep lesson targets)
- [x] Typed recall in Final Check; merge GrammarReview into unified Review

Security (before public staging)
- [x] Stop free `/api/session`; bind AI to server-validated beta/auth
- [x] Enforce beta/auth on AI / PDF / report APIs
- [x] SSRF harden: no auto-redirect to private IPs; block `::ffff:`; env allowlist
- [x] Sanitize card templates (DOMPurify / escape-by-default)
- [x] Disable `/api/dev/*` in production; restrict `/data` packaging artifacts

**Earlier (done):** Study path planner + Today’s Path panel on Home.

---

## 🔐 Security audit findings (2026-05-20)

Ordered by severity. Items 2–5 are low-risk while the server stays bound to `127.0.0.1`, but
become serious the moment the Express proxy is deployed publicly (Render/Fly/Vercel — see staging plan).

- **✅ FIXED 2026-06-12 — OpenRouter key sent to wrong domain.** `app/server/index.ts` now uses
  `https://openrouter.ai/api/v1/chat/completions` through a shared `PROVIDER_ENDPOINTS` constant for the
  streaming and non-streaming paths.
- **✅ MITIGATED 2026-06-12 — SSRF via `custom` provider endpoint.** Custom provider URLs now require
  `https`, except explicit localhost/loopback development endpoints, and DNS/IP resolution rejects private,
  link-local, multicast, and unspecified addresses. Remaining deploy-hardening option: move custom endpoints
  to server `.env` allowlists if public hosted custom endpoints are needed.
- **✅ FIXED 2026-06-12 — API keys stored in browser localStorage, contradicting docs.** Hosted AI providers,
  PDF extraction, and custom provider auth now use server environment variables. Client settings no longer
  send provider keys, and Zustand persistence scrubs old `apiKey` values on hydration.
- **✅ MITIGATED 2026-06-12 — Unauthenticated, unbounded session tokens.** Session tokens now expire after
  12 hours and are capped in memory. Remaining deploy-hardening option: require a real user auth/session
  system before exposing token issuance publicly.
- **✅ MITIGATED 2026-06-12 — No rate limiting / security headers.** `/api/*` now has a lightweight per-IP
  rate limit, common security headers, a 2 MB JSON body cap, and PDF upload limit reduced to 100 MB.
  Remaining deploy-hardening option: replace the local middleware with platform-grade rate limiting if the
  proxy becomes internet-facing.
- **✅ FIXED 2026-06-12 — npm audit auto-fixable runtime/dev vulns.** `npm audit fix` updated runtime
  packages, then unused vulnerable dev dependencies (`drizzle-kit`, `xlsx`) were removed. Full `npm audit`
  now reports 0 vulnerabilities.

### Code-health (general use)
- **Docs sprawl** — ~15 disagreeing top-level markdowns (`AGENTS.md`, `ANKI_*`, `IMPLEMENTATION_STATUS.md`,
  `SYSTEM_READY.md`, `plan.md`, `todo.md`, `HANDOFF.md`). Pick one source of truth (HANDOFF.md) and archive the rest.
- **tsconfig strictness relaxed** — `noUnusedLocals` / `noUnusedParameters` / `erasableSyntaxOnly` are off to
  let legacy Anki code compile; re-tighten incrementally.

---

## 🔲 Next staging setup

- **Render full-stack staging deploy**
  - Use `render.yaml` and `STAGING.md`.
  - Render root directory: `app`.
  - Build command: `npm ci && npm run build`.
  - Start command: `npm run start`.
  - Health check: `/api/health`.
  - Vercel remains viable for frontend-only hosting if `/api/*` is proxied to the Render backend.
  - Closed beta invite-code gate is implemented with `BETA_INVITE_CODES`; no database required for early testers.

- **Report sink credentials**
  - Configure `GITHUB_REPORT_REPO` as `owner/repo`.
  - Configure `GITHUB_REPORT_TOKEN` with permission to create issues in that repo.
  - Labels: `bug`, `content`, `contrast`, `lesson-flow`, `scenario`, `suggestion`.
  - Store report credentials as hosting environment variables only.
  - Later option: Linear/Notion/Supabase if GitHub Issues becomes too noisy.

- **Server-side AI credentials**
  - Configure hosted AI keys as backend environment variables: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, and/or `DEEPSEEK_API_KEY`.
  - Testers may also enter their own hosted-provider key in Settings; it is session-only, sent only through the proxy request, and scrubbed from persisted Zustand state.
  - PDF extraction currently requires server `DEEPSEEK_API_KEY` or a tester-provided DeepSeek key.
  - Configure `CUSTOM_PROVIDER_API_KEY` only if the custom OpenAI-compatible provider is used.

- **Runtime error tracking**
  - Optional Sentry wiring is implemented for server (`SENTRY_DSN`) and browser (`VITE_SENTRY_DSN`).
  - After staging is public, configure DSNs and confirm server/browser events arrive.

---

## ⏳ Blocked — waiting on external work

These cannot be progressed without outside input:

- **More textbook image crops** — no longer fully blocked: agreed workflow (2026-06-12, see plan.md "Image extraction workflow") is (1) deterministically derive candidate figure regions from gaps in grouped OCR block coverage, (2) Haiku subagent pass to classify/label candidates (not to emit raw coordinates), (3) Sonnet/Opus escalation for flagged ambiguous pages, (4) human review via corrections file + validation viewer, then `npm run textbook:assets:crop` + `npm run textbook:assets:manifest`. Still pending: building the OCR-gap candidate generator and running a trial lesson.
- **Maynard direct refs cleanup** — reduced from 73 curated bridges to 5 remaining niche bridges; rerun `npm run textbook:maynard:direct-refs` and `npm run textbook:maynard:quality` when better extraction/alias data lands.
- **Manual lesson corrections** — 54 lesson packs flagged for human review; not automatable
- **C1/N1 post-B2 expansion** — Shin Kanzen Master, Kanji in Context, native immersion sources; out of current scope

---

## 💡 Recommended next ideas (2026-05-20 audit)

Content (A1–B2) and the SRS are complete, so the highest-leverage work is now reliability and reach.
Roughly priority-ordered:

1. **Backup / Restore + cloud sync (highest value).** All state lives in one browser's localStorage +
   IndexedDB — clearing site data wipes every SRS history with no recovery. This is the single biggest user
   risk. First step: manual JSON export/import. Real fix: optional account-based sync (also unlocks multi-device).
2. **Finish the encrypted-pack unlock flow.** Already half-built (`build-encrypted-packs.ts`,
   `textbookPackUnlock.ts`); it's the roadmap's stated #1–2 and the main differentiator over generic OCR import.
3. **Recorded-audio regression test.** Assert imported/uploaded MP3 playback still resolves `idb:` audio and
   does not fall back to generated speech.
4. **✅ DONE 2026-06-12 — Unify grammar into the scheduler.** Grammar review now uses scheduler-backed
   `grammar_states` with Again/Hard/Good/Easy ratings; `grammar_progress` remains as history/compat.
5. **Pitch-accent display (OJAD-style),** shown visually without generated audio until a better voice plan is chosen.
6. **Offline-aware AI features.** Already a PWA; have AI surfaces show a clear offline state while
   review/lessons keep working without the proxy.
7. **Live "time-to-goal" dashboard widget.** Reuse the Learning Path realism + month-estimate logic to show a
   retention-forecast / projection tile on the dashboard.

---

## 🏗️ Technical / platform improvements (2026-05-20 review)

Grounded in the current code; not previously in plan/todo. Ordered by impact.

1. **✅ FIXED 2026-06-12 — Move DB persistence off `localStorage` → IndexedDB.**
   `sqlite.ts` now loads/saves the raw sql.js `Uint8Array` snapshot in IndexedDB, debounces writes, migrates
   an existing `kiroku_michi_db` localStorage snapshot forward, and raises an in-app warning if persistence
   fails. `localStorage` remains only as a last-ditch fallback when IndexedDB is unavailable.
2. **Run sql.js in a Web Worker.** DB runs on the main thread, so heavy reads (CardBrowser, stats, APKG
   parse) block rendering. Move the DB into a Worker to keep the UI responsive. Pairs with #1.
3. **Storage-quota safeguard (stopgap until #1).** Wrap `setItem` in try/catch, surface a "storage almost
   full — export your data" warning, stop silently dropping writes. Today a full quota fails invisibly.
4. **First-run starter on-ramp.** "Zero content on install" means a new user lands on an empty dashboard with
   nothing to do until they import a deck/PDF — a steep activation cliff. Bundle a small starter deck
   (~hundreds of N5 words) or a one-click "load a free Genki/Kaishi starter" so someone can review within
   30 seconds of opening the app.
5. **Localize the UI — Japanese first.** `react-intl` is wired throughout but `locale` is hardcoded `"en"`
   (`App.tsx:91`) with only `en.json`. For a Japanese-learning app, a Japanese UI is thematically fitting and
   cheap given the groundwork — add `ja.json` + a locale switcher. The i18n scaffolding currently buys nothing.
6. **Accessibility pass.** Only ~27 of ~70 components use any `aria`/`role`; just 3 have `Escape`/focus
   handling. Modals (Report Issue, keyboard help, confirm dialogs) likely lack focus traps + Esc-to-close, and
   rating controls may be unlabeled for screen readers. Sweep: modal focus management, aria-labels on rating
   buttons, visible focus rings.

---

## 🔲 Remaining optional work (low priority)

- **Quartet/Marugoto APKG lesson-linking** — Genki official deck is fully linked; other textbook APKGs would need similar tag-based or title-based lesson ID derivation if users import them

---

## Build & verify

```bash
cd app
npm run verify        # lint + tsc + vitest + playwright + build + content audits
npm run qa:routes     # Playwright route smoke (desktop + mobile)
npm run build         # production build
```
