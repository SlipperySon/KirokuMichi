# KirokuMichi — Todo

**Last updated: 2026-05-19**
**Status: FEATURE COMPLETE — ready for staging**

---

## ✅ Everything Shipped

All planned features are implemented and building cleanly. See HANDOFF.md for the full feature list.

---

## ⏳ Blocked — waiting on external work

These cannot be progressed without outside input:

- **More textbook image crops** — rerun `npm run textbook:assets:manifest` when extraction agent produces more crops
- **Maynard direct refs cleanup** — 73 curated bridges remain; rerun `npm run textbook:maynard:direct-refs` when cleaned extraction / alias data lands. Use `commonCuratedBridges` from the quality report as the target list.
- **Manual lesson corrections** — 54 lesson packs flagged for human review; not automatable
- **C1/N1 post-B2 expansion** — Shin Kanzen Master, Kanji in Context, native immersion sources; out of current scope

---

## 🔲 Remaining optional work (low priority)

- **Specialized Textbook Pack Pipeline** — full OCR + encrypt/unlock flow for Genki/Quartet; large project (8–15h), blocked on OCR pipeline
- **ScenarioMode v2 AI test** — skipped in E2E; enable with mock AI server or test API key
- **Audio playback regression tests** — behaviour is correct (imported audio → TTS fallback) but no automated test asserts the precedence order

---

## Build & verify

```bash
cd app
npm run verify        # lint + tsc + vitest + playwright + build + content audits
npm run qa:routes     # Playwright route smoke (desktop + mobile)
npm run build         # production build
```
