# KirokuMichi — Todo

**Last updated: 2026-05-22**
**Status: FEATURE COMPLETE — staging/reporting setup next**

---

## ✅ Everything Shipped

All planned features are implemented and building cleanly. See HANDOFF.md for the full feature list.

---

## 🔲 Next staging setup

- **External Vercel staging deploy**
  - Configure Vercel project root as `app`.
  - Build command: `npm run build`.
  - Output directory: `dist`.
  - Confirm `app/vercel.json` SPA fallback works on direct route refresh.
  - Use staging URL first, e.g. `kirokumichi-staging.vercel.app` or `staging.kirokumichi.com`.

- **Backend/API deployment decision**
  - Decide whether to keep Express AI proxy separate on Render/Fly/Railway or convert small endpoints to Vercel serverless functions.
  - Reporting endpoint is already implemented as both local Express `/api/report` and Vercel `app/api/report.ts`, so it can be serverless even if AI proxy remains separate.

- **Report sink credentials**
  - Configure `GITHUB_REPORT_REPO` as `owner/repo`.
  - Configure `GITHUB_REPORT_TOKEN` with permission to create issues in that repo.
  - Labels: `bug`, `content`, `contrast`, `lesson-flow`, `scenario`, `suggestion`.
  - Store report credentials as hosting environment variables only.
  - Later option: Linear/Notion/Supabase if GitHub Issues becomes too noisy.

- **Runtime error tracking**
  - Add Sentry or equivalent after staging is public.
  - Link user reports to Sentry event IDs when an error was captured on the same page/session.

---

## ⏳ Blocked — waiting on external work

These cannot be progressed without outside input:

- **More textbook image crops** — rerun `npm run textbook:assets:manifest` when extraction agent produces more crops
- **Maynard direct refs cleanup** — 73 curated bridges remain; rerun `npm run textbook:maynard:direct-refs` when cleaned extraction / alias data lands. Use `commonCuratedBridges` from the quality report as the target list.
- **Manual lesson corrections** — 54 lesson packs flagged for human review; not automatable
- **C1/N1 post-B2 expansion** — Shin Kanzen Master, Kanji in Context, native immersion sources; out of current scope

---

## 🔲 Remaining optional work (low priority)

- **Audio playback regression tests** — behaviour correct (Azure TTS → imported audio → Web Speech fallback) but no automated test asserts precedence order
- **Quartet/Marugoto APKG lesson-linking** — Genki official deck is fully linked; other textbook APKGs would need similar tag-based or title-based lesson ID derivation if users import them
- **C1/N1 expansion** — Shin Kanzen Master, native immersion sources; out of current A1–B2 scope

---

## Build & verify

```bash
cd app
npm run verify        # lint + tsc + vitest + playwright + build + content audits
npm run qa:routes     # Playwright route smoke (desktop + mobile)
npm run build         # production build
```
