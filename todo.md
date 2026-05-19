# KirokuMichi — Todo

**Last updated: 2026-05-20**
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
